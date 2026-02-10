import { NextRequest, NextResponse } from 'next/server';
import { getMods, addMod, saveMods, Mod, getConfig } from '@/lib/db';
import { getProject, getProjectVersions, analyzeEnvironment } from '@/lib/modrinth';
import fs from 'fs';
import path from 'path';

// 获取模组列表
export async function GET() {
  try {
    const mods = getMods();
    const config = getConfig();
    const categorized = {
      both: mods.filter(m => m.category === 'both'),
      serverOnly: mods.filter(m => m.category === 'server-only'),
      clientOnly: mods.filter(m => m.category === 'client-only'),
    };
    return NextResponse.json({ mods, categorized, config: { showServerOnlyMods: config.showServerOnlyMods ?? true } });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get mods' },
      { status: 500 }
    );
  }
}

// 添加模组
export async function POST(request: NextRequest) {
  try {
    const { projectId, versionId } = await request.json();
    
    if (!projectId || !versionId) {
      return NextResponse.json(
        { error: 'Missing projectId or versionId' },
        { status: 400 }
      );
    }
    
    // 获取项目详情
    const project = await getProject(projectId);
    
    // 获取版本详情
    const versions = await getProjectVersions(projectId);
    const version = versions.find((v: any) => v.id === versionId);
    
    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }
    
    // 分析环境 - 使用 project 对象的环境信息（version 对象不包含 client_support/server_support）
    const env = analyzeEnvironment(project);
    
    // 获取主文件
    const primaryFile = version.files.find((f: any) => f.primary) || version.files[0];
    
    if (!primaryFile) {
      return NextResponse.json(
        { error: 'No file found for this version' },
        { status: 404 }
      );
    }
    
    // 下载文件到服务端目录
    const config = getConfig();
    if (config.path) {
      // 根据分类决定存放目录
      const isClientOnly = env.category === 'client-only';
      const targetDir = isClientOnly 
        ? path.join(config.path, 'mods', '.client')
        : path.join(config.path, 'mods');
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const { downloadFile } = await import('@/lib/modrinth');
      const fileData = await downloadFile(primaryFile.url);
      fs.writeFileSync(path.join(targetDir, primaryFile.filename), Buffer.from(fileData));
    }
    
    // 创建模组记录
    const mod: Mod = {
      id: projectId,
      slug: project.slug,
      name: project.title,
      versionId: versionId,
      filename: primaryFile.filename,
      environment: {
        client: project.client_side || 'required',
        server: project.server_side || 'required',
      },
      category: env.category,
      installedAt: new Date().toISOString(),
      iconUrl: project.icon_url,
      description: project.description,
      versionNumber: version.version_number,
      enabled: true, // 新模组默认启用
      recommended: false, // 客户端模组默认不推荐
    };
    
    addMod(mod);
    
    return NextResponse.json({ success: true, mod });
  } catch (error) {
    console.error('Add mod error:', error);
    return NextResponse.json(
      { error: 'Failed to add mod' },
      { status: 500 }
    );
  }
}

// 删除模组
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing mod id' },
        { status: 400 }
      );
    }
    
    const mods = getMods();
    const mod = mods.find(m => m.id === id);
    
    if (!mod) {
      return NextResponse.json(
        { error: 'Mod not found' },
        { status: 404 }
      );
    }
    
    // 删除文件（从 mods、disabled 和 client 目录）
    const config = getConfig();
    if (config.path && mod.filename) {
      const modsPath = path.join(config.path, 'mods', mod.filename);
      const disabledPath = path.join(config.path, 'mods', '.disabled', mod.filename);
      const clientPath = path.join(config.path, 'mods', '.client', mod.filename);
      
      if (fs.existsSync(modsPath)) {
        fs.unlinkSync(modsPath);
      }
      if (fs.existsSync(disabledPath)) {
        fs.unlinkSync(disabledPath);
      }
      if (fs.existsSync(clientPath)) {
        fs.unlinkSync(clientPath);
      }
    }
    
    // 从列表中移除
    saveMods(mods.filter(m => m.id !== id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete mod' },
      { status: 500 }
    );
  }
}

// 更新模组分类（PATCH 方法）
export async function PATCH(request: NextRequest) {
  try {
    const { id, category } = await request.json();
    
    if (!id || !category) {
      return NextResponse.json(
        { error: 'Missing id or category' },
        { status: 400 }
      );
    }
    
    // 验证 category 值
    const validCategories = ['both', 'server-only', 'client-only'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: both, server-only, client-only' },
        { status: 400 }
      );
    }
    
    const mods = getMods();
    const modIndex = mods.findIndex(m => m.id === id);
    
    if (modIndex === -1) {
      return NextResponse.json(
        { error: 'Mod not found' },
        { status: 404 }
      );
    }
    
    const oldCategory = mods[modIndex].category;
    const newCategory = category as 'both' | 'server-only' | 'client-only';
    
    // 如果分类发生变化，需要移动文件
    if (oldCategory !== newCategory) {
      const config = getConfig();
      if (config.path && mods[modIndex].filename) {
        const modsDir = path.join(config.path, 'mods');
        const disabledDir = path.join(modsDir, '.disabled');
        const clientDir = path.join(modsDir, '.client');
        const filename = mods[modIndex].filename;
        
        // 可能的文件位置
        const modsPath = path.join(modsDir, filename);
        const disabledPath = path.join(disabledDir, filename);
        const clientPath = path.join(clientDir, filename);
        
        // 确定当前文件位置
        let currentPath: string | null = null;
        if (fs.existsSync(modsPath)) {
          currentPath = modsPath;
        } else if (fs.existsSync(disabledPath)) {
          currentPath = disabledPath;
        } else if (fs.existsSync(clientPath)) {
          currentPath = clientPath;
        }
        
        if (currentPath) {
          try {
            // 确定目标位置
            let targetPath: string;
            if (newCategory === 'client-only') {
              // 切换到客户端：移动到 .client/
              if (!fs.existsSync(clientDir)) {
                fs.mkdirSync(clientDir, { recursive: true });
              }
              targetPath = clientPath;
              // 同时启用（客户端模组没有禁用概念）
              mods[modIndex].enabled = true;
            } else if (mods[modIndex].enabled === false) {
              // 切换到其他分类但当前禁用：移动到 .disabled/
              if (!fs.existsSync(disabledDir)) {
                fs.mkdirSync(disabledDir, { recursive: true });
              }
              targetPath = disabledPath;
            } else {
              // 切换到其他分类且启用：移动到 mods/
              targetPath = modsPath;
            }
            
            // 移动文件（如果目标不同）
            if (currentPath !== targetPath) {
              fs.renameSync(currentPath, targetPath);
            }
          } catch (fileError) {
            console.error('File move error during category change:', fileError);
            // 文件操作失败继续更新数据库
          }
        }
      }
      
      // 切换到客户端时，清除推荐状态
      if (newCategory === 'client-only') {
        mods[modIndex].recommended = false;
      }
    }
    
    // 更新分类
    mods[modIndex].category = newCategory;
    saveMods(mods);
    
    return NextResponse.json({ success: true, mod: mods[modIndex] });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// 切换模组启用状态或客户端模组推荐状态（PUT 方法）
export async function PUT(request: NextRequest) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing mod id' },
        { status: 400 }
      );
    }
    
    const mods = getMods();
    const modIndex = mods.findIndex(m => m.id === id);
    
    if (modIndex === -1) {
      return NextResponse.json(
        { error: 'Mod not found' },
        { status: 404 }
      );
    }
    
    const mod = mods[modIndex];
    
    // 客户端模组：切换推荐状态（文件不移动，始终在 mods/ 目录）
    if (mod.category === 'client-only') {
      mods[modIndex].recommended = !mods[modIndex].recommended;
      saveMods(mods);
      return NextResponse.json({ success: true, mod: mods[modIndex], action: 'recommended' });
    }
    
    // 双端和服务端模组：切换启用状态（移动文件）
    const newEnabled = !mod.enabled;
    
    // 移动文件
    const config = getConfig();
    if (config.path && mod.filename) {
      const modsDir = path.join(config.path, 'mods');
      const disabledDir = path.join(modsDir, '.disabled');
      const sourcePath = path.join(modsDir, mod.filename);
      const destPath = path.join(disabledDir, mod.filename);
      
      try {
        if (newEnabled) {
          // 启用：从 .disabled 移动到 mods
          if (!fs.existsSync(disabledDir)) {
            fs.mkdirSync(disabledDir, { recursive: true });
          }
          if (fs.existsSync(destPath)) {
            if (!fs.existsSync(modsDir)) {
              fs.mkdirSync(modsDir, { recursive: true });
            }
            fs.renameSync(destPath, sourcePath);
          }
        } else {
          // 禁用：从 mods 移动到 .disabled
          if (!fs.existsSync(disabledDir)) {
            fs.mkdirSync(disabledDir, { recursive: true });
          }
          if (fs.existsSync(sourcePath)) {
            fs.renameSync(sourcePath, destPath);
          }
        }
      } catch (fileError) {
        console.error('File operation error:', fileError);
        // 文件操作失败不影响数据库更新
      }
    }
    
    // 更新状态
    mods[modIndex].enabled = newEnabled;
    saveMods(mods);
    
    return NextResponse.json({ success: true, mod: mods[modIndex], action: 'enabled' });
  } catch (error) {
    console.error('Toggle mod error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle mod' },
      { status: 500 }
    );
  }
}

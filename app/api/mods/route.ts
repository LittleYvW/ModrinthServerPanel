import { NextRequest, NextResponse } from 'next/server';
import { getMods, addMod, saveMods, Mod } from '@/lib/db';
import { getProject, getProjectVersions, analyzeEnvironment } from '@/lib/modrinth';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/lib/db';

// 获取模组列表
export async function GET() {
  try {
    const mods = getMods();
    const categorized = {
      both: mods.filter(m => m.category === 'both'),
      serverOnly: mods.filter(m => m.category === 'server-only'),
      clientOnly: mods.filter(m => m.category === 'client-only'),
    };
    return NextResponse.json({ mods, categorized });
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
    
    // 分析环境
    const env = analyzeEnvironment(version);
    
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
      const modsDir = path.join(config.path, 'mods');
      if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
      }
      
      const { downloadFile } = await import('@/lib/modrinth');
      const fileData = await downloadFile(primaryFile.url);
      fs.writeFileSync(path.join(modsDir, primaryFile.filename), Buffer.from(fileData));
    }
    
    // 创建模组记录
    const mod: Mod = {
      id: projectId,
      slug: project.slug,
      name: project.title,
      versionId: versionId,
      filename: primaryFile.filename,
      environment: {
        client: version.client_support || project.client_side || 'required',
        server: version.server_support || project.server_side || 'required',
      },
      category: env.category,
      installedAt: new Date().toISOString(),
      iconUrl: project.icon_url,
      description: project.description,
      versionNumber: version.version_number,
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
    
    // 删除文件
    const config = getConfig();
    if (config.path && mod.filename) {
      const filePath = path.join(config.path, 'mods', mod.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
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

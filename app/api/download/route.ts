import { NextRequest, NextResponse } from 'next/server';
import { getMods } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { getConfig } from '@/lib/db';

// 获取模组文件下载
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modId = searchParams.get('modId');
    
    if (!modId) {
      return NextResponse.json(
        { error: 'Missing modId' },
        { status: 400 }
      );
    }
    
    const mods = getMods();
    const mod = mods.find(m => m.id === modId);
    
    if (!mod) {
      return NextResponse.json(
        { error: 'Mod not found' },
        { status: 404 }
      );
    }
    
    const config = getConfig();
    if (!config.path) {
      return NextResponse.json(
        { error: 'Server path not configured' },
        { status: 500 }
      );
    }
    
    // 根据模组分类确定文件位置
    let filePath: string;
    if (mod.category === 'client-only') {
      // 客户端模组在 .client/ 目录
      filePath = path.join(config.path, 'mods', '.client', mod.filename);
    } else {
      // 检查模组是否启用
      if (mod.enabled === false) {
        return NextResponse.json(
          { error: 'Mod is disabled' },
          { status: 403 }
        );
      }
      filePath = path.join(config.path, 'mods', mod.filename);
    }
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Disposition': `attachment; filename="${mod.filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

// 批量下载 - 返回所有双端模组的打包
export async function POST() {
  try {
    const config = getConfig();
    if (!config.path) {
      return NextResponse.json(
        { error: 'Server path not configured' },
        { status: 500 }
      );
    }
    
    const mods = getMods();
    const bothMods = mods.filter(m => m.category === 'both' && m.enabled !== false);
    
    // 收集所有文件路径
    const files: { name: string; path: string }[] = [];
    for (const mod of bothMods) {
      let filePath: string;
      if (mod.category === 'client-only') {
        filePath = path.join(config.path, 'mods', '.client', mod.filename);
      } else {
        filePath = path.join(config.path, 'mods', mod.filename);
      }
      if (fs.existsSync(filePath)) {
        files.push({ name: mod.filename, path: filePath });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      mods: bothMods.map(m => ({
        id: m.id,
        name: m.name,
        filename: m.filename,
        downloadUrl: `/api/download?modId=${m.id}`,
      }))
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get download list' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// 支持的配置文件扩展名
const CONFIG_EXTENSIONS = ['.json', '.json5', '.toml'];

interface ConfigFile {
  path: string;
  name: string;
  type: 'json' | 'json5' | 'toml';
  size: number;
  modifiedAt: string;
}

// 递归获取所有配置文件
function getAllConfigFiles(dirPath: string, basePath: string, relativePath: string = ''): ConfigFile[] {
  const results: ConfigFile[] = [];
  
  if (!fs.existsSync(dirPath)) {
    return results;
  }
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 递归扫描子目录
      results.push(...getAllConfigFiles(fullPath, basePath, itemRelativePath));
    } else {
      // 检查是否是配置文件
      const ext = path.extname(item).toLowerCase();
      if (CONFIG_EXTENSIONS.includes(ext)) {
        const type = ext === '.json' ? 'json' : ext === '.json5' ? 'json5' : 'toml';
        results.push({
          path: itemRelativePath,
          name: item,
          type,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }
  
  // 按目录和名称排序
  return results.sort((a, b) => {
    const dirA = path.dirname(a.path);
    const dirB = path.dirname(b.path);
    if (dirA !== dirB) {
      return dirA.localeCompare(dirB);
    }
    return a.name.localeCompare(b.name);
  });
}

// 获取所有可用的配置文件
export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    
    if (!config.path) {
      return NextResponse.json(
        { error: 'Server path not configured' },
        { status: 400 }
      );
    }
    
    const configDir = path.join(config.path, 'config');
    
    if (!fs.existsSync(configDir)) {
      return NextResponse.json({ files: [] });
    }
    
    const files = getAllConfigFiles(configDir, configDir);
    
    return NextResponse.json({
      success: true,
      files,
      total: files.length,
    });
  } catch (error) {
    console.error('Get all config files error:', error);
    return NextResponse.json(
      { error: 'Failed to get config files' },
      { status: 500 }
    );
  }
}

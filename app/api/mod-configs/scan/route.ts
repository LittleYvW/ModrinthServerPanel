import { NextResponse } from 'next/server';
import { getConfig, getMods, addModConfigFile, getModConfigs } from '@/lib/db';
import fs from 'fs';
import path from 'path';



// 从模组文件名提取关键词（用于匹配配置）
function extractModKeywords(modName: string, filename: string): string[] {
  const keywords: string[] = [];
  
  // 从模组名称提取关键词（按空格、下划线、连字符分割）
  const nameParts = modName.toLowerCase().split(/[\s_\-]+/);
  keywords.push(...nameParts.filter(p => p.length > 2));
  
  // 从文件名提取（去掉版本号等）
  const fileBase = path.basename(filename, path.extname(filename));
  // 移除常见的版本号模式
  const cleanFileName = fileBase
    .toLowerCase()
    .replace(/-\d+[\.\d+]*/g, '')  // 移除 -1.20.1 这样的版本号
    .replace(/-forge/g, '')
    .replace(/-fabric/g, '')
    .replace(/-neoforge/g, '')
    .replace(/-quilt/g, '');
  
  const fileParts = cleanFileName.split(/[\s_\-]+/);
  keywords.push(...fileParts.filter(p => p.length > 2));
  
  // 添加 slug 风格的名称
  keywords.push(modName.toLowerCase().replace(/\s+/g, ''));
  keywords.push(modName.toLowerCase().replace(/\s+/g, '-'));
  keywords.push(modName.toLowerCase().replace(/\s+/g, '_'));
  
  return [...new Set(keywords)]; // 去重
}

// 检查文件/文件夹名是否匹配模组关键词
function matchesModKeywords(name: string, keywords: string[]): boolean {
  const lowerName = name.toLowerCase();
  return keywords.some(keyword => {
    // 完全匹配
    if (lowerName === keyword) return true;
    // 开头匹配（如 "sodium" 匹配 "sodium-options.json"）
    if (lowerName.startsWith(keyword + '-') || lowerName.startsWith(keyword + '_')) return true;
    // 包含匹配（目录名）
    if (lowerName.includes(keyword)) return true;
    return false;
  });
}

// 获取文件类型
function getFileType(filename: string): 'json' | 'json5' | 'toml' | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.json5') return 'json5';
  if (ext === '.toml') return 'toml';
  return null;
}

// 递归扫描目录
interface ScannedFile {
  path: string;
  type: 'json' | 'json5' | 'toml';
}

function scanDirectory(dirPath: string, basePath: string, relativePath: string = ''): ScannedFile[] {
  const results: ScannedFile[] = [];
  
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
      results.push(...scanDirectory(fullPath, basePath, itemRelativePath));
    } else {
      // 检查是否是配置文件
      const fileType = getFileType(item);
      if (fileType) {
        results.push({
          path: itemRelativePath,
          type: fileType,
        });
      }
    }
  }
  
  return results;
}

// 扫描模组配置
export async function POST() {
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
      return NextResponse.json(
        { error: 'Config directory not found' },
        { status: 404 }
      );
    }
    
    const mods = getMods();
    const existingConfigs = getModConfigs();
    const scannedResults: Array<{
      modId: string;
      modName: string;
      files: ScannedFile[];
    }> = [];
    
    // 扫描 config 目录中的所有文件
    const allFiles = scanDirectory(configDir, configDir);
    
    for (const mod of mods) {
      const keywords = extractModKeywords(mod.name, mod.filename);
      const matchedFiles: ScannedFile[] = [];
      
      // 查找匹配的文件
      for (const file of allFiles) {
        const fileName = path.basename(file.path, path.extname(file.path));
        const dirName = path.dirname(file.path);
        
        // 检查文件名是否匹配
        if (matchesModKeywords(fileName, keywords)) {
          matchedFiles.push(file);
          continue;
        }
        
        // 检查目录名是否匹配（如果是子目录中的文件）
        if (dirName !== '.' && matchesModKeywords(dirName, keywords)) {
          matchedFiles.push(file);
        }
      }
      
      if (matchedFiles.length > 0) {
        // 检查现有的配置，保留手动关联的文件
        const existingConfig = existingConfigs.find(c => c.modId === mod.id);
        const manualFiles = existingConfig?.files.filter(f => !f.autoDetected) || [];
        
        // 合并新扫描到的文件和手动文件
        const newFiles = matchedFiles.map(f => ({
          path: f.path,
          type: f.type,
          autoDetected: true,
          linkedAt: new Date().toISOString(),
        }));
        
        // 只添加新发现的文件，保留手动文件
        const allFiles = [...manualFiles];
        for (const newFile of newFiles) {
          if (!allFiles.some(f => f.path === newFile.path)) {
            allFiles.push(newFile);
          }
        }
        
        // 更新配置
        addModConfigFile(mod.id, mod.name, {
          path: allFiles[0].path,
          type: allFiles[0].type,
          autoDetected: allFiles[0].autoDetected,
        });
        
        // 添加其他文件
        for (let i = 1; i < allFiles.length; i++) {
          addModConfigFile(mod.id, mod.name, {
            path: allFiles[i].path,
            type: allFiles[i].type,
            autoDetected: allFiles[i].autoDetected,
          });
        }
        
        scannedResults.push({
          modId: mod.id,
          modName: mod.name,
          files: matchedFiles,
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      scanned: scannedResults,
      totalFiles: allFiles.length,
    });
  } catch (error) {
    console.error('Scan mod configs error:', error);
    return NextResponse.json(
      { error: 'Failed to scan mod configs' },
      { status: 500 }
    );
  }
}

// 获取扫描预览（不保存）
export async function GET() {
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
    
    const mods = getMods();
    const preview: Array<{
      modId: string;
      modName: string;
      files: ScannedFile[];
    }> = [];
    
    // 扫描 config 目录
    const allFiles = scanDirectory(configDir, configDir);
    
    for (const mod of mods) {
      const keywords = extractModKeywords(mod.name, mod.filename);
      const matchedFiles: ScannedFile[] = [];
      
      for (const file of allFiles) {
        const fileName = path.basename(file.path, path.extname(file.path));
        const dirName = path.dirname(file.path);
        
        if (matchesModKeywords(fileName, keywords)) {
          matchedFiles.push(file);
        } else if (dirName !== '.' && matchesModKeywords(dirName, keywords)) {
          matchedFiles.push(file);
        }
      }
      
      if (matchedFiles.length > 0) {
        preview.push({
          modId: mod.id,
          modName: mod.name,
          files: matchedFiles,
        });
      }
    }
    
    return NextResponse.json({ 
      preview,
      totalFiles: allFiles.length,
    });
  } catch (error) {
    console.error('Preview mod configs error:', error);
    return NextResponse.json(
      { error: 'Failed to preview mod configs' },
      { status: 500 }
    );
  }
}

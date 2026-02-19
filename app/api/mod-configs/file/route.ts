import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import TOML from '@iarna/toml';
import JSON5 from 'json5';

// 读取配置文件
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'Missing file path' },
        { status: 400 }
      );
    }
    
    const config = getConfig();
    if (!config.path) {
      return NextResponse.json(
        { error: 'Server path not configured' },
        { status: 400 }
      );
    }
    
    // 安全检查：确保路径在 config 目录内
    const fullPath = path.join(config.path, 'config', filePath);
    const configDir = path.join(config.path, 'config');
    
    // 解析真实路径并检查是否在允许的目录内
    const resolvedPath = path.resolve(fullPath);
    const resolvedConfigDir = path.resolve(configDir);
    
    if (!resolvedPath.startsWith(resolvedConfigDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    // 解析文件内容
    let parsed: unknown = null;
    let parseError: string | null = null;
    
    try {
      if (ext === '.json') {
        parsed = JSON.parse(content);
      } else if (ext === '.json5') {
        parsed = JSON5.parse(content);
      } else if (ext === '.toml') {
        parsed = TOML.parse(content);
      }
    } catch (_e) {
      parseError = _e instanceof Error ? _e.message : 'Parse error';
    }
    
    return NextResponse.json({
      success: true,
      content,
      parsed,
      parseError,
      type: ext.replace('.', ''),
      path: filePath,
    });
  } catch (error) {
    console.error('Read config file error:', error);
    return NextResponse.json(
      { error: 'Failed to read config file' },
      { status: 500 }
    );
  }
}

// 保存配置文件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath, content, format } = body;
    
    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: 'Missing file path or content' },
        { status: 400 }
      );
    }
    
    const config = getConfig();
    if (!config.path) {
      return NextResponse.json(
        { error: 'Server path not configured' },
        { status: 400 }
      );
    }
    
    // 安全检查
    const fullPath = path.join(config.path, 'config', filePath);
    const configDir = path.join(config.path, 'config');
    
    const resolvedPath = path.resolve(fullPath);
    const resolvedConfigDir = path.resolve(configDir);
    
    if (!resolvedPath.startsWith(resolvedConfigDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    
    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 根据格式处理内容
    let finalContent = content;
    const ext = path.extname(filePath).toLowerCase();
    
    if (format === 'json' || format === 'json5' || ext === '.json' || ext === '.json5') {
      // 尝试解析并格式化 JSON/JSON5
      try {
        const parsed = JSON5.parse(content);
        if (ext === '.json5') {
          // JSON5 保持原样写入（保留注释）
          finalContent = content;
        } else {
          // JSON 格式化输出
          finalContent = JSON.stringify(parsed, null, 2);
        }
      } catch {
        // 解析失败，按原样保存
        finalContent = content;
      }
    }
    
    // 写入文件
    fs.writeFileSync(fullPath, finalContent, 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: 'File saved successfully',
    });
  } catch (error) {
    console.error('Save config file error:', error);
    return NextResponse.json(
      { error: 'Failed to save config file' },
      { status: 500 }
    );
  }
}

// 验证配置内容（预览效果）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, type } = body;
    
    if (!content || !type) {
      return NextResponse.json(
        { error: 'Missing content or type' },
        { status: 400 }
      );
    }
    
    let parsed: unknown = null;
    let error: string | null = null;
    
    try {
      if (type === 'json' || type === 'json5') {
        parsed = JSON5.parse(content);
      } else if (type === 'toml') {
        parsed = TOML.parse(content);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Parse error';
    }
    
    return NextResponse.json({
      valid: !error,
      parsed,
      error,
    });
  } catch (error) {
    console.error('Validate config error:', error);
    return NextResponse.json(
      { error: 'Failed to validate config' },
      { status: 500 }
    );
  }
}

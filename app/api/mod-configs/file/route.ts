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

// 智能替换配置值，保留注释和格式
// 支持嵌套路径如 "parent.child.key" 或 "parent[0].key"
function smartReplaceValue(
  originalContent: string,
  changes: Array<{ path: string; value: unknown }>,
  fileType: 'json' | 'json5' | 'toml'
): string {
  let result = originalContent;
  
  // 按路径深度排序，先处理深层路径（避免父路径替换影响子路径位置）
  const sortedChanges = [...changes].sort((a, b) => {
    const depthA = a.path.split(/[.\[]/).length;
    const depthB = b.path.split(/[.\[]/).length;
    return depthB - depthA;
  });
  
  for (const { path: keyPath, value } of sortedChanges) {
    result = replaceSingleValue(result, keyPath, value, fileType);
  }
  
  return result;
}

// 替换单个值
function replaceSingleValue(
  content: string,
  keyPath: string,
  value: unknown,
  fileType: 'json' | 'json5' | 'toml'
): string {
  const keys = parsePath(keyPath);
  
  if (keys.length === 0) return content;
  
  if (fileType === 'toml') {
    return replaceTomlValue(content, keys, value);
  } else {
    return replaceJsonValue(content, keys, value, fileType === 'json5');
  }
}

// 解析路径，支持 "key1.key2[0].key3" 格式
function parsePath(pathStr: string): Array<{ key: string; isArrayIndex: boolean }> {
  const keys: Array<{ key: string; isArrayIndex: boolean }> = [];
  let current = '';
  let inBracket = false;
  
  for (let i = 0; i < pathStr.length; i++) {
    const char = pathStr[i];
    
    if (char === '[') {
      if (current) {
        keys.push({ key: current, isArrayIndex: false });
        current = '';
      }
      inBracket = true;
    } else if (char === ']') {
      if (current) {
        keys.push({ key: current, isArrayIndex: true });
        current = '';
      }
      inBracket = false;
    } else if (char === '.' && !inBracket) {
      if (current) {
        keys.push({ key: current, isArrayIndex: false });
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current) {
    keys.push({ key: current, isArrayIndex: false });
  }
  
  return keys;
}

// 格式化值为目标格式
function formatValue(value: unknown, isJson5: boolean): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    // 检查是否需要引号
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value) && isJson5) {
      // JSON5 中合法的裸键可以作为字符串值
      return JSON.stringify(value);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map(v => formatValue(v, isJson5)).join(', ');
    return `[${items}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${JSON.stringify(k)}: ${formatValue(v, isJson5)}`)
      .join(', ');
    return `{${entries}}`;
  }
  return String(value);
}

// 在 JSON/JSON5 中替换值
function replaceJsonValue(
  content: string,
  keys: Array<{ key: string; isArrayIndex: boolean }>,
  value: unknown,
  isJson5: boolean
): string {
  // 尝试查找并替换
  const lines = content.split('\n');
  let found = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 尝试匹配目标键
    const matchResult = findKeyInLine(line, keys, 0);
    if (matchResult) {
      const { keyEnd } = matchResult;
      
      // 查找值的位置
      const valueMatch = line.slice(keyEnd).match(/^(\s*)/);
      if (!valueMatch) continue;
      
      const valueStart = keyEnd + valueMatch[1].length;
      const valueEnd = findValueEnd(line, valueStart);
      
      if (valueEnd > valueStart) {
        const formattedValue = formatValue(value, isJson5);
        lines[i] = line.slice(0, valueStart) + formattedValue + line.slice(valueEnd);
        found = true;
        break;
      }
    }
  }
  
  // 如果没找到，尝试更宽松的匹配（处理嵌套情况）
  if (!found) {
    return replaceNestedJsonValue(content, keys, value, isJson5);
  }
  
  return lines.join('\n');
}

// 在单行中查找键的位置
function findKeyInLine(
  line: string,
  keys: Array<{ key: string; isArrayIndex: boolean }>,
  keyIndex: number
): { keyStart: number; keyEnd: number } | null {
  if (keyIndex >= keys.length) return null;
  
  const { key, isArrayIndex } = keys[keyIndex];
  
  if (isArrayIndex) {
    // 数组索引模式
    const pattern = new RegExp(`\\[\\s*${escapeRegex(key)}\\s*\\]`);
    const match = line.match(pattern);
    if (match && match.index !== undefined) {
      return { keyStart: match.index, keyEnd: match.index + match[0].length };
    }
  } else {
    // 对象键模式 - 支持 "key": 'key': key: 等形式
    const patterns = [
      `"${escapeRegex(key)}"\\s*:`,
      `'${escapeRegex(key)}'\\s*:`,
      `\\b${escapeRegex(key)}\\s*:`
    ];
    
    for (const p of patterns) {
      const regex = new RegExp(p);
      const match = line.match(regex);
      if (match && match.index !== undefined) {
        return { keyStart: match.index, keyEnd: match.index + match[0].length };
      }
    }
  }
  
  return null;
}

// 查找值的结束位置
function findValueEnd(line: string, start: number): number {
  let i = start;
  let inString = false;
  let stringChar = '';
  let depth = 0;
  let inComment = false;
  
  while (i < line.length) {
    const char = line[i];
    
    // 检查注释
    if (!inString && !inComment) {
      if (char === '/' && line[i + 1] === '/') {
        // 行注释开始，值到此结束
        break;
      }
      if (char === '/' && line[i + 1] === '*') {
        inComment = true;
        i += 2;
        continue;
      }
    }
    
    if (inComment) {
      if (char === '*' && line[i + 1] === '/') {
        inComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    
    // 处理字符串
    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }
    } else {
      if (char === stringChar && line[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
      }
      i++;
      continue;
    }
    
    // 处理对象/数组嵌套
    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      if (depth === 0) {
        // 遇到闭合符号且不在嵌套中，值结束
        return i;
      }
      depth--;
    }
    
    // 值结束标记（仅在顶层）
    if (depth === 0 && (char === ',' || char === '}' || char === ']')) {
      // 回溯到上一个非空白字符
      let j = i - 1;
      while (j > start && /\s/.test(line[j])) j--;
      return j + 1;
    }
    
    i++;
  }
  
  // 到达行尾
  let j = line.length - 1;
  while (j > start && /\s/.test(line[j])) j--;
  return j + 1;
}

// 替换嵌套的 JSON 值（基于缩进和括号深度）
function replaceNestedJsonValue(
  content: string,
  keys: Array<{ key: string; isArrayIndex: boolean }>,
  value: unknown,
  isJson5: boolean
): string {
  const lines = content.split('\n');
  const targetKey = keys[keys.length - 1];
  const parentKeys = keys.slice(0, -1);
  
  // 跟踪当前路径
  const pathStack: string[] = [];
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 跳过空行和注释行
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    
    // 解析当前行，更新路径和深度
    let lineKey: string | null = null;
    let foundKeyAtDepth = -1;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j - 1] : '';
      
      // 处理字符串
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        continue;
      }
      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        continue;
      }
      
      // 处理括号和方括号
      if (char === '{' ) {
        braceDepth++;
      } else if (char === '}') {
        if (braceDepth === foundKeyAtDepth + 1) {
          // 离开当前键的对象
          pathStack.pop();
        }
        braceDepth--;
      } else if (char === '[') {
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth--;
      }
      
      // 检测键（只在对象内部且不在数组内）
      if (braceDepth > 0 && bracketDepth === 0 && (char === ':' || char === '=')) {
        // 向前查找键名
        const beforeColon = line.slice(0, j).trimEnd();
        const keyMatch = beforeColon.match(/["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?$/);
        if (keyMatch) {
          lineKey = keyMatch[1];
          foundKeyAtDepth = braceDepth - 1;
          
          // 更新路径栈
          while (pathStack.length > foundKeyAtDepth) {
            pathStack.pop();
          }
          pathStack[foundKeyAtDepth] = lineKey;
        }
      }
    }
    
    // 检查是否匹配目标路径
    const currentPath = pathStack.join('.');
    const targetParentPath = parentKeys.map(k => k.key).join('.');
    
    if (lineKey === targetKey.key && currentPath === (targetParentPath ? `${targetParentPath}.${targetKey.key}` : targetKey.key)) {
      // 找到目标键，进行替换
      const keyMatch = matchJsonKey(line, targetKey.key);
      if (keyMatch) {
        const { valueStart, valueEnd } = keyMatch;
        const formattedValue = formatValue(value, isJson5);
        lines[i] = line.slice(0, valueStart) + formattedValue + line.slice(valueEnd);
        return lines.join('\n');
      }
    }
  }
  
  return content;
}

// 匹配 JSON 键
function matchJsonKey(line: string, key: string): { valueStart: number; valueEnd: number } | null {
  const patterns = [
    new RegExp(`^([\\s]*)"${escapeRegex(key)}"([\\s]*:[\\s]*)`),
    new RegExp(`^([\\s]*)'${escapeRegex(key)}'([\\s]*:[\\s]*)`),
    new RegExp(`^([\\s]*)${escapeRegex(key)}([\\s]*:[\\s]*)`)
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const valueStart = match[0].length;
      const valueEnd = findValueEnd(line, valueStart);
      return { valueStart, valueEnd };
    }
  }
  
  return null;
}

// 转义正则特殊字符
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 在 TOML 中替换值
function replaceTomlValue(
  content: string,
  keys: Array<{ key: string; isArrayIndex: boolean }>,
  value: unknown
): string {
  const lines = content.split('\n');
  
  if (keys.length === 0) return content;
  
  const targetKey = keys[keys.length - 1];
  const parentKeys = keys.slice(0, -1);
  
  // 构建目标 section 路径（只使用非数组索引的键）
  const targetSectionPath = parentKeys.filter(k => !k.isArrayIndex).map(k => k.key);
  
  // 判断是否在 section 中
  let inTargetSection = targetSectionPath.length === 0;
  let currentSection: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 检查 section
    const sectionMatch = trimmed.match(/^\[\[?\s*([^\]]+)\s*\]\]?$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      currentSection = sectionName.split('.').map(s => s.trim());
      
      // 检查是否进入目标 section
      inTargetSection = targetSectionPath.length > 0 &&
        targetSectionPath.length === currentSection.length &&
        targetSectionPath.every((k, idx) => k === currentSection[idx]);
      continue;
    }
    
    // 在目标 section 中查找键
    // 对于无 section 的键（targetSectionPath.length === 0），只在没有 section 的区域查找
    // 对于带 section 的键，必须在正确的 section 中
    const shouldSearch = targetSectionPath.length === 0 
      ? currentSection.length === 0 // 无 section 键：只在无 section 区域查找
      : inTargetSection;            // 有 section 键：在目标 section 中查找
    
    if (shouldSearch) {
      const keyMatch = matchTomlKey(line, targetKey.key);
      if (keyMatch) {
        const { valueStart, valueEnd } = keyMatch;
        const formattedValue = formatTomlValue(value);
        lines[i] = line.slice(0, valueStart) + formattedValue + line.slice(valueEnd);
        return lines.join('\n');
      }
    }
  }
  
  return content;
}

// 匹配 section
// 匹配 TOML 键
function matchTomlKey(line: string, key: string): { valueStart: number; valueEnd: number } | null {
  // TOML 键模式: key = , "key" = , 'key' =
  // 使用捕获组捕获等号后的空白，以便正确定位值开始位置
  const patterns = [
    `^\\s*(?:["']?)${escapeRegex(key)}(?:["']?)\\s*=(\\s*)`,
    `^\\s*${escapeRegex(key)}\\s*=(\\s*)`
  ];
  
  for (const p of patterns) {
    const regex = new RegExp(p);
    const match = line.match(regex);
    if (match && match.index !== undefined) {
      // match[0] 包含键、等号和等号后的空白
      // match[1] 是等号后的空白
      // 值开始位置应该是 match[0] 的末尾（在等号后的空白之后）
      const valueStart = match.index + match[0].length;
      const valueEnd = findTomlValueEnd(line, valueStart);
      return { valueStart, valueEnd };
    }
  }
  
  return null;
}

// 查找 TOML 值的结束位置
function findTomlValueEnd(line: string, start: number): number {
  let i = start;
  let inString = false;
  let stringChar = '';
  let inArray = false;
  let inInlineTable = false;
  
  while (i < line.length) {
    const char = line[i];
    
    // 检查注释
    if (!inString && char === '#') {
      break;
    }
    
    // 处理字符串
    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        // 检查多行字符串
        if (line.slice(i, i + 3) === char.repeat(3)) {
          // 多行字符串，跳到结束
          const endPattern = char.repeat(3);
          const endIdx = line.indexOf(endPattern, i + 3);
          if (endIdx !== -1) {
            return endIdx + 3;
          }
          return line.length;
        }
        i++;
        continue;
      }
    } else {
      if (char === stringChar) {
        // 检查是否是转义
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && line[j] === '\\') {
          backslashCount++;
          j--;
        }
        if (backslashCount % 2 === 0) {
          inString = false;
          stringChar = '';
        }
      }
      i++;
      continue;
    }
    
    // 处理数组
    if (char === '[' && !inInlineTable) {
      inArray = true;
    } else if (char === ']' && inArray) {
      inArray = false;
    }
    
    // 处理内联表
    if (char === '{') {
      inInlineTable = true;
    } else if (char === '}' && inInlineTable) {
      inInlineTable = false;
    }
    
    // 值结束标记
    if (!inString && !inArray && !inInlineTable) {
      if (char === ',' || char === '#' || char === '}') {
        // 回溯到上一个非空白字符
        let j = i - 1;
        while (j > start && /\s/.test(line[j])) j--;
        return j + 1;
      }
    }
    
    i++;
  }
  
  // 到达行尾
  let j = line.length - 1;
  while (j > start && /\s/.test(line[j])) j--;
  return j + 1;
}

// 格式化 TOML 值
function formatTomlValue(value: unknown): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map(v => formatTomlValue(v)).join(', ');
    return `[${items}]`;
  }
  if (typeof value === 'object') {
    // 内联表
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k} = ${formatTomlValue(v)}`)
      .join(', ');
    return `{${entries}}`;
  }
  return String(value);
}

// 创建备份文件
function createBackup(filePath: string): string | null {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(filePath), '.backups');
    const backupName = `${path.basename(filePath)}.${timestamp}.bak`;
    const backupPath = path.join(backupDir, backupName);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.copyFileSync(filePath, backupPath);
    
    // 清理旧备份（保留最近 10 个）
    try {
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(path.basename(filePath)) && f.endsWith('.bak'))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (backups.length > 10) {
        backups.slice(10).forEach(b => {
          try { fs.unlinkSync(b.path); } catch { /* ignore */ }
        });
      }
    } catch { /* ignore cleanup errors */ }
    
    return backupPath;
  } catch (err) {
    console.warn('Failed to create backup:', err);
    return null;
  }
}

// 验证配置内容
function validateConfig(content: string, fileType: string): { valid: boolean; error?: string } {
  try {
    if (fileType === 'json' || fileType === 'json5') {
      JSON5.parse(content);
    } else if (fileType === 'toml') {
      TOML.parse(content);
    }
    return { valid: true };
  } catch (e) {
    return { 
      valid: false, 
      error: e instanceof Error ? e.message : 'Parse error' 
    };
  }
}

// 保存配置文件
export async function POST(request: NextRequest) {
  let tempFile: string | null = null;
  
  try {
    const body = await request.json();
    const { path: filePath, content, format, changes, useSmartReplace, originalContent: providedOriginal } = body;
    
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
    
    const ext = path.extname(filePath).toLowerCase();
    const fileType = format || ext.replace('.', '');
    
    // 确定基础内容
    let baseContent: string;
    let isNewFile = false;
    
    if (fs.existsSync(fullPath)) {
      // 文件已存在，读取原内容或使用提供的原内容
      baseContent = providedOriginal ?? fs.readFileSync(fullPath, 'utf-8');
    } else {
      // 新文件
      isNewFile = true;
      baseContent = content ?? '';
    }
    
    // 确定最终内容
    let finalContent: string;
    
    if (useSmartReplace && changes && Array.isArray(changes) && changes.length > 0 && !isNewFile) {
      // 智能替换模式：基于原内容应用变更
      try {
        const actualFileType = (fileType === 'json5' || fileType === 'json') ? 'json' : 'toml';
        finalContent = smartReplaceValue(baseContent, changes, actualFileType as 'json' | 'toml');
      } catch (err) {
        console.warn('Smart replace failed:', err);
        // 智能替换失败，如果有提供 content 则使用，否则报错
        if (content === undefined) {
          return NextResponse.json(
            { error: 'Smart replace failed and no fallback content provided' },
            { status: 500 }
          );
        }
        finalContent = content;
      }
    } else if (content !== undefined) {
      // 直接覆盖模式
      finalContent = content;
    } else {
      return NextResponse.json(
        { error: 'No content provided for new file' },
        { status: 400 }
      );
    }
    
    // 验证内容格式
    const validation = validateConfig(finalContent, fileType);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid ${fileType.toUpperCase()} format: ${validation.error}` },
        { status: 400 }
      );
    }
    
    // 为现有文件创建备份
    let backupPath: string | null = null;
    if (!isNewFile && fs.existsSync(fullPath)) {
      backupPath = createBackup(fullPath);
    }
    
    // 事务性保存：先写入临时文件，再重命名
    tempFile = `${fullPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, finalContent, 'utf-8');
    
    // 原子性替换
    fs.renameSync(tempFile, fullPath);
    tempFile = null; // 标记为已处理
    
    return NextResponse.json({
      success: true,
      message: 'File saved successfully',
      backup: backupPath,
      content: finalContent, // 返回保存的内容，避免前端重新请求
    });
  } catch (error) {
    // 清理临时文件
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
    }
    
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

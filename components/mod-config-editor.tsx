'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  AlertCircle, 
  Save, 
  RotateCcw, 
  FileJson, 
  FileCode, 
  FileType,
  ChevronRight,
  Type,
  Hash,
  ToggleLeft,
  Braces,
  Eye,
  Code,
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  fadeIn, 
  arrayItemEnter,
  easings,
} from '@/lib/animations';

// 配置值类型
interface ConfigValue {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  path: string;
  depth: number;
}

// 配置文件编辑器属性
interface ModConfigEditorProps {
  modId: string;
  modName: string;
  filePath: string;
  fileType: 'json' | 'json5' | 'toml';
  onClose?: () => void;
  onSave?: () => void;
}

// 文件类型图标
const FileTypeIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'json':
    case 'json5':
      return <FileJson className={className} />;
    case 'toml':
      return <FileCode className={className} />;
    default:
      return <FileType className={className} />;
  }
};

// 值类型图标
const ValueTypeIcon = ({ type }: { type: ConfigValue['type'] }) => {
  switch (type) {
    case 'string':
      return <Type className="w-4 h-4" />;
    case 'number':
      return <Hash className="w-4 h-4" />;
    case 'boolean':
      return <ToggleLeft className="w-4 h-4" />;
    case 'object':
    case 'array':
      return <Braces className="w-4 h-4" />;
    default:
      return null;
  }
};

// 值类型颜色
const getTypeColor = (type: ConfigValue['type']) => {
  switch (type) {
    case 'string':
      return 'text-emerald-400';
    case 'number':
      return 'text-blue-400';
    case 'boolean':
      return 'text-purple-400';
    case 'object':
    case 'array':
      return 'text-amber-400';
    default:
      return 'text-gray-500';
  }
};

// 值类型背景色（更柔和）
const getTypeBgColor = (type: ConfigValue['type']) => {
  switch (type) {
    case 'string':
      return 'bg-emerald-500/5 border-emerald-500/10';
    case 'number':
      return 'bg-blue-500/5 border-blue-500/10';
    case 'boolean':
      return 'bg-purple-500/5 border-purple-500/10';
    case 'object':
    case 'array':
      return 'bg-amber-500/5 border-amber-500/10';
    default:
      return 'bg-[#1a1a1a] border-[#2a2a2a]';
  }
};

// 解析带引号的 TOML 键（支持 "key" 或 'key'）
function parseQuotedKey(str: string): string | null {
  str = str.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || 
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return null;
}

// 检测行是否为键定义行，返回键名、完整路径和缩进层级
// 支持嵌套 section 如 [M.m] -> key='m', fullPath=['M', 'm']
// 支持带引号的 section 如 ["YUNG's Better Dungeons".General]
function parseKeyLine(line: string): { 
  key: string; 
  fullPath: string[];
  indent: number; 
  isSection: boolean;
  isNestedSection: boolean;
} | null {
  const indent = line.length - line.trimStart().length;
  const trimmed = line.trim();
  
  // TOML section: [key] 或 [[key]] 或 [a.b.c] 或 ["quoted.key"]
  const sectionMatch = trimmed.match(/^\[\[?\s*([^\]]+)\s*\]\]?$/);
  if (sectionMatch) {
    const sectionContent = sectionMatch[1].trim();
    
    // 解析 section 中的各个部分（支持带引号的键）
    const pathParts: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < sectionContent.length; i++) {
      const char = sectionContent[i];
      
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
          if (current.trim()) {
            pathParts.push(current.trim());
            current = '';
          }
          current = char;
        } else if (char === '.') {
          if (current.trim()) {
            pathParts.push(current.trim());
            current = '';
          }
        } else {
          current += char;
        }
      } else {
        current += char;
        if (char === stringChar && sectionContent[i - 1] !== '\\') {
          inString = false;
          // 完整引号字符串，去除引号后添加
          const quoted = current.trim();
          const unquoted = parseQuotedKey(quoted);
          if (unquoted !== null) {
            pathParts.push(unquoted);
          } else {
            pathParts.push(quoted);
          }
          current = '';
        }
      }
    }
    
    // 处理剩余部分
    if (current.trim()) {
      const remaining = current.trim();
      const unquoted = parseQuotedKey(remaining);
      pathParts.push(unquoted !== null ? unquoted : remaining);
    }
    
    const key = pathParts[pathParts.length - 1] || '';
    return { 
      key, 
      fullPath: pathParts,
      indent, 
      isSection: true,
      isNestedSection: pathParts.length > 1
    };
  }
  
  // JSON: "key": 或 "key" :
  const jsonMatch = trimmed.match(/^"([^"]+)"\s*:/);
  if (jsonMatch) {
    return { key: jsonMatch[1], fullPath: [jsonMatch[1]], indent, isSection: false, isNestedSection: false };
  }
  
  // JSON5/TOML: 'key': 或 "key" = 或 key: 或 key =
  const json5Match = trimmed.match(/^'([^']+)'\s*[:=]/);
  if (json5Match) {
    return { key: json5Match[1], fullPath: [json5Match[1]], indent, isSection: false, isNestedSection: false };
  }
  
  // TOML: "key" = (双引号键，前面未被 JSON 模式捕获的情况)
  const tomlQuotedMatch = trimmed.match(/^"([^"]+)"\s*=/);
  if (tomlQuotedMatch) {
    return { key: tomlQuotedMatch[1], fullPath: [tomlQuotedMatch[1]], indent, isSection: false, isNestedSection: false };
  }
  
  // Bare key (JSON5/TOML): key: 或 key = (但排除 true/false/null/数字)
  const bareMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]/);
  if (bareMatch) {
    const key = bareMatch[1];
    // 排除关键字和数字
    if (!/^(true|false|null|undefined)$/.test(key)) {
      return { key, fullPath: [key], indent, isSection: false, isNestedSection: false };
    }
  }
  
  return null;
}

// 检测行是否为注释行
function parseCommentLine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return trimmed.slice(trimmed.startsWith('//') ? 2 : 1).trim();
  }
  if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return trimmed
      .replace(/^\/\*/, '')
      .replace(/^\*\s*/, '')
      .replace(/\*\/$/, '')
      .trim();
  }
  return null;
}

// 转义正则表达式特殊字符
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 从行内注释提取描述（如 key = value # 注释）
function extractInlineComment(line: string, fileType: 'json' | 'json5' | 'toml'): string | null {
  const trimmed = line.trim();
  
  // JSON5/JavaScript 风格行内注释
  if (fileType === 'json5' || fileType === 'json') {
    const lineCommentIdx = trimmed.indexOf('//');
    if (lineCommentIdx > 0) {
      return trimmed.slice(lineCommentIdx + 2).trim();
    }
  }
  
  // TOML 风格行内注释
  if (fileType === 'toml') {
    const hashIdx = trimmed.indexOf('#');
    if (hashIdx > 0) {
      // 确保 # 不在字符串内
      let inString = false;
      let stringChar = '';
      for (let i = 0; i < hashIdx; i++) {
        const char = trimmed[i];
        if (!inString && (char === '"' || char === "'")) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          // 检查转义
          let backslashCount = 0;
          let j = i - 1;
          while (j >= 0 && trimmed[j] === '\\') {
            backslashCount++;
            j--;
          }
          if (backslashCount % 2 === 0) {
            inString = false;
          }
        }
      }
      if (!inString) {
        return trimmed.slice(hashIdx + 1).trim();
      }
    }
  }
  
  return null;
}

// 从注释提取描述（支持层级感知，包括嵌套 section）
function extractDescription(
  content: string, 
  key: string, 
  parentPath: string = '',
  fileType: 'json' | 'json5' | 'toml' = 'json'
): string | undefined {
  const lines = content.split('\n');
  
  // 构建目标路径数组
  const targetKeys = parentPath ? [...parentPath.split('.'), key] : [key];
  
  // 跟踪当前解析的层级结构（存储完整路径）
  const sectionStack: { keys: string[]; indent: number; lineIndex: number }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseKeyLine(line);
    
    if (parsed) {
      // 处理嵌套 section [M.m] -> fullPath=['M', 'm']
      // 这种情况下，需要基于 fullPath 调整栈
      if (parsed.isSection && parsed.isNestedSection) {
        // 嵌套 section：根据 fullPath 长度调整栈
        while (sectionStack.length >= parsed.fullPath.length) {
          sectionStack.pop();
        }
      } else if (parsed.isSection) {
        // 普通 section：根据缩进调整
        while (sectionStack.length > 0 && parsed.indent <= sectionStack[sectionStack.length - 1].indent) {
          sectionStack.pop();
        }
      } else {
        // 普通键：根据缩进调整
        while (sectionStack.length > 0 && parsed.indent <= sectionStack[sectionStack.length - 1].indent) {
          sectionStack.pop();
        }
      }
      
      // 构建当前完整路径
      let currentKeys: string[];
      if (parsed.isSection && parsed.isNestedSection) {
        // 嵌套 section 使用其完整路径
        currentKeys = parsed.fullPath;
      } else {
        // 普通键或 section 基于栈构建路径
        const parentKeys = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].keys : [];
        currentKeys = [...parentKeys, parsed.key];
      }
      
      // 检查是否匹配目标路径
      if (currentKeys.length === targetKeys.length) {
        let matches = true;
        for (let k = 0; k < targetKeys.length; k++) {
          if (currentKeys[k] !== targetKeys[k]) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          // 找到目标键，首先尝试提取行内注释
          const inlineComment = extractInlineComment(line, fileType);
          
          // 向前查找独立注释
          const descriptionLines: string[] = [];
          const currentIndent = parsed.indent;
          
          for (let j = i - 1; j >= 0; j--) {
            const prevLine = lines[j];
            const prevTrimmed = prevLine.trim();
            
            // 跳过空行（但记录是否开始收集）
            if (prevTrimmed === '') {
              if (descriptionLines.length > 0) {
                break;
              }
              continue;
            }
            
            // 检查是否为注释
            const comment = parseCommentLine(prevLine);
            if (comment !== null) {
              if (!comment.startsWith('===') && !comment.startsWith('---')) {
                descriptionLines.unshift(comment);
              }
              continue;
            }
            
            // 检查是否为其他键定义
            const prevParsed = parseKeyLine(prevLine);
            if (prevParsed) {
              const prevIndent = prevLine.length - prevLine.trimStart().length;
              
              if (prevParsed.isSection) {
                // TOML section 总是停止
                break;
              }
              
              // 根据缩进判断边界
              if (prevIndent < currentIndent) {
                break;
              }
              
              if (prevIndent === currentIndent) {
                break;
              }
            }
            
            // 其他非注释内容，停止
            break;
          }
          
          // 合并独立注释和行内注释
          const allComments: string[] = [];
          if (descriptionLines.length > 0) {
            allComments.push(...descriptionLines);
          }
          if (inlineComment) {
            allComments.push(inlineComment);
          }
          
          if (allComments.length > 0) {
            return allComments.join('\n');
          }
        }
      }
      
      // 压入栈
      sectionStack.push({ keys: currentKeys, indent: parsed.indent, lineIndex: i });
    }
  }
  
  return undefined;
}

// 递归提取所有配置值
function extractConfigValues(
  obj: unknown, 
  content: string,
  path: string = '', 
  depth: number = 0,
  isArrayElement: boolean = false,
  fileType: 'json' | 'json5' | 'toml' = 'json'
): ConfigValue[] {
  const results: ConfigValue[] = [];
  
  if (obj === null) {
    return [{ key: path, value: null, type: 'null', path, depth }];
  }
  
  // 处理基本类型（作为数组元素时）
  if (typeof obj !== 'object') {
    const key = path.match(/\[([^\]]+)\]$/)?.[1] || path;
    return [{
      key,
      value: obj,
      type: typeof obj as ConfigValue['type'],
      path,
      depth,
    }];
  }
  
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    // 如果是数组中的对象元素，先添加对象本身作为配置项
    if (isArrayElement) {
      const key = path.match(/\[([^\]]+)\]$/)?.[1] || path;
      results.push({
        key,
        value: obj,
        type: 'object',
        path,
        depth,
      });
    }
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = path ? `${path}.${key}` : key;
      const type = Array.isArray(value) ? 'array' : 
                   value === null ? 'null' : 
                   typeof value as ConfigValue['type'];
      
      // 传递父路径用于层级感知的注释提取
      const parentPath = path;
      
      results.push({
        key,
        value,
        type,
        description: extractDescription(content, key, parentPath, fileType),
        path: currentPath,
        depth: isArrayElement ? depth + 1 : depth,
      });
      
      if (typeof value === 'object' && value !== null) {
        results.push(...extractConfigValues(value, content, currentPath, isArrayElement ? depth + 1 : depth + 1, false, fileType));
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const currentPath = `${path}[${index}]`;
      const itemType = Array.isArray(item) ? 'array' :
                       item === null ? 'null' :
                       typeof item as ConfigValue['type'];
      
      // 注意：这里的 depth 已经是父级的 depth + 1（从递归调用传入）
      // 所以数组元素应该使用当前的 depth，不需要再 +1
      if (typeof item !== 'object' || item === null) {
        results.push({
          key: String(index),
          value: item,
          type: itemType,
          path: currentPath,
          depth,
        });
      } else {
        // 对象或嵌套数组，标记为数组元素以便正确处理
        results.push(...extractConfigValues(item, content, currentPath, depth, true, fileType));
      }
    });
  }
  
  return results;
}

// 配置项编辑器 - 优化排版版本
interface ConfigItemEditorProps {
  config: ConfigValue;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  onArrayChange?: (path: string, action: 'add' | 'remove', index?: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
  childConfigs?: ConfigValue[];
  expandedPaths?: Set<string>;
  toggleExpanded?: (path: string) => void;
  allConfigValues?: ConfigValue[];
  isArrayItem?: boolean;
  isLastArrayItem?: boolean;
  isModified?: boolean;
  checkModified?: (path: string) => boolean;
}

const ConfigItemEditor = ({ 
  config, 
  value, 
  onChange, 
  onArrayChange,
  isExpanded, 
  onToggle, 
  childConfigs = [],
  expandedPaths = new Set(),
  toggleExpanded = () => {},
  allConfigValues = [],
  isArrayItem = false,
  isLastArrayItem = false,
  isModified = false,
  checkModified = () => false
}: ConfigItemEditorProps) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = (newValue: unknown) => {
    setLocalValue(newValue);
    onChange(config.path, newValue);
  };
  
  const hasChildren = config.type === 'object' || config.type === 'array';
  const childrenCount = hasChildren 
    ? (Array.isArray(value) ? (value as unknown[]).length : Object.keys(value as object).length)
    : 0;
  
  // 渲染值编辑器 - 统一的控件样式
  const renderEditor = () => {
    switch (config.type) {
      case 'boolean':
        return (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleChange(!localValue)}
            className={cn(
              'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0',
              localValue ? 'bg-emerald-500' : 'bg-[#3a3a3a]'
            )}
          >
            <motion.div
              className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ 
                x: localValue ? 20 : 0 
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.8 }}
            />
          </motion.button>
        );
        
      case 'number':
        return (
          <div className="relative flex-shrink-0">
            <input
              type="text"
              inputMode="numeric"
              value={String(localValue ?? '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || val === '-') {
                  handleChange(val);
                } else {
                  const num = Number(val);
                  if (!isNaN(num)) {
                    handleChange(num);
                  }
                }
              }}
              onFocus={() => setIsEditing(true)}
              onBlur={() => {
                setIsEditing(false);
                const num = Number(localValue);
                if (!isNaN(num) && localValue !== '') {
                  handleChange(num);
                }
              }}
              className={cn(
                'px-3 py-2 rounded-md bg-[#141414] border text-base font-mono w-32 h-9',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
                'transition-all duration-200 text-right',
                isEditing ? 'border-emerald-500 text-white' : 'border-[#2a2a2a] text-blue-400'
              )}
            />
          </div>
        );
        
      case 'string':
        return (
          <div className="relative flex-1 min-w-0 max-w-md">
            <input
              type="text"
              value={String(localValue ?? '')}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
              className={cn(
                'w-full px-3 py-2 rounded-md bg-[#141414] border text-base h-9',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
                'transition-all duration-200',
                isEditing ? 'border-emerald-500 text-white' : 'border-[#2a2a2a] text-emerald-400'
              )}
            />
          </div>
        );
        
      default:
        return (
          <span className="text-[#707070] text-base italic px-3 py-2">
            {Array.isArray(localValue) ? `[${(localValue as unknown[]).length} 项]` : 
             typeof localValue === 'object' ? `{${Object.keys(localValue || {}).length} 个键}` : 
             String(localValue)}
          </span>
        );
    }
  };
  
  // 高亮注释中的数字
  const highlightNumbersInText = (text: string): React.ReactNode => {
    const parts = text.split(/(\d+)/);
    return parts.map((part, i) => {
      if (/^\d+$/.test(part)) {
        return (
          <span key={i} className="text-blue-400 font-medium">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };
  
  // 渲染对象/数组的展开头部
  if (hasChildren) {
    // 将描述按换行分割
    const descriptionLines = config.description ? config.description.split('\n') : [];
    
    // 根据类型获取对应的颜色
    const getModifiedColors = () => {
      switch (config.type) {
        case 'string':
          return {
            border: 'border-emerald-500/50',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.1)',
            bg: 'rgba(16, 185, 129, 0.08)',
            indicator: 'from-emerald-400 via-emerald-500 to-emerald-400',
            glow: 'from-emerald-500/50 via-emerald-400/30 to-transparent',
          };
        case 'number':
          return {
            border: 'border-blue-500/50',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)',
            bg: 'rgba(59, 130, 246, 0.08)',
            indicator: 'from-blue-400 via-blue-500 to-blue-400',
            glow: 'from-blue-500/50 via-blue-400/30 to-transparent',
          };
        case 'boolean':
          return {
            border: 'border-purple-500/50',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.1)',
            bg: 'rgba(139, 92, 246, 0.08)',
            indicator: 'from-purple-400 via-purple-500 to-purple-400',
            glow: 'from-purple-500/50 via-purple-400/30 to-transparent',
          };
        case 'object':
        case 'array':
          return {
            border: 'border-amber-500/50',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.15), 0 0 0 1px rgba(245, 158, 11, 0.1)',
            bg: 'rgba(245, 158, 11, 0.08)',
            indicator: 'from-amber-400 via-amber-500 to-amber-400',
            glow: 'from-amber-500/50 via-amber-400/30 to-transparent',
          };
        default:
          return {
            border: 'border-gray-500/50',
            boxShadow: '0 0 20px rgba(107, 114, 128, 0.15), 0 0 0 1px rgba(107, 114, 128, 0.1)',
            bg: 'rgba(107, 114, 128, 0.08)',
            indicator: 'from-gray-400 via-gray-500 to-gray-400',
            glow: 'from-gray-500/50 via-gray-400/30 to-transparent',
          };
      }
    };
    
    const modifiedColors = getModifiedColors();
    
    return (
      <div
        className="group"
        style={{ marginLeft: `${config.depth * 16}px` }}
      >
        {/* 父级项 - 卡片样式 */}
        <motion.div 
          className={cn(
            'rounded-lg border overflow-hidden relative',
            getTypeBgColor(config.type),
            isExpanded ? 'border-opacity-50' : 'hover:border-opacity-30',
            isModified && modifiedColors.border
          )}
          initial={false}
          animate={isModified ? {
            backgroundColor: modifiedColors.bg,
            boxShadow: modifiedColors.boxShadow,
          } : {
            backgroundColor: 'rgba(0, 0, 0, 0)',
            boxShadow: isExpanded 
              ? '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' 
              : '0 0 0 0 rgba(0, 0, 0, 0)',
          }}
          transition={{ 
            duration: 0.4, 
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          {/* 未保存指示器 - 渐变发光效果 */}
          {isModified && (
            <>
              {/* 左侧主指示条 */}
              <motion.div 
                className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", modifiedColors.indicator)}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
              {/* 顶部微光 */}
              <motion.div 
                className={cn("absolute left-0 right-0 top-0 h-px bg-gradient-to-r", modifiedColors.glow)}
                initial={{ opacity: 0, x: '-100%' }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              />
            </>
          )}
          {/* 头部 - 可点击展开，使用 flex 布局容纳删除按钮 */}
          <div className="flex items-center">
            <button
              onClick={onToggle}
              className="flex-1 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* 展开指示器 */}
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 text-[#707070] mt-1"
                >
                  <ChevronRight className="w-5 h-5" />
                </motion.div>
                
                {/* 类型图标 */}
                <div className={cn('flex-shrink-0 mt-1', getTypeColor(config.type))}>
                  <ValueTypeIcon type={config.type} />
                </div>
                
                {/* 键名和描述 */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  {/* 键名和数量标签 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'font-semibold text-base',
                      config.depth === 0 ? 'text-white' : 'text-[#b0b0b0]'
                    )}>
                      {/* 检测是否为数组中的对象元素（路径以 [数字] 结尾） */}
                      {/^\[\d+\]$/.test(config.key) ? `项目 ${config.key.slice(1, -1)}` : config.key}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs px-2 py-0 h-5 border-0 font-normal flex-shrink-0',
                        getTypeBgColor(config.type),
                        getTypeColor(config.type)
                      )}
                    >
                      {childrenCount} 项
                    </Badge>
                  </div>
                  
                  {/* 描述 - 完整展示，保留换行 */}
                  {descriptionLines.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {descriptionLines.map((line, index) => (
                        <p 
                          key={index} 
                          className="text-sm text-[#808080] leading-relaxed whitespace-pre-wrap break-words text-left"
                        >
                          {line ? highlightNumbersInText(line) : '\u00A0'}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
            
            {/* 数组元素删除按钮 - 只有最后一项可以删除 */}
            {isArrayItem && onArrayChange && (
              <motion.button
                whileHover={{ scale: isLastArrayItem ? 1.1 : 1 }}
                whileTap={{ scale: isLastArrayItem ? 0.9 : 1 }}
                onClick={() => {
                  if (!isLastArrayItem) return;
                  // 从路径中提取索引，如 "parent[0]" -> 0
                  const match = config.path.match(/\[(\d+)\]$/);
                  if (match) {
                    const parentPath = config.path.slice(0, config.path.lastIndexOf('['));
                    onArrayChange(parentPath, 'remove', parseInt(match[1], 10));
                  }
                }}
                className={cn(
                  'p-2 mr-3 rounded-md flex-shrink-0',
                  isLastArrayItem 
                    ? 'text-[#707070] hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200' 
                    : 'pointer-events-none bg-transparent'
                )}
                title={isLastArrayItem ? "删除此项" : undefined}
              >
                <motion.span
                  initial={isLastArrayItem ? { opacity: 0, scale: 0.5 } : false}
                  animate={isLastArrayItem ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.span>
              </motion.button>
            )}
          </div>
          
          {/* 子项展开区域 */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: easings.standard }}
                className="overflow-hidden"
              >
                {/* 子项容器 - 带左边框表示层级 */}
                <div className="px-4 pb-4">
                  <div className="relative pl-4 border-l-2 border-[#2a2a2a]">
                    <AnimatePresence initial={false}>
                      {childConfigs.map((childConfig) => {
                        // 计算子节点的子配置项
                        // 支持对象属性 (parent.key) 和数组元素 (parent[0]) 两种路径格式
                        const grandChildConfigs = allConfigValues.filter(
                          c => {
                            const isDirectChild = c.depth === childConfig.depth + 1;
                            if (!isDirectChild) return false;
                            // 对象属性: parent.child (确保是直接的子属性)
                            if (c.path.startsWith(childConfig.path + '.')) {
                              const remaining = c.path.slice((childConfig.path + '.').length);
                              return !remaining.includes('.') && !remaining.includes('[');
                            }
                            // 数组元素: parent[0] (确保是直接的数组元素)
                            if (c.path.startsWith(childConfig.path + '[')) {
                              const remaining = c.path.slice(childConfig.path.length);
                              return /^\[\d+\]$/.test(remaining);
                            }
                            return false;
                          }
                        );
                        const hasGrandChildren = grandChildConfigs.length > 0;
                        
                        // 判断是否为数组类型
                        const isArray = config.type === 'array';
                        
                        // 计算编辑器元素
                        // 提取数组索引以判断是否为最后一项
                        const arrayIndexMatch = childConfig.path.match(/\[(\d+)\]$/);
                        const arrayIndex = arrayIndexMatch ? parseInt(arrayIndexMatch[1], 10) : -1;
                        const isLastItem = isArray && arrayIndex === childrenCount - 1;
                        
                        const editorProps = {
                          config: childConfig,
                          value: childConfig.value,
                          onChange,
                          onArrayChange,
                          isExpanded: expandedPaths.has(childConfig.path),
                          onToggle: () => toggleExpanded(childConfig.path),
                          childConfigs: hasGrandChildren ? grandChildConfigs : [],
                          expandedPaths,
                          toggleExpanded,
                          allConfigValues,
                          isArrayItem: isArray,
                          isLastArrayItem: isLastItem,
                          isModified: checkModified(childConfig.path),
                          checkModified,
                        };
                        
                        // 只为数组类型的子项添加动画
                        if (config.type === 'array') {
                          return (
                            <motion.div
                              key={childConfig.path}
                              variants={arrayItemEnter}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="will-change-transform overflow-hidden"
                              style={{ transformOrigin: 'center top', marginBottom: 8 }}
                            >
                              <ConfigItemEditor {...editorProps} />
                            </motion.div>
                          );
                        }
                        
                        return (
                          <div key={childConfig.path} className="mb-2">
                            <ConfigItemEditor {...editorProps} />
                          </div>
                        );
                      })}
                    </AnimatePresence>
                    
                    {/* 数组添加按钮 */}
                    {config.type === 'array' && onArrayChange && (
                      <motion.button
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onArrayChange(config.path, 'add')}
                        className="w-full py-2.5 px-4 rounded-lg border border-dashed border-[#3a3a3a] 
                                   text-[#707070] hover:text-emerald-400 hover:border-emerald-500/30 
                                   hover:bg-emerald-500/5 transition-colors duration-200
                                   flex items-center justify-center gap-2 text-sm mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>添加项</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }
  
  // 渲染叶节点（基本类型）- 完整描述展示
  // 将描述按换行分割
  const descriptionLines = config.description ? config.description.split('\n') : [];
  
  // 根据类型获取对应的颜色
  const getModifiedColors = () => {
    switch (config.type) {
      case 'string':
        return {
          border: 'border-emerald-500/50',
          boxShadow: '0 0 16px rgba(16, 185, 129, 0.12), 0 0 0 1px rgba(16, 185, 129, 0.08)',
          bg: 'rgba(16, 185, 129, 0.06)',
          indicator: 'from-emerald-400 via-emerald-500 to-emerald-400',
          glow: 'from-emerald-500/50 via-emerald-400/30 to-transparent',
        };
      case 'number':
        return {
          border: 'border-blue-500/50',
          boxShadow: '0 0 16px rgba(59, 130, 246, 0.12), 0 0 0 1px rgba(59, 130, 246, 0.08)',
          bg: 'rgba(59, 130, 246, 0.06)',
          indicator: 'from-blue-400 via-blue-500 to-blue-400',
          glow: 'from-blue-500/50 via-blue-400/30 to-transparent',
        };
      case 'boolean':
        return {
          border: 'border-purple-500/50',
          boxShadow: '0 0 16px rgba(139, 92, 246, 0.12), 0 0 0 1px rgba(139, 92, 246, 0.08)',
          bg: 'rgba(139, 92, 246, 0.06)',
          indicator: 'from-purple-400 via-purple-500 to-purple-400',
          glow: 'from-purple-500/50 via-purple-400/30 to-transparent',
        };
      case 'object':
      case 'array':
        return {
          border: 'border-amber-500/50',
          boxShadow: '0 0 16px rgba(245, 158, 11, 0.12), 0 0 0 1px rgba(245, 158, 11, 0.08)',
          bg: 'rgba(245, 158, 11, 0.06)',
          indicator: 'from-amber-400 via-amber-500 to-amber-400',
          glow: 'from-amber-500/50 via-amber-400/30 to-transparent',
        };
      default:
        return {
          border: 'border-gray-500/50',
          boxShadow: '0 0 16px rgba(107, 114, 128, 0.12), 0 0 0 1px rgba(107, 114, 128, 0.08)',
          bg: 'rgba(107, 114, 128, 0.06)',
          indicator: 'from-gray-400 via-gray-500 to-gray-400',
          glow: 'from-gray-500/50 via-gray-400/30 to-transparent',
        };
    }
  };
  
  const modifiedColors = getModifiedColors();
  
  return (
    <div
      className="group"
      style={{ marginLeft: `${config.depth * 16}px` }}
    >
      <motion.div 
        className={cn(
          'flex items-start gap-3 px-4 py-3.5 rounded-lg border relative',
          'hover:border-[#3a3a3a] hover:bg-white/[0.02]',
          getTypeBgColor(config.type),
          isModified && modifiedColors.border
        )}
        initial={false}
        animate={isModified ? {
          backgroundColor: modifiedColors.bg,
          boxShadow: modifiedColors.boxShadow,
        } : {
          backgroundColor: 'rgba(0, 0, 0, 0)',
          boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
        }}
        transition={{ 
          duration: 0.35, 
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        {/* 未保存指示器 - 渐变发光效果 */}
        {isModified && (
          <>
            {/* 左侧主指示条 */}
            <motion.div 
              className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", modifiedColors.indicator)}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
            {/* 顶部微光 */}
            <motion.div 
              className={cn("absolute left-0 right-0 top-0 h-px bg-gradient-to-r", modifiedColors.glow)}
              initial={{ opacity: 0, x: '-100%' }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            />
          </>
        )}
        {/* 左侧占位（保持对齐） */}
        <div className="w-5 flex-shrink-0 mt-0.5" />
        
        {/* 类型图标 */}
        <div className={cn('flex-shrink-0 mt-1', getTypeColor(config.type))}>
          <ValueTypeIcon type={config.type} />
        </div>
        
        {/* 键名、描述和编辑器区域 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* 第一行：键名 + 类型标签 + 编辑器 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={cn(
                'font-medium text-base',
                config.depth === 0 ? 'text-white' : 'text-[#c0c0c0]'
              )}>
                {/* 检测是否为数组中的基本类型元素（路径以 [数字] 结尾） */}
                {/^\[\d+\]$/.test(config.key) ? `项目 ${config.key.slice(1, -1)}` : config.key}
              </span>
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs px-1.5 py-0 h-4 border-0 font-normal opacity-70 flex-shrink-0',
                  getTypeBgColor(config.type),
                  getTypeColor(config.type)
                )}
              >
                {config.type}
              </Badge>
            </div>
            
            {/* 值编辑器区域 */}
            <div className="flex-shrink-0">
              {renderEditor()}
            </div>
            
            {/* 数组元素删除按钮 - 只有最后一项可以删除，其他项保留占位以保持对齐 */}
            {isArrayItem && onArrayChange && (
              <motion.button
                whileHover={{ scale: isLastArrayItem ? 1.1 : 1 }}
                whileTap={{ scale: isLastArrayItem ? 0.9 : 1 }}
                onClick={() => {
                  if (!isLastArrayItem) return;
                  // 从路径中提取索引，如 "parent[0]" -> 0
                  const match = config.path.match(/\[(\d+)\]$/);
                  if (match) {
                    const parentPath = config.path.slice(0, config.path.lastIndexOf('['));
                    onArrayChange(parentPath, 'remove', parseInt(match[1], 10));
                  }
                }}
                className={cn(
                  'p-1.5 rounded-md flex-shrink-0',
                  isLastArrayItem 
                    ? 'text-[#707070] hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200' 
                    : 'pointer-events-none bg-transparent'
                )}
                title={isLastArrayItem ? "删除此项" : undefined}
              >
                <motion.span
                  initial={isLastArrayItem ? { opacity: 0, scale: 0.5 } : false}
                  animate={isLastArrayItem ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.span>
              </motion.button>
            )}
          </div>
          
          {/* 描述 - 完整展示，保留换行 */}
          {descriptionLines.length > 0 && (
            <div className="space-y-1 mt-0.5">
              {descriptionLines.map((line, index) => (
                <p 
                  key={index} 
                  className="text-sm text-[#808080] leading-relaxed whitespace-pre-wrap break-words"
                >
                  {line ? highlightNumbersInText(line) : '\u00A0'}
                </p>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// 代码预览模式 - 使用 Prism 风格语法高亮
interface CodePreviewProps {
  content: string;
  type: 'json' | 'json5' | 'toml';
}

// Token 类型定义
type TokenType = 
  | 'string' | 'number' | 'boolean' | 'null' | 'key' 
  | 'comment' | 'section' | 'punctuation' | 'operator' 
  | 'escape' | 'text' | 'whitespace';

interface Token {
  type: TokenType;
  value: string;
}



// 词法分析器 - 将行文本解析为 token 数组
const tokenizeLine = (line: string, fileType: 'json' | 'json5' | 'toml'): Token[] => {
  const tokens: Token[] = [];
  let pos = 0;
  
  // 辅助函数：添加 token
  const addToken = (type: TokenType, value: string) => {
    if (value) tokens.push({ type, value });
  };
  
  // 辅助函数：查看当前字符
  const peek = (offset = 0): string => line[pos + offset] || '';
  
  // 辅助函数：消费当前字符
  const consume = (): string => line[pos++] || '';
  
  while (pos < line.length) {
    const char = peek();
    
    // 1. 空白字符
    if (/\s/.test(char)) {
      let value = '';
      while (/\s/.test(peek())) {
        value += consume();
      }
      addToken('whitespace', value);
      continue;
    }
    
    // 2. 双引号字符串 (JSON/JSON5/TOML)
    if (char === '"') {
      let value = consume(); // 开始引号
      while (peek()) {
        const c = peek();
        if (c === '\\') {
          // 转义序列
          const escapeSeq = consume() + consume();
          addToken('escape', escapeSeq);
          continue;
        }
        if (c === '"') {
          value += consume(); // 结束引号
          break;
        }
        value += consume();
      }
      addToken('string', value);
      continue;
    }
    
    // 3. 单引号字符串 (JSON5/TOML)
    if ((fileType === 'json5' || fileType === 'toml') && char === "'") {
      let value = consume(); // 开始引号
      while (peek()) {
        const c = peek();
        if (c === '\\' && fileType === 'toml') {
          // TOML 单引号字符串中的转义
          const escapeSeq = consume() + consume();
          addToken('escape', escapeSeq);
          continue;
        }
        if (c === "'") {
          value += consume(); // 结束引号
          break;
        }
        value += consume();
      }
      addToken('string', value);
      continue;
    }
    
    // 4. 多行字符串 (TOML): """...""" 或 '''...'''
    if (fileType === 'toml' && (peek(0) + peek(1) + peek(2) === '"""' || peek(0) + peek(1) + peek(2) === "'''")) {
      const quote = consume() + consume() + consume();
      let value = quote;
      const endQuote = quote;
      while (peek()) {
        if (peek(0) + peek(1) + peek(2) === endQuote) {
          value += consume() + consume() + consume();
          break;
        }
        value += consume();
      }
      addToken('string', value);
      continue;
    }
    
    // 5. TOML section header: [section] 或 [[section]]
    if (fileType === 'toml' && char === '[') {
      // 检查是否是行首的 section
      const beforeBracket = line.slice(0, pos).trim();
      if (beforeBracket === '') {
        let value = '';
        while (peek() && peek() !== ']') {
          value += consume();
        }
        if (peek() === ']') value += consume();
        // 检查是否有第二个 ]
        if (peek() === ']') value += consume();
        addToken('section', value);
        continue;
      } else {
        addToken('punctuation', consume());
        continue;
      }
    }
    
    // 6. 注释 (JSON/JSON5: //, /* */; TOML: #)
    // 配置文件中的 JSON 通常包含注释，所以也高亮 JSON 中的注释
    const isCommentStart = (fileType === 'json5' || fileType === 'json') && 
                           (peek(0) + peek(1) === '//' || peek(0) + peek(1) === '/*');
    const isTomlComment = fileType === 'toml' && char === '#';
    
    if (isCommentStart || isTomlComment) {
      let value = '';
      if (peek(0) + peek(1) === '/*') {
        // 块注释
        while (peek()) {
          if (peek(0) + peek(1) === '*/') {
            value += consume() + consume();
            break;
          }
          value += consume();
        }
      } else {
        // 行注释
        while (peek()) value += consume();
      }
      addToken('comment', value);
      continue;
    }
    
    // 7. 数字 (整数、浮点数、科学计数法、十六进制等)
    if (/[\d-]/.test(char)) {
      // 检查是否是负数或数字开始
      let value = '';
      if (peek() === '-') value += consume();
      
      // 十六进制 (JSON5: 0x...)
      if (fileType === 'json5' && peek() === '0' && (peek(1) === 'x' || peek(1) === 'X')) {
        value += consume() + consume();
        while (/[\da-fA-F]/.test(peek())) value += consume();
        addToken('number', value);
        continue;
      }
      
      // 数字部分
      while (/\d/.test(peek())) value += consume();
      
      // 小数部分
      if (peek() === '.' && /\d/.test(peek(1))) {
        value += consume();
        while (/\d/.test(peek())) value += consume();
      }
      
      // 指数部分
      if (/[eE]/.test(peek())) {
        value += consume();
        if (peek() === '+' || peek() === '-') value += consume();
        while (/\d/.test(peek())) value += consume();
      }
      
      // TOML 特殊数字格式 (inf, nan, 日期时间)
      if (fileType === 'toml' && /^[+-]?$/.test(value)) {
        // 可能是 inf 或 nan
        const rest = line.slice(pos);
        if (/^inf/i.test(rest)) {
          value += line.slice(pos, pos + 3);
          pos += 3;
        } else if (/^nan/i.test(rest)) {
          value += line.slice(pos, pos + 3);
          pos += 3;
        }
      }
      
      addToken('number', value);
      continue;
    }
    
    // 8. 标识符和关键字
    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (/[a-zA-Z0-9_]/.test(peek())) value += consume();
      
      const lowerValue = value.toLowerCase();
      
      // 布尔值
      if (lowerValue === 'true' || lowerValue === 'false') {
        addToken('boolean', value);
        continue;
      }
      
      // null
      if (lowerValue === 'null' || lowerValue === 'undefined') {
        addToken('null', value);
        continue;
      }
      
      // TOML 特殊值
      if (fileType === 'toml' && (lowerValue === 'inf' || lowerValue === 'nan')) {
        addToken('number', value);
        continue;
      }
      
      // 可能是键名 - 检查后面是否跟着 : 或 =
      const rest = line.slice(pos).trimStart();
      if (rest.startsWith(':') || rest.startsWith('=')) {
        addToken('key', value);
      } else {
        addToken('text', value);
      }
      continue;
    }
    
    // 9. 键名检测 (带引号的键已在字符串处理)
    // 检测 key: 或 key = 格式中的键名
    if (/[a-zA-Z0-9_\-]/.test(char)) {
      let value = '';
      while (/[a-zA-Z0-9_\-]/.test(peek())) value += consume();
      
      // 检查后面是否跟着 : 或 =
      const rest = line.slice(pos).trimStart();
      if (rest.startsWith(':') || rest.startsWith('=')) {
        addToken('key', value);
      } else {
        addToken('text', value);
      }
      continue;
    }
    
    // 10. 操作符和标点符号
    if (char === ':' || char === '=') {
      addToken('operator', consume());
      continue;
    }
    
    if (/[{}[\],]/.test(char)) {
      addToken('punctuation', consume());
      continue;
    }
    
    // 11. 其他字符
    addToken('text', consume());
  }
  
  return tokens;
};

// 后处理：标记 JSON 中作为键的字符串
const postProcessTokens = (tokens: Token[]): Token[] => {
  const result: Token[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextNonSpace = tokens.slice(i + 1).find(t => t.type !== 'whitespace');
    
    // 如果字符串后面跟着 : 或 =，则标记为 key
    if (token.type === 'string' && nextNonSpace?.type === 'operator') {
      result.push({ ...token, type: 'key' });
    } else {
      result.push(token);
    }
  }
  
  return result;
};

// Token 样式映射
const getTokenClassName = (type: TokenType): string => {
  switch (type) {
    case 'string':
      return 'text-emerald-400';
    case 'number':
      return 'text-blue-400';
    case 'boolean':
      return 'text-purple-400';
    case 'null':
      return 'text-gray-500';
    case 'key':
      return 'text-amber-300';
    case 'comment':
      return 'text-gray-500 italic';
    case 'section':
      return 'text-amber-400 font-medium';
    case 'punctuation':
      return 'text-slate-400';
    case 'operator':
      return 'text-slate-300';
    case 'escape':
      return 'text-emerald-300';
    case 'text':
      return 'text-[#a0a0a0]';
    case 'whitespace':
      return '';
    default:
      return 'text-[#a0a0a0]';
  }
};

const CodePreview = ({ content, type }: CodePreviewProps) => {
  // 解析所有行
  const lines = useMemo(() => {
    if (!content) return [];
    return content.split('\n').map(line => {
      const tokens = tokenizeLine(line, type);
      return postProcessTokens(tokens);
    });
  }, [content, type]);
  
  // 计算行号宽度
  const lineNumberWidth = useMemo(() => {
    const digits = String(lines.length).length;
    return Math.max(2, digits) * 0.6 + 1; // em
  }, [lines.length]);
  
  // 渲染 token
  // 注意：React 会自动转义 HTML 特殊字符，所以不需要手动调用 escapeHtml
  const renderToken = (token: Token, index: number): React.ReactNode => {
    const className = getTokenClassName(token.type);
    
    // 将空格转换为不可见空格字符以保持缩进
    const displayValue = token.type === 'whitespace' 
      ? token.value.replace(/ /g, '\u00A0').replace(/\t/g, '\u00A0\u00A0')
      : token.value;
    
    return (
      <span 
        key={index} 
        className={className}
        {...(token.type === 'whitespace' ? { 'data-whitespace': true } : {})}
      >
        {displayValue}
      </span>
    );
  };
  
  return (
    <div className="flex font-mono text-base leading-7">
      {/* 行号列 */}
      <div 
        className="flex-shrink-0 py-4 text-right select-none border-r border-[#2a2a2a] bg-[#0a0a0a]"
        style={{ minWidth: `${lineNumberWidth}rem` }}
      >
        {lines.map((_, idx) => (
          <div 
            key={idx} 
            className="px-3 text-gray-600 text-sm leading-7"
          >
            {idx + 1}
          </div>
        ))}
      </div>
      
      {/* 代码列 */}
      <div className="flex-1 overflow-auto">
        <pre className="py-4">
          <code>
            {lines.map((tokens, lineIdx) => (
              <div key={lineIdx} className="px-4 min-h-[1.75rem]">
                {tokens.length > 0 
                  ? tokens.map((token, tokenIdx) => renderToken(token, tokenIdx))
                  : <span className="text-gray-700">&#9585;</span> // 空行指示
                }
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

// 主编辑器组件
export function ModConfigEditor({ modId, modName, filePath, fileType, onClose, onSave }: ModConfigEditorProps) {
  // onClose is kept for API compatibility
  void onClose;
  const [content, setContent] = useState<string>('');
  const [parsed, setParsed] = useState<unknown>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [originalParsed, setOriginalParsed] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'code'>('form');
  // 保存滚动位置
  const formScrollRef = useRef<number>(0);
  const codeScrollRef = useRef<number>(0);
  const formScrollViewportRef = useRef<HTMLDivElement>(null);
  const codeScrollViewportRef = useRef<HTMLDivElement>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // 用于防止 compareContent useEffect 在保存成功态显示期间覆盖 hasChanges
  const isSaveSuccessPendingRef = useRef(false);
  
  // 深度比较两个值是否相等
  const isDeepEqual = useCallback((a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;
    
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!isDeepEqual(objA[key], objB[key])) return false;
    }
    return true;
  }, []);
  
  // 获取指定路径的值
  const getValueByPath = useCallback((obj: unknown, path: string): unknown => {
    if (!obj || typeof obj !== 'object') return undefined;
    
    const keys: string[] = [];
    let current = '';
    let inBracket = false;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[') {
        if (current) {
          keys.push(current);
          current = '';
        }
        inBracket = true;
      } else if (char === ']') {
        if (current) {
          keys.push(current);
          current = '';
        }
        inBracket = false;
      } else if (char === '.' && !inBracket) {
        if (current) {
          keys.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      keys.push(current);
    }
    
    let result: unknown = obj;
    for (const key of keys) {
      if (result === null || result === undefined) return undefined;
      if (Array.isArray(result)) {
        result = result[parseInt(key, 10)];
      } else if (typeof result === 'object') {
        result = (result as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return result;
  }, []);
  
  // 检查指定路径的值是否已修改
  const isPathModified = useCallback((path: string): boolean => {
    if (!originalParsed || !parsed) return false;
    const originalValue = getValueByPath(originalParsed, path);
    const currentValue = getValueByPath(parsed, path);
    return !isDeepEqual(originalValue, currentValue);
  }, [originalParsed, parsed, getValueByPath, isDeepEqual]);
  
  // 智能预览内容（保留注释的原始内容 + 变更的值）
  const [smartPreviewContent, setSmartPreviewContent] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // 生成带注释的智能预览内容
  useEffect(() => {
    const generateSmartPreview = async () => {
      if (!originalContent || !parsed) {
        setSmartPreviewContent(originalContent || '');
        return;
      }
      
      // 如果没有变更，直接显示原始内容
      if (!hasChanges) {
        setSmartPreviewContent(originalContent);
        return;
      }
      
      setIsGeneratingPreview(true);
      try {
        // 使用深比较收集变更（内联实现，避免依赖循环）
        const changes: Array<{ path: string; value: unknown }> = [];
        
        const findChanges = (current: unknown, original: unknown, currentPath: string) => {
          if (current === original) return;
          
          if (typeof current !== typeof original) {
            changes.push({ path: currentPath, value: current });
            return;
          }
          
          if (typeof current !== 'object' || current === null || original === null) {
            if (current !== original) {
              changes.push({ path: currentPath, value: current });
            }
            return;
          }
          
          if (Array.isArray(current) && Array.isArray(original)) {
            const maxLen = Math.max(current.length, original.length);
            for (let i = 0; i < maxLen; i++) {
              const itemPath = `${currentPath}[${i}]`;
              if (i >= original.length) {
                changes.push({ path: itemPath, value: current[i] });
              } else if (i >= current.length) {
                changes.push({ path: itemPath, value: undefined });
              } else {
                findChanges(current[i], original[i], itemPath);
              }
            }
            return;
          }
          
          const currentObj = current as Record<string, unknown>;
          const originalObj = original as Record<string, unknown>;
          const allKeys = new Set([...Object.keys(currentObj), ...Object.keys(originalObj)]);
          
          for (const key of allKeys) {
            const keyPath = currentPath ? `${currentPath}.${key}` : key;
            if (!(key in originalObj)) {
              changes.push({ path: keyPath, value: currentObj[key] });
            } else if (!(key in currentObj)) {
              changes.push({ path: keyPath, value: undefined });
            } else {
              findChanges(currentObj[key], originalObj[key], keyPath);
            }
          }
        };
        
        findChanges(parsed, originalParsed, '');
        
        if (changes.length === 0) {
          setSmartPreviewContent(originalContent);
          return;
        }
        
        // 使用本地智能替换逻辑生成预览（避免不必要的 API 调用）
        const preview = generateSmartPreviewLocal(originalContent, changes, fileType);
        setSmartPreviewContent(preview);
      } catch {
        // 失败时回退到原始内容
        setSmartPreviewContent(originalContent);
      } finally {
        setIsGeneratingPreview(false);
      }
    };
    
    generateSmartPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalContent, parsed, hasChanges, fileType, filePath, originalParsed]);
  
  // 本地智能替换生成预览（简化版，仅用于预览）
  const generateSmartPreviewLocal = (
    originalContent: string, 
    changes: Array<{ path: string; value: unknown }>, 
    fileType: 'json' | 'json5' | 'toml'
  ): string => {
    // 按路径深度排序，先处理深层路径
    const sortedChanges = [...changes].sort((a, b) => {
      const depthA = a.path.split(/[.\[]/).length;
      const depthB = b.path.split(/[.\[]/).length;
      return depthB - depthA;
    });
    
    let result = originalContent;
    
    for (const { path: keyPath, value } of sortedChanges) {
      result = replaceValueForPreview(result, keyPath, value, fileType);
    }
    
    return result;
  };
  
  // 在内容中替换单个值（用于预览）
  const replaceValueForPreview = (
    content: string,
    keyPath: string,
    value: unknown,
    fileType: 'json' | 'json5' | 'toml'
  ): string => {
    const keys = keyPath.split(/\.|\[(\d+)\]/).filter(Boolean);
    if (keys.length === 0) return content;
    
    const targetKey = keys[keys.length - 1];
    const parentPath = keys.slice(0, -1);
    
    const lines = content.split('\n');
    
    if (fileType === 'toml') {
      // TOML: 需要处理 section
      let currentSection: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 检查 section 头
        const sectionMatch = trimmed.match(/^\[\[?\s*([^\]]+)\s*\]\]?$/);
        if (sectionMatch) {
          currentSection = sectionMatch[1].split('.').map(s => s.trim());
          continue;
        }
        
        // 判断是否在目标 section 中
        // 无 section 键：只在无 section 区域查找（currentSection.length === 0）
        // 有 section 键：在匹配的 section 中查找
        const inTargetSection = parentPath.length === 0
          ? currentSection.length === 0
          : parentPath.length === currentSection.length &&
            parentPath.every((k, idx) => currentSection[idx] === k);
        
        if (inTargetSection) {
          const result = tryReplaceValueInLine(line, targetKey, value, '=');
          if (result.replaced) {
            lines[i] = result.newLine;
            return lines.join('\n');
          }
        }
      }
    } else {
      // JSON/JSON5: 简单键值替换（需要处理嵌套结构）
      // 对于嵌套路径，需要跟踪当前层级
      const searchInJson = (lines: string[], keys: string[], startLine: number, depth: number): { replaced: boolean; lineIndex: number } => {
        const target = keys[depth];
        let braceDepth = 0;
        let inString = false;
        let stringChar = '';
        
        for (let i = startLine; i < lines.length; i++) {
          const line = lines[i];
          
          // 跟踪字符串和括号深度
          for (const char of line) {
            if (!inString && (char === '"' || char === "'")) {
              inString = true;
              stringChar = char;
            } else if (inString && char === stringChar) {
              inString = false;
            } else if (!inString) {
              if (char === '{' || char === '[') braceDepth++;
              else if (char === '}' || char === ']') braceDepth--;
            }
          }
          
          // 只在正确的层级查找键
          if (braceDepth === depth) {
            const result = tryReplaceValueInLine(line, target, value, ':');
            if (result.replaced) {
              lines[i] = result.newLine;
              return { replaced: true, lineIndex: i };
            }
          }
          
          // 如果括号深度小于目标深度，说明已经离开目标区域
          if (braceDepth < depth) {
            return { replaced: false, lineIndex: -1 };
          }
        }
        
        return { replaced: false, lineIndex: -1 };
      };
      
      // 从最顶层开始搜索
      searchInJson(lines, keys, 0, 0);
    }
    
    return lines.join('\n');
  };
  
  // 尝试在单行中替换值
  const tryReplaceValueInLine = (
    line: string,
    key: string,
    value: unknown,
    separator: ':' | '='
  ): { replaced: boolean; newLine: string } => {
    // 匹配键值对模式："key" = value, 'key' = value, key = value
    // 优先匹配带引号的键（处理包含特殊字符的键名，如空格、&等）
    const patterns = [
      new RegExp(`^([\\s]*)"${escapeRegex(key)}"([\\s]*${escapeRegex(separator)}[\\s]*)`),
      new RegExp(`^([\\s]*)'${escapeRegex(key)}'([\\s]*${escapeRegex(separator)}[\\s]*)`)
    ];
    
    // 对于裸键（仅包含字母数字下划线和连字符），也尝试无引号匹配
    if (/^[a-zA-Z0-9_-]+$/.test(key)) {
      patterns.push(
        new RegExp(`^([\\s]*)${escapeRegex(key)}([\\s]*${escapeRegex(separator)}[\\s]*)`)
      );
    }
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const valueStart = match[0].length;
        const originalValueEnd = findValueEndInLine(line, valueStart);
        
        if (originalValueEnd > valueStart) {
          const formattedValue = formatValueForPreview(value, separator === ':');
          const newLine = line.slice(0, valueStart) + formattedValue + line.slice(originalValueEnd);
          return { replaced: true, newLine };
        }
      }
    }
    
    return { replaced: false, newLine: line };
  };
  
  // 查找行内值的结束位置
  const findValueEndInLine = (line: string, start: number): number => {
    let i = start;
    let inString = false;
    let stringChar = '';
    let depth = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
          i++;
          continue;
        }
        if (char === '{' || char === '[') {
          depth++;
        } else if (char === '}' || char === ']') {
          if (depth === 0) return i;
          depth--;
        }
        if (depth === 0 && (char === ',' || char === '#' || char === '/')) {
          // 回溯到上一个非空白字符
          let j = i - 1;
          while (j > start && /\s/.test(line[j])) j--;
          return j + 1;
        }
      } else {
        if (char === stringChar && line[i - 1] !== '\\') {
          inString = false;
        }
      }
      i++;
    }
    
    return line.length;
  };
  
  // 格式化值用于预览
  const formatValueForPreview = (value: unknown, isJson5: boolean): string => {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) {
      const items = value.map(v => formatValueForPreview(v, isJson5)).join(', ');
      return `[${items}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${JSON.stringify(k)}: ${formatValueForPreview(v, isJson5)}`)
        .join(', ');
      return `{${entries}}`;
    }
    return String(value);
  };
  
  // 获取最终预览内容（优先使用智能预览）
  const finalPreviewContent = useMemo(() => {
    // 如果没有变更，直接显示原始内容
    if (!hasChanges) {
      return originalContent;
    }
    // 如果有智能预览，使用它；否则回退到原始内容
    return smartPreviewContent || originalContent;
  }, [smartPreviewContent, originalContent, hasChanges]);
  
  // 监听 parsed 变化，与原始内容比较以确定是否有更改
  useEffect(() => {
    const compareContent = async () => {
      if (!parsed || !originalContent) {
        setHasChanges(false);
        return;
      }
      
      // 如果保存成功态正在显示中，跳过比较，避免干扰成功态动画
      if (isSaveSuccessPendingRef.current) {
        return;
      }
      
      try {
        let originalParsed: unknown;
        if (fileType === 'toml') {
          const { parse: parseTOML } = await import('@iarna/toml');
          originalParsed = parseTOML(originalContent);
        } else if (fileType === 'json5') {
          const JSON5 = await import('json5');
          originalParsed = JSON5.parse(originalContent);
        } else {
          originalParsed = JSON.parse(originalContent);
        }
        
        const changed = !isDeepEqual(parsed, originalParsed);
        setHasChanges(changed);
        if (!changed) {
          setSaveSuccess(false);
        }
      } catch {
        // 解析失败时保持当前状态
      }
    };
    
    compareContent();
  }, [parsed, originalContent, fileType, isDeepEqual]);
  
  // 加载文件内容
  useEffect(() => {
    loadFile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modId, filePath]);
  
  const loadFile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/mod-configs/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      
      if (data.success) {
        setContent(data.content);
        setOriginalContent(data.content);
        setOriginalParsed(data.parsed);
        setParsed(data.parsed);
        
              // 默认收起所有节点（expandedPaths 保持为空）
      } else {
        setError(data.error || 'Failed to load file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  // 提取配置项
  const configValues = useMemo(() => {
    if (!parsed) return [];
    return extractConfigValues(parsed, content, '', 0, false, fileType);
  }, [parsed, content, fileType]);
  
  // 过滤出顶层配置项
  const topLevelConfigs = useMemo(() => {
    return configValues.filter(c => c.depth === 0);
  }, [configValues]);
  
  // 处理值变更
  const handleValueChange = useCallback((path: string, newValue: unknown) => {
    setParsed((prev: unknown) => {
      const newParsed = JSON.parse(JSON.stringify(prev));
      
      // 解析路径，支持数组索引，如 "key[0].subKey" -> ['key', '0', 'subKey']
      const parsePath = (pathStr: string): string[] => {
        const keys: string[] = [];
        let current = '';
        let inBracket = false;
        
        for (let i = 0; i < pathStr.length; i++) {
          const char = pathStr[i];
          
          if (char === '[') {
            if (current) {
              keys.push(current);
              current = '';
            }
            inBracket = true;
          } else if (char === ']') {
            if (current) {
              keys.push(current); // 数组索引作为字符串
              current = '';
            }
            inBracket = false;
          } else if (char === '.' && !inBracket) {
            if (current) {
              keys.push(current);
              current = '';
            }
          } else {
            current += char;
          }
        }
        
        if (current) {
          keys.push(current);
        }
        
        return keys;
      };
      
      const keys = parsePath(path);
      let current: unknown = newParsed;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const nextKey = keys[i + 1];
        const isNextKeyArrayIndex = /^\d+$/.test(nextKey);
        
        if (Array.isArray(current)) {
          current = current[parseInt(key, 10)];
        } else if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[key];
        }
        
        // 如果下一级是数组索引但当前值不是数组，创建数组
        if (isNextKeyArrayIndex && !Array.isArray(current) && typeof current === 'object' && current !== null) {
          // 保持原样， shouldn't happen in valid config
        }
      }
      
      const lastKey = keys[keys.length - 1];
      if (Array.isArray(current)) {
        current[parseInt(lastKey, 10)] = newValue;
      } else if (typeof current === 'object' && current !== null) {
        (current as Record<string, unknown>)[lastKey] = newValue;
      }
      
      return newParsed;
    });
  }, []);
  
  // 处理数组增删
  const handleArrayChange = useCallback((path: string, action: 'add' | 'remove', index?: number) => {
    setParsed((prev: unknown) => {
      const newParsed = JSON.parse(JSON.stringify(prev));
      
      // 解析路径
      const parsePath = (pathStr: string): string[] => {
        const keys: string[] = [];
        let current = '';
        let inBracket = false;
        
        for (let i = 0; i < pathStr.length; i++) {
          const char = pathStr[i];
          
          if (char === '[') {
            if (current) {
              keys.push(current);
              current = '';
            }
            inBracket = true;
          } else if (char === ']') {
            if (current) {
              keys.push(current);
              current = '';
            }
            inBracket = false;
          } else if (char === '.' && !inBracket) {
            if (current) {
              keys.push(current);
              current = '';
            }
          } else {
            current += char;
          }
        }
        
        if (current) {
          keys.push(current);
        }
        
        return keys;
      };
      
      const keys = parsePath(path);
      let current: unknown = newParsed;
      
      // 遍历到目标数组
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (Array.isArray(current)) {
          current = current[parseInt(key, 10)];
        } else if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[key];
        }
      }
      
      // 执行增删操作
      if (Array.isArray(current)) {
        if (action === 'add') {
          // 根据数组元素类型决定默认值
          const sampleValue = current.length > 0 ? current[0] : null;
          let defaultValue: unknown = '';
          
          if (typeof sampleValue === 'number') {
            defaultValue = 0;
          } else if (typeof sampleValue === 'boolean') {
            defaultValue = false;
          } else if (typeof sampleValue === 'string') {
            defaultValue = '';
          } else if (Array.isArray(sampleValue)) {
            defaultValue = [];
          } else if (typeof sampleValue === 'object' && sampleValue !== null) {
            // 对象数组：创建一个包含所有相同键的空对象
            defaultValue = Object.fromEntries(
              Object.keys(sampleValue).map(key => {
                const val = (sampleValue as Record<string, unknown>)[key];
                let defaultVal: unknown = '';
                if (typeof val === 'number') defaultVal = 0;
                else if (typeof val === 'boolean') defaultVal = false;
                else if (typeof val === 'string') defaultVal = '';
                else if (Array.isArray(val)) defaultVal = [];
                else if (typeof val === 'object' && val !== null) defaultVal = {};
                return [key, defaultVal];
              })
            );
          }
          
          current.push(defaultValue);
        } else if (action === 'remove' && index !== undefined) {
          current.splice(index, 1);
        }
      }
      
      return newParsed;
    });
  }, []);
  
  // 切换展开状态
  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);
  
  // 收集所有变更的配置项
  const collectChanges = useCallback((): Array<{ path: string; value: unknown }> => {
    if (!originalParsed || !parsed) return [];
    
    const changes: Array<{ path: string; value: unknown }> = [];
    
    const findChanges = (current: unknown, original: unknown, currentPath: string) => {
      if (current === original) return;
      
      if (typeof current !== typeof original) {
        // 类型不同，整个值都变了
        changes.push({ path: currentPath, value: current });
        return;
      }
      
      if (typeof current !== 'object' || current === null || original === null) {
        // 基本类型且值不同
        if (current !== original) {
          changes.push({ path: currentPath, value: current });
        }
        return;
      }
      
      if (Array.isArray(current) && Array.isArray(original)) {
        // 数组：检查每个元素
        const maxLen = Math.max(current.length, original.length);
        for (let i = 0; i < maxLen; i++) {
          const itemPath = `${currentPath}[${i}]`;
          if (i >= original.length) {
            // 新增元素
            changes.push({ path: itemPath, value: current[i] });
          } else if (i >= current.length) {
            // 删除元素 - 标记为 null，在替换时会被特殊处理
            changes.push({ path: itemPath, value: undefined });
          } else {
            findChanges(current[i], original[i], itemPath);
          }
        }
        return;
      }
      
      // 对象：检查每个属性
      const currentObj = current as Record<string, unknown>;
      const originalObj = original as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(currentObj), ...Object.keys(originalObj)]);
      
      for (const key of allKeys) {
        const keyPath = currentPath ? `${currentPath}.${key}` : key;
        if (!(key in originalObj)) {
          // 新增属性
          changes.push({ path: keyPath, value: currentObj[key] });
        } else if (!(key in currentObj)) {
          // 删除属性
          changes.push({ path: keyPath, value: undefined });
        } else {
          findChanges(currentObj[key], originalObj[key], keyPath);
        }
      }
    };
    
    findChanges(parsed, originalParsed, '');
    return changes;
  }, [originalParsed, parsed]);

  // 保存文件 - 优化版本
  const handleSave = async () => {
    if (!parsed || !originalContent) return;
    
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      // 收集所有变更
      const changes = collectChanges();
      
      // 检查是否有实际变更
      if (changes.length === 0) {
        // 没有变更，直接显示成功状态
        setSaving(false);
        setSaveSuccess(true);
        isSaveSuccessPendingRef.current = true;
        setTimeout(() => {
          setSaveSuccess(false);
          isSaveSuccessPendingRef.current = false;
        }, 1500);
        return;
      }
      
      // 调用 API 保存
      // 传递 originalContent 和 changes，让后端进行智能替换
      const res = await fetch('/api/mod-configs/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          format: fileType,
          useSmartReplace: true,
          changes: changes,
          originalContent: originalContent, // 传递原始内容供智能替换使用
        }),
      });
      
      const data = await res.json() as { success?: boolean; error?: string; content?: string };
      
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Save failed with status ${res.status}`);
      }
      
      // 保存成功，更新状态
      // 使用后端返回的内容（包含正确的格式和注释）
      const savedContent = data.content || originalContent;
      
      // 先更新原始值，使修改高亮消失
      setOriginalParsed(parsed);
      setOriginalContent(savedContent);
      setContent(savedContent);
      
      // 先关闭保存中状态，显示成功状态
      // 注意：此时 hasChanges 仍为 true，避免与未保存指示器的退出动画冲突
      setSaving(false);
      setSaveSuccess(true);
      // 设置标志，防止 compareContent useEffect 在此期间覆盖 hasChanges
      isSaveSuccessPendingRef.current = true;
      
      // 触发保存回调
      onSave?.();
      
      // 延迟关闭成功状态和清除 hasChanges
      // 这样可以让成功态动画完整播放，不会与未保存指示器的退出动画冲突
      setTimeout(() => {
        setSaveSuccess(false);
        // 在成功态消失后再清除 hasChanges，避免布局动画干扰
        setHasChanges(false);
        // 清除标志，允许 compareContent 正常工作
        isSaveSuccessPendingRef.current = false;
      }, 2500);
      
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
      setSaving(false);
      setSaveSuccess(false);
      // 保存失败时也要重置标志
      isSaveSuccessPendingRef.current = false;
    }
  };
  
  // 重置更改 - 恢复到上次保存的状态
  const handleReset = useCallback(async () => {
    if (!originalContent) return;
    
    // 清除错误状态
    setError(null);
    
    // 根据文件类型解析原始内容
    try {
      let resetParsed: unknown;
      if (fileType === 'toml') {
        const { default: TOML } = await import('@iarna/toml');
        resetParsed = TOML.parse(originalContent);
      } else if (fileType === 'json5') {
        const JSON5 = await import('json5');
        resetParsed = JSON5.parse(originalContent);
      } else {
        resetParsed = JSON.parse(originalContent);
      }
      
      setParsed(resetParsed);
      setOriginalParsed(resetParsed);
      setContent(originalContent);
      setHasChanges(false);
      setSaveSuccess(false);
    } catch (e) {
      console.error('Failed to parse original content:', e);
      setError('重置失败：无法解析原始配置内容');
    }
  }, [originalContent, fileType]);
  
  // 展开/折叠全部
  const expandAll = useCallback(() => {
    const allPaths = new Set<string>();
    const collectPaths = (obj: unknown, path: string = '') => {
      if (typeof obj === 'object' && obj !== null) {
        allPaths.add(path);
        for (const key of Object.keys(obj)) {
          collectPaths((obj as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
        }
      }
    };
    collectPaths(parsed);
    setExpandedPaths(allPaths);
  }, [parsed]);
  
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-6">
        {/* 加载动画容器 */}
        <div className="relative flex items-center justify-center">
          {/* 外层脉冲环 */}
          <motion.div
            className="absolute w-20 h-20 rounded-full border-2 border-emerald-500/20"
            animate={{
              scale: [1, 1.5, 1.5],
              opacity: [0.5, 0, 0],
            }}
            transition={{
              duration: 2,
              ease: 'easeOut',
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
          />
          
          {/* 中层脉冲环 */}
          <motion.div
            className="absolute w-20 h-20 rounded-full border-2 border-emerald-500/30"
            animate={{
              scale: [1, 1.3, 1.3],
              opacity: [0.7, 0, 0],
            }}
            transition={{
              duration: 2,
              ease: 'easeOut',
              repeat: Infinity,
              repeatDelay: 0.5,
              delay: 0.3,
            }}
          />
          
          {/* 内层背景光晕 */}
          <motion.div
            className="absolute w-16 h-16 rounded-full bg-emerald-500/10"
            animate={{
              scale: [0.8, 1.1, 0.8],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
          
          {/* 中心文件图标容器 */}
          <motion.div
            className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 
                       border border-emerald-500/30 flex items-center justify-center backdrop-blur-sm"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(16, 185, 129, 0)',
                '0 0 20px 5px rgba(16, 185, 129, 0.15)',
                '0 0 0 0 rgba(16, 185, 129, 0)',
              ],
            }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          >
            {/* 旋转的图标 */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
            >
              <FileTypeIcon 
                type={fileType} 
                className="w-7 h-7 text-emerald-400" 
              />
            </motion.div>
            
            {/* 右上角的装饰点 */}
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400"
              animate={{
                scale: [0.8, 1.2, 0.8],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 1.5,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            />
          </motion.div>
        </div>
        
        {/* 文字提示 */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            className="flex items-center gap-1 text-emerald-400/80 text-sm font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <span>正在加载</span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            >
              ·
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            >
              ·
            </motion.span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            >
              ·
            </motion.span>
          </motion.div>
          
          {/* 文件路径提示 */}
          <motion.p
            className="text-xs text-[#707070] max-w-[300px] truncate px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            {filePath}
          </motion.p>
        </div>
        
        {/* 底部进度条 */}
        <motion.div
          className="w-32 h-0.5 bg-[#2a2a2a] rounded-full overflow-hidden"
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
        </motion.div>
      </div>
    );
  }
  
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-64 text-center p-6"
      >
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">加载失败</h3>
        <p className="text-sm text-[#707070]">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadFile}
          className="mt-4 border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="flex flex-col h-full"
    >
        {/* 工具栏 - 响应式布局优化 */}
        <div 
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-[#2a2a2a] bg-[#151515]/50"
        >
          {/* 左侧：文件信息 */}
          <motion.div 
            layout
            className="flex items-center gap-3 min-w-0"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
              <FileTypeIcon type={fileType} className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0 overflow-hidden">
              <motion.h3 
                layout
                className="font-medium text-white text-sm truncate"
              >
                {filePath}
              </motion.h3>
              <motion.p layout className="text-xs text-[#707070]">{modName}</motion.p>
            </div>
          </motion.div>
          
          {/* 右侧：操作按钮组 - 响应式布局容器 */}
          <motion.div 
            layout
            className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-end"
          >
            {/* 展开/折叠控制（仅在表单模式下显示） */}
            <AnimatePresence mode="popLayout">
              {viewMode === 'form' && (
                <motion.div 
                  key="expand-controls"
                  layout
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: easings.standard }}
                  className="hidden sm:flex items-center gap-1"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={expandAll}
                        className="h-8 w-8 text-[#707070] hover:text-white hover:bg-[#2a2a2a]"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>展开全部</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={collapseAll}
                        className="h-8 w-8 text-[#707070] hover:text-white hover:bg-[#2a2a2a]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>折叠全部</p>
                    </TooltipContent>
                  </Tooltip>
                  {/* 分隔线 */}
                  <motion.div 
                    layout
                    className="w-px h-5 bg-[#2a2a2a] mx-1" 
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* 视图切换 - 响应式：窄屏时仅显示图标 */}
            <motion.div 
              layout
              className="flex bg-[#1a1a1a] rounded-lg p-0.5 border border-[#2a2a2a]"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('form')}
                    className={cn(
                      'h-7 px-2 text-xs flex items-center gap-1.5 transition-all duration-200',
                      viewMode === 'form' 
                        ? 'bg-[#262626] text-white' 
                        : 'text-[#707070] hover:text-white'
                    )}
                  >
                    <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                    <motion.span
                      layout
                      className="hidden sm:inline whitespace-nowrap"
                    >
                      表单
                    </motion.span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>可视化编辑模式</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('code')}
                    className={cn(
                      'h-7 px-2 text-xs flex items-center gap-1.5 transition-all duration-200',
                      viewMode === 'code' 
                        ? 'bg-[#262626] text-white' 
                        : 'text-[#707070] hover:text-white'
                    )}
                  >
                    <Code className="w-3.5 h-3.5 flex-shrink-0" />
                    <motion.span
                      layout
                      className="hidden sm:inline whitespace-nowrap"
                    >
                      代码
                    </motion.span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>源代码编辑模式</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
            
            {/* 未保存状态与重置按钮容器 - 响应式布局动画 */}
            <AnimatePresence initial={false} mode="popLayout">
              {hasChanges && !saveSuccess && (
                <motion.div
                  key="unsaved-group"
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ 
                    duration: 0.2,
                    ease: easings.standard
                  }}
                  className="flex items-center gap-1.5 sm:gap-2"
                >
                  {/* 未保存指示 - 响应式：窄屏仅显示图标 */}
                  <motion.div 
                    layout
                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 flex-shrink-0 border border-amber-500/20 min-w-fit"
                  >
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="text-xs font-medium hidden sm:inline whitespace-nowrap">
                      未保存
                    </span>
                  </motion.div>
                  
                  {/* 重置按钮 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div layout>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleReset}
                          className="h-8 w-8 text-[#707070] hover:text-amber-400 hover:bg-amber-500/10 flex-shrink-0 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>重置更改</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* 保存按钮 - 响应式三态动画 */}
            <div className="relative">
              <AnimatePresence mode="wait" initial={false}>
                {saveSuccess ? (
                  /* 成功态 */
                  <motion.div
                    key="success-btn"
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ 
                      duration: 0.25, 
                      ease: [0.34, 1.56, 0.64, 1]
                    }}
                  >
                    <Button
                      variant="default"
                      size="sm"
                      disabled
                      className="h-8 px-2 sm:px-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium cursor-default"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ 
                          delay: 0.05,
                          type: 'spring',
                          stiffness: 500,
                          damping: 15
                        }}
                      >
                        <Check className="w-4 h-4 mr-0 sm:mr-1.5" />
                      </motion.div>
                      <span className="hidden sm:inline">已保存</span>
                    </Button>
                    
                    {/* 成功波纹扩散效果 */}
                    <motion.div
                      className="absolute inset-0 rounded-lg border-2 border-emerald-500/50"
                      initial={{ opacity: 1, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.6 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </motion.div>
                ) : saving ? (
                  /* 保存中态 */
                  <motion.div
                    key="saving-btn"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="default"
                      size="sm"
                      disabled
                      className="h-8 px-2 sm:px-3 bg-emerald-500/80 text-black font-medium cursor-wait"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ 
                          duration: 1.5, 
                          ease: 'linear', 
                          repeat: Infinity 
                        }}
                        className="mr-0 sm:mr-1.5"
                      >
                        <Loader2 className="w-4 h-4" />
                      </motion.div>
                      <motion.span
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="hidden sm:inline"
                      >
                        保存中
                      </motion.span>
                      {/* 进度条动画 */}
                      <motion.div
                        className="absolute bottom-0 left-0 h-0.5 bg-black/30"
                        initial={{ width: '0%' }}
                        animate={{ 
                          width: ['0%', '40%', '70%', '90%'],
                        }}
                        transition={{ 
                          duration: 2,
                          ease: 'easeInOut',
                          times: [0, 0.3, 0.6, 1],
                          repeat: Infinity
                        }}
                      />
                    </Button>
                  </motion.div>
                ) : (
                  /* 初始态 */
                  <motion.div
                    key="save-btn"
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    whileHover={{ scale: hasChanges ? 1.02 : 1 }}
                    whileTap={{ scale: hasChanges ? 0.98 : 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSave}
                          disabled={!hasChanges || isGeneratingPreview}
                          className={cn(
                            'h-8 px-2 sm:px-3 font-medium transition-all duration-200 relative overflow-hidden',
                            hasChanges && !isGeneratingPreview
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-black' 
                              : 'bg-[#2a2a2a] text-[#707070] cursor-not-allowed'
                          )}
                        >
                          {/* 悬停时的微光效果 */}
                          {hasChanges && !isGeneratingPreview && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
                              whileHover={{ x: '100%' }}
                              transition={{ duration: 0.5, ease: 'easeInOut' }}
                            />
                          )}
                          {isGeneratingPreview ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
                              className="mr-0 sm:mr-1.5"
                            >
                              <Loader2 className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <Save className="w-4 h-4 mr-0 sm:mr-1.5" />
                          )}
                          <span className="hidden sm:inline">
                            {isGeneratingPreview ? '生成中' : '保存'}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {isGeneratingPreview 
                            ? '正在生成预览内容...' 
                            : hasChanges 
                              ? '保存配置文件' 
                              : '没有需要保存的更改'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
        
        {/* 编辑器内容 - 双视图保持渲染，通过CSS控制显示/隐藏以保留滚动位置 */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {/* 表单视图 */}
          <motion.div
            initial={false}
            animate={{
              x: viewMode === 'form' ? 0 : -30,
              opacity: viewMode === 'form' ? 1 : 0,
              pointerEvents: viewMode === 'form' ? 'auto' : 'none',
            }}
            transition={{ duration: 0.25, ease: easings.standard }}
            className="h-full overflow-hidden absolute inset-0"
            style={{ visibility: viewMode === 'form' ? 'visible' : 'hidden' }}
          >
            <ScrollArea 
              className="h-full w-full" 
              type="always"
              ref={formScrollViewportRef}
              onScroll={(e) => {
                formScrollRef.current = (e.target as HTMLDivElement).scrollTop;
              }}
            >
              <div className="p-5 space-y-2">
                {topLevelConfigs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileCode className="w-12 h-12 text-[#3a3a3a] mb-4" />
                    <p className="text-[#707070]">配置文件为空或无法解析</p>
                  </div>
                ) : (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.05,
                          delayChildren: 0.05,
                        },
                      },
                    }}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                  >
                    {topLevelConfigs.map((config) => {
                      // 获取该配置项的直接子配置项
                      // 支持对象属性 (parent.key) 和数组元素 (parent[0]) 两种路径格式
                      const childConfigs = configValues.filter(
                        c => {
                          const isDirectChild = c.depth === config.depth + 1;
                          if (!isDirectChild) return false;
                          // 对象属性: parent.child (确保是直接的子属性)
                          if (c.path.startsWith(config.path + '.')) {
                            const remaining = c.path.slice((config.path + '.').length);
                            // 剩余部分不能包含 . 或 [，否则是更深层的嵌套
                            return !remaining.includes('.') && !remaining.includes('[');
                          }
                          // 数组元素: parent[0] (确保是直接的数组元素)
                          if (c.path.startsWith(config.path + '[')) {
                            const remaining = c.path.slice(config.path.length);
                            // 匹配 [数字] 且后面没有其他字符
                            return /^\[\d+\]$/.test(remaining);
                          }
                          return false;
                        }
                      );
                      return (
                        <motion.div 
                          key={config.path} 
                          variants={{
                            hidden: { opacity: 0, y: 16 },
                            visible: { 
                              opacity: 1, 
                              y: 0,
                              transition: { 
                                duration: 0.3, 
                                ease: [0.25, 0.1, 0.25, 1] 
                              }
                            },
                          }}
                        >
                          <ConfigItemEditor
                            config={config}
                            value={config.value}
                            onChange={handleValueChange}
                            onArrayChange={handleArrayChange}
                            isExpanded={expandedPaths.has(config.path)}
                            onToggle={() => toggleExpanded(config.path)}
                            childConfigs={childConfigs}
                            expandedPaths={expandedPaths}
                            toggleExpanded={toggleExpanded}
                            allConfigValues={configValues}
                            isModified={isPathModified(config.path)}
                            checkModified={isPathModified}
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
          
          {/* 代码视图 */}
          <motion.div
            initial={false}
            animate={{
              x: viewMode === 'code' ? 0 : 30,
              opacity: viewMode === 'code' ? 1 : 0,
              pointerEvents: viewMode === 'code' ? 'auto' : 'none',
            }}
            transition={{ duration: 0.25, ease: easings.standard }}
            className="h-full overflow-hidden bg-[#0d0d0d] absolute inset-0"
            style={{ visibility: viewMode === 'code' ? 'visible' : 'hidden' }}
          >
            <ScrollArea 
              className="h-full w-full" 
              type="always"
              ref={codeScrollViewportRef}
              onScroll={(e) => {
                codeScrollRef.current = (e.target as HTMLDivElement).scrollTop;
              }}
            >
              <CodePreview content={finalPreviewContent} type={fileType} />
            </ScrollArea>
          </motion.div>
        </div>
      </motion.div>
  );
}

export default ModConfigEditor;

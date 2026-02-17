'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  fadeIn, 
  easings
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
      return <Type className="w-3 h-3" />;
    case 'number':
      return <Hash className="w-3 h-3" />;
    case 'boolean':
      return <ToggleLeft className="w-3 h-3" />;
    case 'object':
    case 'array':
      return <Braces className="w-3 h-3" />;
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

// 检测行是否为键定义行，返回键名、完整路径和缩进层级
// 支持嵌套 section 如 [M.m] -> key='m', fullPath=['M', 'm']
function parseKeyLine(line: string): { 
  key: string; 
  fullPath: string[];
  indent: number; 
  isSection: boolean;
  isNestedSection: boolean;
} | null {
  const indent = line.length - line.trimStart().length;
  const trimmed = line.trim();
  
  // TOML section: [key] 或 [[key]] 或 [a.b.c]
  const sectionMatch = trimmed.match(/^\[\[?\s*([^\]]+)\s*\]\]?$/);
  if (sectionMatch) {
    const sectionName = sectionMatch[1].trim();
    // 处理嵌套 section 如 "M.m" -> ['M', 'm']
    const pathParts = sectionName.split('.').map(p => p.trim());
    const key = pathParts[pathParts.length - 1];
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
  
  // JSON5/TOML: 'key': 或 key: 或 key =
  const json5Match = trimmed.match(/^'([^']+)'\s*[:=]/);
  if (json5Match) {
    return { key: json5Match[1], fullPath: [json5Match[1]], indent, isSection: false, isNestedSection: false };
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

// 从注释提取描述（支持层级感知，包括嵌套 section）
function extractDescription(
  content: string, 
  key: string, 
  parentPath: string = ''
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
          // 找到目标键，向前查找注释
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
          
          if (descriptionLines.length > 0) {
            return descriptionLines.join('\n');
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
  depth: number = 0
): ConfigValue[] {
  const results: ConfigValue[] = [];
  
  if (obj === null) {
    return [{ key: path, value: null, type: 'null', path, depth }];
  }
  
  if (typeof obj === 'object' && !Array.isArray(obj)) {
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
        description: extractDescription(content, key, parentPath),
        path: currentPath,
        depth,
      });
      
      if (typeof value === 'object' && value !== null) {
        results.push(...extractConfigValues(value, content, currentPath, depth + 1));
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const currentPath = `${path}[${index}]`;
      results.push(...extractConfigValues(item, content, currentPath, depth + 1));
    });
  }
  
  return results;
}

// 配置项编辑器 - 优化排版版本
interface ConfigItemEditorProps {
  config: ConfigValue;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  isExpanded: boolean;
  onToggle: () => void;
  childConfigs?: ConfigValue[];
  expandedPaths?: Set<string>;
  toggleExpanded?: (path: string) => void;
  allConfigValues?: ConfigValue[];
}

const ConfigItemEditor = ({ 
  config, 
  value, 
  onChange, 
  isExpanded, 
  onToggle, 
  childConfigs = [],
  expandedPaths = new Set(),
  toggleExpanded = () => {},
  allConfigValues = []
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
              'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
              localValue ? 'bg-emerald-500' : 'bg-[#3a3a3a]'
            )}
          >
            <motion.div
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
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
                'px-3 py-1.5 rounded-md bg-[#141414] border text-sm font-mono w-28 h-8',
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
                'w-full px-3 py-1.5 rounded-md bg-[#141414] border text-sm h-8',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
                'transition-all duration-200',
                isEditing ? 'border-emerald-500 text-white' : 'border-[#2a2a2a] text-emerald-400'
              )}
            />
          </div>
        );
        
      default:
        return (
          <span className="text-[#707070] text-sm italic px-3 py-1.5">
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
    
    return (
      <div
        className="group"
        style={{ marginLeft: `${config.depth * 12}px` }}
      >
        {/* 父级项 - 卡片样式 */}
        <div 
          className={cn(
            'rounded-lg border transition-all duration-200 overflow-hidden',
            getTypeBgColor(config.type),
            isExpanded ? 'border-opacity-50 shadow-lg shadow-black/20' : 'hover:border-opacity-30'
          )}
        >
          {/* 头部 - 可点击展开 */}
          <button
            onClick={onToggle}
            className="w-full px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* 展开指示器 */}
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0 text-[#707070] mt-0.5"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.div>
              
              {/* 类型图标 */}
              <div className={cn('flex-shrink-0 mt-0.5', getTypeColor(config.type))}>
                <ValueTypeIcon type={config.type} />
              </div>
              
              {/* 键名和描述 */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                {/* 键名和数量标签 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'font-medium text-sm',
                    config.depth === 0 ? 'text-white' : 'text-[#a0a0a0]'
                  )}>
                    {config.key}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-4 border-0 font-normal flex-shrink-0',
                      getTypeBgColor(config.type),
                      getTypeColor(config.type)
                    )}
                  >
                    {childrenCount} 项
                  </Badge>
                </div>
                
                {/* 描述 - 完整展示，保留换行 */}
                {descriptionLines.length > 0 && (
                  <div className="space-y-0.5 mt-0.5">
                    {descriptionLines.map((line, index) => (
                      <p 
                        key={index} 
                        className="text-xs text-[#707070] leading-relaxed whitespace-pre-wrap break-words text-left"
                      >
                        {line ? highlightNumbersInText(line) : '\u00A0'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
          
          {/* 子项展开区域 */}
          <AnimatePresence>
            {isExpanded && childConfigs.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: easings.standard }}
                className="overflow-hidden"
              >
                {/* 子项容器 - 带左边框表示层级 */}
                <div className="px-3 pb-3">
                  <div className="pl-3 border-l-2 border-[#2a2a2a] space-y-1">
                    {childConfigs.map((childConfig) => {
                      // 计算子节点的子配置项
                      const grandChildConfigs = allConfigValues.filter(
                        c => c.path.startsWith(childConfig.path + '.') && c.depth === childConfig.depth + 1
                      );
                      const hasGrandChildren = grandChildConfigs.length > 0;
                      
                      return (
                        <ConfigItemEditor
                          key={childConfig.path}
                          config={childConfig}
                          value={childConfig.value}
                          onChange={onChange}
                          isExpanded={expandedPaths.has(childConfig.path)}
                          onToggle={() => toggleExpanded(childConfig.path)}
                          childConfigs={hasGrandChildren ? grandChildConfigs : []}
                          expandedPaths={expandedPaths}
                          toggleExpanded={toggleExpanded}
                          allConfigValues={allConfigValues}
                        />
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
  
  // 渲染叶节点（基本类型）- 完整描述展示
  // 将描述按换行分割
  const descriptionLines = config.description ? config.description.split('\n') : [];
  
  return (
    <div
      className="group"
      style={{ marginLeft: `${config.depth * 12}px` }}
    >
      <div className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200',
        'hover:border-[#3a3a3a] hover:bg-white/[0.02]',
        getTypeBgColor(config.type)
      )}>
        {/* 左侧占位（保持对齐） */}
        <div className="w-4 flex-shrink-0 mt-0.5" />
        
        {/* 类型图标 */}
        <div className={cn('flex-shrink-0 mt-0.5', getTypeColor(config.type))}>
          <ValueTypeIcon type={config.type} />
        </div>
        
        {/* 键名、描述和编辑器区域 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* 第一行：键名 + 类型标签 + 编辑器 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={cn(
                'font-medium text-sm',
                config.depth === 0 ? 'text-white' : 'text-[#b0b0b0]'
              )}>
                {config.key}
              </span>
              <Badge 
                variant="outline" 
                className={cn(
                  'text-[9px] px-1 py-0 h-3.5 border-0 font-normal opacity-60 flex-shrink-0',
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
          </div>
          
          {/* 描述 - 完整展示，保留换行 */}
          {descriptionLines.length > 0 && (
            <div className="space-y-0.5 mt-0.5">
              {descriptionLines.map((line, index) => (
                <p 
                  key={index} 
                  className="text-xs text-[#707070] leading-relaxed whitespace-pre-wrap break-words"
                >
                  {line ? highlightNumbersInText(line) : '\u00A0'}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
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

// 转义 HTML 特殊字符
const escapeHtml = (str: string): string => 
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    
    // 6. 注释 (JSON5: //, /* */; TOML: #)
    if ((fileType === 'json5' && (peek(0) + peek(1) === '//' || peek(0) + peek(1) === '/*')) ||
        (fileType === 'toml' && char === '#')) {
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
const postProcessTokens = (tokens: Token[], fileType: 'json' | 'json5' | 'toml'): Token[] => {
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
      return postProcessTokens(tokens, type);
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
    <div className="flex font-mono text-sm leading-6">
      {/* 行号列 */}
      <div 
        className="flex-shrink-0 py-4 text-right select-none border-r border-[#2a2a2a] bg-[#0a0a0a]"
        style={{ minWidth: `${lineNumberWidth}rem` }}
      >
        {lines.map((_, idx) => (
          <div 
            key={idx} 
            className="px-3 text-gray-600 text-xs leading-6"
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
              <div key={lineIdx} className="px-4 min-h-[1.5rem]">
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
  const [content, setContent] = useState<string>('');
  const [parsed, setParsed] = useState<unknown>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'code'>('form');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
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
  
  // 监听 parsed 变化，与原始内容比较以确定是否有更改
  useEffect(() => {
    const compareContent = async () => {
      if (!parsed || !originalContent) {
        setHasChanges(false);
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
    return extractConfigValues(parsed, content);
  }, [parsed, content]);
  
  // 过滤出顶层配置项
  const topLevelConfigs = useMemo(() => {
    return configValues.filter(c => c.depth === 0);
  }, [configValues]);
  
  // 处理值变更
  const handleValueChange = useCallback((path: string, newValue: unknown) => {
    setParsed((prev: unknown) => {
      const newParsed = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current: Record<string, unknown> = newParsed as Record<string, unknown>;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }
      
      current[keys[keys.length - 1]] = newValue;
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
  
  // 保存文件
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      // 根据类型生成内容
      let finalContent = content;
      if (viewMode === 'form' && parsed) {
        if (fileType === 'json') {
          finalContent = JSON.stringify(parsed, null, 2);
        } else if (fileType === 'json5') {
          // JSON5 尝试保留注释（简化处理：使用原始内容）
          finalContent = JSON.stringify(parsed, null, 2);
        } else if (fileType === 'toml') {
          // TOML 需要重新序列化
          const { default: TOML } = await import('@iarna/toml');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finalContent = TOML.stringify(parsed as any);
        }
      }
      
      const res = await fetch('/api/mod-configs/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content: finalContent,
          format: fileType,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setOriginalContent(finalContent);
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        onSave?.();
      } else {
        setError(data.error || 'Failed to save file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };
  
  // 重置更改
  const handleReset = async () => {
    setContent(originalContent);
    // 根据文件类型解析原始内容
    try {
      if (fileType === 'toml') {
        const { default: TOML } = await import('@iarna/toml');
        setParsed(TOML.parse(originalContent));
      } else if (fileType === 'json5') {
        const JSON5 = await import('json5');
        setParsed(JSON5.parse(originalContent));
      } else {
        setParsed(JSON.parse(originalContent));
      }
    } catch (e) {
      // 如果解析失败，保持当前 parsed 值
      console.error('Failed to parse original content:', e);
    }
    setHasChanges(false);
  };
  
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
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
        >
          <FileCode className="w-8 h-8 text-emerald-500" />
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
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#151515]/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <FileTypeIcon type={fileType} className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-white text-sm truncate">{filePath}</h3>
              <p className="text-xs text-[#707070]">{modName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 展开/折叠控制（仅在表单模式下显示） */}
            {viewMode === 'form' && (
              <div className="hidden sm:flex items-center gap-1 mr-2">
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
              </div>
            )}
            
            {/* 视图切换 */}
            <div className="flex bg-[#1a1a1a] rounded-lg p-0.5 border border-[#2a2a2a]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('form')}
                    className={cn(
                      'h-7 px-2 text-xs',
                      viewMode === 'form' 
                        ? 'bg-[#262626] text-white' 
                        : 'text-[#707070] hover:text-white'
                    )}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    表单
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
                      'h-7 px-2 text-xs',
                      viewMode === 'code' 
                        ? 'bg-[#262626] text-white' 
                        : 'text-[#707070] hover:text-white'
                    )}
                  >
                    <Code className="w-3.5 h-3.5 mr-1" />
                    代码
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>源代码编辑模式</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* 保存状态指示 - 已保存 */}
            <AnimatePresence mode="wait">
              {saveSuccess && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium whitespace-nowrap">已保存</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* 未保存状态与重置按钮容器 - 统一动画 */}
            <AnimatePresence>
              {hasChanges && !saveSuccess && (
                <motion.div
                  key="unsaved-group"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex items-center gap-2"
                >
                  {/* 未保存指示 */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-medium whitespace-nowrap">未保存</span>
                  </div>
                  
                  {/* 重置按钮 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        className="h-8 w-8 text-[#707070] hover:text-white hover:bg-[#2a2a2a] flex-shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>重置更改</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className={cn(
                    'h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-black font-medium',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {saving ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                    >
                      <Save className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  保存
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>保存配置文件</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        {/* 编辑器内容 */}
        {/* 编辑器内容 */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {viewMode === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-hidden absolute inset-0"
            >
              <ScrollArea className="h-full w-full" type="always">
                <div className="p-4 space-y-1">
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
                      className="space-y-1"
                    >
                      {topLevelConfigs.map((config) => {
                        // 获取该配置项的直接子配置项
                        const childConfigs = configValues.filter(
                          c => c.path.startsWith(config.path + '.') && c.depth === config.depth + 1
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
                              isExpanded={expandedPaths.has(config.path)}
                              onToggle={() => toggleExpanded(config.path)}
                              childConfigs={childConfigs}
                              expandedPaths={expandedPaths}
                              toggleExpanded={toggleExpanded}
                              allConfigValues={configValues}
                            />
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-hidden bg-[#0d0d0d] absolute inset-0"
            >
              <ScrollArea className="h-full w-full" type="always">
                <CodePreview content={content} type={fileType} />
              </ScrollArea>
            </motion.div>
          )}
        </div>
      </motion.div>
  );
}

export default ModConfigEditor;

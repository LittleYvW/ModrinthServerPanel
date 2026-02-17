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

// 从注释提取描述（保留换行格式）
function extractDescription(content: string, key: string): string | undefined {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 查找包含该键的行
    if (line.includes(`"${key}"`) || line.includes(`${key}:`) || line.includes(`${key} =`)) {
      // 向前查找注释（保留原始格式）
      const descriptionLines: string[] = [];
      for (let j = Math.max(0, i - 10); j < i; j++) {
        const prevLine = lines[j];
        const trimmedLine = prevLine.trim();
        // JSON/JSON5/TOML 风格的注释
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
          const comment = trimmedLine
            .replace(/^\/\//, '')
            .replace(/^#/, '')
            .replace(/^\/\*/, '')
            .replace(/\*\/$/, '')
            .replace(/^\*\s*/, '')
            .trim();
          if (comment && !comment.startsWith('===') && !comment.startsWith('---')) {
            descriptionLines.push(comment);
          }
        } else if (trimmedLine === '' && descriptionLines.length > 0) {
          // 空行表示注释块结束，保留为换行
          break;
        }
      }
      if (descriptionLines.length > 0) {
        // 保留换行，使用特殊分隔符，渲染时再处理
        return descriptionLines.join('\n');
      }
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
      
      results.push({
        key,
        value,
        type,
        description: extractDescription(content, key),
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
}

const ConfigItemEditor = ({ config, value, onChange, isExpanded, onToggle, childConfigs = [] }: ConfigItemEditorProps) => {
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
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
              animate={{ 
                left: localValue ? 'calc(100% - 1.375rem)' : '0.125rem' 
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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
                        {line || '\u00A0'}
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
                    {childConfigs.map((childConfig) => (
                      <ConfigItemEditor
                        key={childConfig.path}
                        config={childConfig}
                        value={childConfig.value}
                        onChange={onChange}
                        isExpanded={false}
                        onToggle={() => {}}
                        childConfigs={[]}
                      />
                    ))}
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
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 代码预览模式 - 使用 Prism 风格但不显示颜色代码
interface CodePreviewProps {
  content: string;
  type: 'json' | 'json5' | 'toml';
}

const CodePreview = ({ content, type }: CodePreviewProps) => {
  // 将内容分割成 token 进行高亮
  const renderHighlighted = () => {
    if (!content) return null;
    
    const lines = content.split('\n');
    
    return lines.map((line, lineIdx) => {
      const tokens: React.ReactNode[] = [];
      let remaining = line;
      let keyCounter = 0;
      
      // 首先转义 HTML 特殊字符
      const escapeHtml = (str: string) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      // TOML section header [section]
      if (type === 'toml') {
        const sectionMatch = remaining.match(/^(\s*)(\[)([^\]]+)(\])(\s*)$/);
        if (sectionMatch) {
          tokens.push(
            <span key={keyCounter++}>{escapeHtml(sectionMatch[1])}</span>,
            <span key={keyCounter++} className="text-amber-400">{escapeHtml(sectionMatch[2] + sectionMatch[3] + sectionMatch[4])}</span>,
            <span key={keyCounter++}>{escapeHtml(sectionMatch[5])}</span>
          );
          remaining = '';
        }
      }
      
      // 逐行解析
      while (remaining.length > 0) {
        let matched = false;
        
        // 1. 字符串（双引号）- JSON/JSON5/TOML
        const strMatch = remaining.match(/^([^"]*)"([^"]*)"(.*)$/);
        if (strMatch) {
          if (strMatch[1]) tokens.push(<span key={keyCounter++}>{escapeHtml(strMatch[1])}</span>);
          tokens.push(<span key={keyCounter++} className="text-emerald-400">{escapeHtml('"' + strMatch[2] + '"')}</span>);
          remaining = strMatch[3];
          matched = true;
          continue;
        }
        
        // 2. 字符串（单引号）- JSON5/TOML
        const strSingleMatch = remaining.match(/^([^']*)'([^']*)'(.*)$/);
        if (strSingleMatch) {
          if (strSingleMatch[1]) tokens.push(<span key={keyCounter++}>{escapeHtml(strSingleMatch[1])}</span>);
          tokens.push(<span key={keyCounter++} className="text-emerald-400">{escapeHtml("'" + strSingleMatch[2] + "'")}</span>);
          remaining = strSingleMatch[3];
          matched = true;
          continue;
        }
        
        // 3. 数字
        const numMatch = remaining.match(/^([^0-9\-]*)(-?\d+\.?\d*)(.*)$/);
        if (numMatch && numMatch[2] && !isNaN(Number(numMatch[2]))) {
          // 检查是否是键名的一部分（后面跟着 = 或 :）
          const nextChar = numMatch[3].charAt(0);
          if (nextChar !== '=' && nextChar !== ':') {
            if (numMatch[1]) tokens.push(<span key={keyCounter++}>{escapeHtml(numMatch[1])}</span>);
            tokens.push(<span key={keyCounter++} className="text-blue-400">{escapeHtml(numMatch[2])}</span>);
            remaining = numMatch[3];
            matched = true;
            continue;
          }
        }
        
        // 4. 布尔值
        const boolMatch = remaining.match(/^(.*?)(\b(?:true|false)\b)(.*)$/i);
        if (boolMatch) {
          if (boolMatch[1]) tokens.push(<span key={keyCounter++}>{escapeHtml(boolMatch[1])}</span>);
          tokens.push(<span key={keyCounter++} className="text-purple-400">{escapeHtml(boolMatch[2])}</span>);
          remaining = boolMatch[3];
          matched = true;
          continue;
        }
        
        // 5. null
        const nullMatch = remaining.match(/^(.*?)(\bnull\b)(.*)$/);
        if (nullMatch) {
          if (nullMatch[1]) tokens.push(<span key={keyCounter++}>{escapeHtml(nullMatch[1])}</span>);
          tokens.push(<span key={keyCounter++} className="text-gray-500">{escapeHtml(nullMatch[2])}</span>);
          remaining = nullMatch[3];
          matched = true;
          continue;
        }
        
        // 6. 注释（TOML/JSON5）
        if (type === 'toml' || type === 'json5') {
          const commentMatch = remaining.match(/^(.*?)(#|\/\/)(.*)$/);
          if (commentMatch) {
            if (commentMatch[1]) tokens.push(<span key={keyCounter++}>{escapeHtml(commentMatch[1])}</span>);
            tokens.push(<span key={keyCounter++} className="text-gray-600 italic">{escapeHtml(commentMatch[2] + commentMatch[3])}</span>);
            remaining = '';
            matched = true;
            continue;
          }
        }
        
        // 没有匹配到任何 token，直接添加剩余部分
        if (!matched) {
          tokens.push(<span key={keyCounter++}>{escapeHtml(remaining)}</span>);
          remaining = '';
        }
      }
      
      return <div key={lineIdx}>{tokens}</div>;
    });
  };
  
  return (
    <pre className="font-mono text-sm leading-relaxed p-4 overflow-auto whitespace-pre-wrap break-all text-[#a0a0a0]">
      <code>{renderHighlighted()}</code>
    </pre>
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
    
    setHasChanges(true);
    setSaveSuccess(false);
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
            
            {/* 保存状态指示 */}
            <AnimatePresence mode="wait">
              {saveSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"
                >
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium">已保存</span>
                </motion.div>
              ) : hasChanges ? (
                <motion.div
                  key="unsaved"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-medium">未保存</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
            
            {/* 操作按钮 */}
            {hasChanges && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="h-8 w-8 text-[#707070] hover:text-white hover:bg-[#2a2a2a]"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>重置更改</p>
                </TooltipContent>
              </Tooltip>
            )}
            
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

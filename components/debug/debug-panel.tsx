'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebug, isDebugDisabled } from './debug-provider';
import { AlertCircle, X, RotateCcw, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// 元素监控信息
interface ElementInfo {
  name: string;
  selector: string;
  element?: HTMLElement | null;
}

// 监控数据
interface MonitorData {
  name: string;
  height: number;
  display: string;
  overflow: string;
  flex: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;
  minHeight: string;
  maxHeight: string;
  position: string;
}

interface DebugPanelProps {
  /** 要监控的元素列表 */
  elements: ElementInfo[];
  /** 自定义类名 */
  className?: string;
  /** 更新间隔（毫秒） */
  interval?: number;
  /** 快捷键，默认 'd' (Alt+D) */
  shortcutKey?: string;
  /** 是否需要按 Alt */
  useAlt?: boolean;
  /** 标题 */
  title?: string;
}

/**
 * Debug 面板组件
 * 
 * 使用示例:
 * ```tsx
 * <DebugPanel
 *   elements={[
 *     { name: 'Dialog', selector: '[data-slot="dialog-content"]' },
 *     { name: 'Tabs', selector: '[data-slot="tabs"]' },
 *     { name: 'Content', selector: '.my-content' },
 *   ]}
 * />
 * ```
 */
export function DebugPanel({
  elements,
  className,
  interval = 500,
  shortcutKey = 'd',
  useAlt = true,
  title = 'Debug Panel',
}: DebugPanelProps) {
  const { isEnabled, toggle, disable } = useDebug();
  const [data, setData] = useState<MonitorData[]>([]);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const elementRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  // 生产环境检查
  const isProd = useMemo(() => isDebugDisabled(), []);

  // 收集元素数据
  const collectData = useCallback(() => {
    const newData: MonitorData[] = elements.map(({ name, selector }) => {
      // 缓存元素引用以提高性能
      let el = elementRefs.current.get(selector);
      if (!el || !document.contains(el)) {
        el = document.querySelector(selector) as HTMLElement;
        elementRefs.current.set(selector, el);
      }

      if (!el) {
        return {
          name,
          height: 0,
          display: 'not found',
          overflow: '-',
          flex: '-',
          flexGrow: '-',
          flexShrink: '-',
          flexBasis: '-',
          minHeight: '-',
          maxHeight: '-',
          position: '-',
        };
      }

      const computed = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return {
        name,
        height: Math.round(rect.height),
        display: computed.display,
        overflow: computed.overflow,
        flex: computed.flex,
        flexGrow: computed.flexGrow,
        flexShrink: computed.flexShrink,
        flexBasis: computed.flexBasis,
        minHeight: computed.minHeight,
        maxHeight: computed.maxHeight,
        position: computed.position,
      };
    });

    setData(newData);
  }, [elements]);

  // 定时更新数据
  useEffect(() => {
    if (!isEnabled) return;

    collectData();
    const timer = setInterval(collectData, interval);
    return () => clearInterval(timer);
  }, [isEnabled, interval, collectData]);

  // 快捷键支持
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const keyMatch = e.key.toLowerCase() === shortcutKey.toLowerCase();
      const altMatch = useAlt ? e.altKey : true;
      
      if (altMatch && keyMatch) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, shortcutKey, useAlt]);

  // 复制数据到剪贴板
  const copyData = useCallback(() => {
    const text = data.map(d => 
      `${d.name}: ${d.height}px | display: ${d.display} | overflow: ${d.overflow} | flex: ${d.flex} | min-h: ${d.minHeight}`
    ).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  // 生产环境不渲染任何内容
  if (isProd) {
    return null;
  }

  // 未启用时不渲染
  if (!isEnabled) {
    return (
      <div className="px-6 pt-2 text-[10px] text-[#505050] select-none">
        按 {useAlt ? 'Alt+' : ''}{shortcutKey.toUpperCase()} 开启 Debug 模式
      </div>
    );
  }

  // 颜色映射
  const colors = [
    'text-blue-400',
    'text-green-400',
    'text-yellow-400',
    'text-purple-400',
    'text-orange-400',
    'text-pink-400',
    'text-cyan-400',
    'text-red-400',
  ];

  return (
    <div 
      className={cn(
        "mx-6 mb-2 bg-red-950/50 border border-red-500/50 rounded text-[11px] font-mono select-none",
        isMinimized && "p-2",
        !isMinimized && "p-3",
        className
      )}
    >
      {/* 头部 */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3 h-3 text-red-400" />
          <span className="text-red-400 font-bold">{title}</span>
          <span className="text-[#707070]">
            ({useAlt ? 'Alt+' : ''}{shortcutKey.toUpperCase()} 隐藏)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={collectData}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="刷新"
          >
            <RotateCcw className="w-3 h-3 text-[#a0a0a0]" />
          </button>
          <button
            onClick={copyData}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="复制数据"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-[#a0a0a0]" />
            )}
          </button>
          <button
            onClick={() => setIsMinimized(v => !v)}
            className="p-1 hover:bg-red-500/20 rounded transition-colors text-[#a0a0a0]"
            title={isMinimized ? '展开' : '最小化'}
          >
            {isMinimized ? '+' : '-'}
          </button>
          <button
            onClick={disable}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="关闭"
          >
            <X className="w-3 h-3 text-[#a0a0a0]" />
          </button>
        </div>
      </div>

      {/* 数据内容 */}
      {!isMinimized && (
        <div className="space-y-1 text-[#a0a0a0]">
          {data.map((item, index) => {
            const color = colors[index % colors.length];
            return (
              <div key={item.name} className="group">
                <div className="flex items-start gap-2">
                  <span className={cn("font-medium min-w-[80px]", color)}>
                    {item.name}:
                  </span>
                  <span className="text-white">{item.height}px</span>
                </div>
                <div className="pl-[88px] text-[10px] text-[#707070] grid grid-cols-2 gap-x-4">
                  <span>display: {item.display}</span>
                  <span>overflow: {item.overflow}</span>
                  <span>flex: {item.flex}</span>
                  <span>flex-grow: {item.flexGrow}</span>
                  <span>min-height: {item.minHeight}</span>
                  <span>max-height: {item.maxHeight}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 简化的 Debug 触发器，只显示提示文字
 */
export function DebugHint({ 
  shortcutKey = 'd',
  useAlt = true,
}: { 
  shortcutKey?: string;
  useAlt?: boolean;
}) {
  const { isEnabled } = useDebug();

  if (isDebugDisabled() || isEnabled) {
    return null;
  }

  return (
    <div className="px-6 pt-2 text-[10px] text-[#505050] select-none">
      按 {useAlt ? 'Alt+' : ''}{shortcutKey.toUpperCase()} 开启 Debug 模式
    </div>
  );
}

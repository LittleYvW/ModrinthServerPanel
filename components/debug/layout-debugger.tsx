'use client';

import { useMemo } from 'react';
import { DebugPanel } from './debug-panel';
import { isDebugDisabled } from './debug-provider';

interface LayoutDebuggerProps {
  /** 容器元素选择器 */
  containerSelector?: string;
  /** 中间层元素选择器（如 Tabs） */
  middleSelector?: string;
  /** 内容区域选择器（如 TabsContent） */
  contentSelector?: string;
  /** 滚动区域选择器 */
  scrollAreaSelector?: string;
  /** 视口选择器 */
  viewportSelector?: string;
  /** 内部内容选择器 */
  innerContentSelector?: string;
  /** 自定义额外的元素 */
  extraElements?: Array<{ name: string; selector: string }>;
  /** 类名 */
  className?: string;
}

/**
 * 布局调试器 - 专门用于调试 flex/scroll 布局问题
 * 
 * 预设了常见的布局层级监控：
 * - Container: 最外层容器
 * - Middle: 中间层（如 Tabs）
 * - Content: 内容区域（如 TabsContent）
 * - ScrollArea: 滚动区域
 * - Viewport: 滚动视口
 * - InnerContent: 实际内容
 */
export function LayoutDebugger({
  containerSelector = '[data-slot="dialog-content"]',
  middleSelector = '[data-slot="tabs"]',
  contentSelector = '[data-slot="tabs-content"][data-state="active"]',
  scrollAreaSelector = '[data-slot="scroll-area"]',
  viewportSelector = '[data-slot="scroll-area-viewport"]',
  innerContentSelector,
  extraElements = [],
  className,
}: LayoutDebuggerProps) {
  // 所有 hooks 必须在任何早期返回之前调用
  const isProd = useMemo(() => isDebugDisabled(), []);
  
  const elements = useMemo(() => {
    const base = [
      { name: 'Container', selector: containerSelector },
      { name: 'Middle', selector: middleSelector },
      { name: 'Content', selector: contentSelector },
      { name: 'ScrollArea', selector: scrollAreaSelector },
      { name: 'Viewport', selector: viewportSelector },
    ];
    
    if (innerContentSelector) {
      base.push({ name: 'InnerContent', selector: innerContentSelector });
    }
    
    return [...base, ...extraElements];
  }, [
    containerSelector,
    middleSelector,
    contentSelector,
    scrollAreaSelector,
    viewportSelector,
    innerContentSelector,
    extraElements,
  ]);

  // 生产环境不渲染
  if (isProd) {
    return null;
  }

  return (
    <DebugPanel
      elements={elements}
      title="Layout Debug"
      className={className}
    />
  );
}

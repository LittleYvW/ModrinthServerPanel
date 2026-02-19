// Debug 架构 - 统一导出
// 
// 使用方法:
// 1. 在 layout.tsx 中包裹 DebugProvider
// 2. 在需要调试的组件中使用 DebugPanel 或 LayoutDebugger
//
// 环境变量:
// - NEXT_PUBLIC_DEBUG=true: 默认启用 Debug 模式
//
// 快捷键:
// - Alt+D: 切换 Debug 面板显示

export { 
  DebugProvider, 
  useDebug, 
  isDebugDisabled 
} from './debug-provider';

export { 
  DebugPanel, 
  DebugHint 
} from './debug-panel';

export { 
  LayoutDebugger 
} from './layout-debugger';

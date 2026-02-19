# Debug 架构

可复用的调试工具集，用于开发时监控布局、性能等问题。

## 特性

- 🚫 **生产环境自动禁用** - 不会在生产环境渲染任何内容
- ⌨️ **快捷键支持** - Alt+D 快速切换显示
- 🔧 **灵活配置** - 支持自定义监控元素和快捷键
- 📋 **一键复制** - 快速复制调试数据到剪贴板
- 🎨 **颜色编码** - 不同元素使用不同颜色区分

## 使用方法

### 1. 在 layout.tsx 中启用

```tsx
import { DebugProvider } from '@/components/debug';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <DebugProvider>
          {children}
        </DebugProvider>
      </body>
    </html>
  );
}
```

### 2. 在组件中使用

#### 方式一：使用 LayoutDebugger（推荐用于布局问题）

```tsx
import { LayoutDebugger } from '@/components/debug';

export function MyComponent() {
  return (
    <div>
      {/* 内容 */}
      <LayoutDebugger />
    </div>
  );
}
```

#### 方式二：使用 DebugPanel（自定义监控）

```tsx
import { DebugPanel } from '@/components/debug';

export function MyComponent() {
  return (
    <div>
      {/* 内容 */}
      <DebugPanel
        elements={[
          { name: 'Container', selector: '.my-container' },
          { name: 'Header', selector: '[data-header]' },
          { name: 'Content', selector: '.content' },
        ]}
        interval={500}
        shortcutKey="d"
        title="My Debug"
      />
    </div>
  );
}
```

### 3. 快捷键

- **Alt+D** - 切换 Debug 面板显示/隐藏

### 4. 环境变量

```bash
# .env.local
NEXT_PUBLIC_DEBUG=true  # 默认启用 Debug 模式
```

## API 参考

### DebugProvider

包裹应用以提供 Debug 上下文。

### LayoutDebugger

专门用于调试 flex/scroll 布局问题的组件。

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `containerSelector` | `string` | `[data-slot="dialog-content"]` | 容器元素 |
| `middleSelector` | `string` | `[data-slot="tabs"]` | 中间层元素 |
| `contentSelector` | `string` | `[data-slot="tabs-content"]` | 内容区域 |
| `scrollAreaSelector` | `string` | `[data-slot="scroll-area"]` | 滚动区域 |
| `viewportSelector` | `string` | `[data-slot="scroll-area-viewport"]` | 视口 |
| `innerContentSelector` | `string` | - | 内部内容 |
| `extraElements` | `Array<{name, selector}>` | `[]` | 额外监控元素 |
| `className` | `string` | - | 自定义类名 |

### DebugPanel

通用的元素监控面板。

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `elements` | `Array<{name, selector}>` | 必填 | 要监控的元素列表 |
| `interval` | `number` | `500` | 数据更新间隔(ms) |
| `shortcutKey` | `string` | `'d'` | 快捷键 |
| `useAlt` | `boolean` | `true` | 是否需要按 Alt |
| `title` | `string` | `'Debug Panel'` | 面板标题 |
| `className` | `string` | - | 自定义类名 |

### useDebug Hook

在组件中控制 Debug 模式。

```tsx
const { isEnabled, toggle, enable, disable } = useDebug();
```

## 生产环境

在生产环境（`NODE_ENV=production`）中：
- 除非设置 `NEXT_PUBLIC_DEBUG=true`，否则 Debug 组件不会渲染任何内容
- 不会注册快捷键事件
- 不会执行任何监控逻辑

## 最佳实践

1. **在 Dialog/Modal 中使用** - 特别适合调试弹出层内的滚动问题
2. **配合 data-slot 使用** - 为关键元素添加 `data-slot` 属性便于选择
3. **开发完成后移除** - 虽然生产环境不会显示，但建议开发完成后移除 Debug 代码

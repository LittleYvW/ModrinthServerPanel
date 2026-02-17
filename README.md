# Modrinth Server Panel

Minecraft 服务器模组管理面板，对接 [Modrinth](https://modrinth.com) 平台，提供从搜索、下载到依赖分析的全流程管理。支持访客/管理员双模式访问，智能依赖管理，自动化更新和模组分类管理。

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4)

---

## 功能特性

### 双模式访问
- **访客模式**：浏览模组列表，下载双端必需模组
- **管理员模式**：完整的模组管理、配置和更新控制权限

### 模组管理
- 从 Modrinth 搜索并下载模组
- 支持 Fabric、Forge、Quilt、NeoForge 多种加载器
- 模组分类：双端必需 / 仅服务端 / 仅客户端
- 模组启用/禁用切换
- 依赖自动分析与缺失依赖一键添加
- 模组更新检查

### 配置文件管理
- 自动扫描服务端 `config/` 目录，智能匹配模组配置文件
- 支持 `.json`、`.json5`、`.toml` 格式
- 可视化表单编辑与代码模式切换
- 自动提取配置文件注释作为配置说明
- 实时验证与保存

### 下载队列
- 多任务并发下载
- 实时进度显示
- 下载状态管理

---

## 技术栈

- **运行时**: Node.js 18+
- **框架**: [Next.js](https://nextjs.org/) 16 + [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/) 5
- **样式**: [TailwindCSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) (New York)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **图标**: [Lucide React](https://lucide.dev/)
- **存储**: 本地 JSON 文件
- **API**: [Modrinth REST API](https://docs.modrinth.com/)

---

## 快速开始

### 环境要求

- Node.js 18 或更高版本
- npm 或兼容的包管理器

### 安装与运行

```bash
# 克隆项目
git clone <repository-url>
cd my-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000，使用默认管理员密码 `admin` 登录。

### 生产部署

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

项目配置为 standalone 输出模式，构建产物可直接部署。

---

## 使用指南

### 首次配置

1. 以管理员身份登录（默认密码：`admin`）
2. 进入设置页面，配置以下信息：
   - **服务端路径**: Minecraft 服务器根目录的绝对路径
   - **Minecraft 版本**: 如 `1.20.1`
   - **加载器类型**: fabric / forge / quilt / neoforge
   - **加载器版本**: 如 `0.15.0`
3. 保存配置后即可开始使用

### 安装模组

1. 使用搜索功能查找 Modrinth 上的模组
2. 选择合适的版本（系统会自动匹配 Minecraft 版本和加载器类型）
3. 点击安装，系统会自动处理依赖关系
4. 在下载队列中查看下载进度

### 配置文件编辑

1. 在模组列表中点击模组卡片的"配置"按钮
2. 系统会自动扫描并匹配相关配置文件
3. 支持手动关联/取消关联配置文件
4. 使用表单模式或代码模式编辑配置
5. 保存后自动写入服务端目录

---

## 项目结构

```
.
├── app/                      # Next.js App Router
│   ├── api/                  # API 路由
│   │   ├── auth/             # 认证接口
│   │   ├── config/           # 服务器配置
│   │   ├── download/         # 文件下载
│   │   ├── mods/             # 模组管理
│   │   ├── projects/         # Modrinth 项目
│   │   ├── search/           # 模组搜索
│   │   └── mod-configs/      # 配置文件管理
│   ├── globals.css           # 全局样式
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # 主页面
├── components/               # React 组件
│   ├── ui/                   # shadcn/ui 组件
│   ├── admin-view.tsx        # 管理员视图
│   ├── visitor-view.tsx      # 访客视图
│   ├── mod-search.tsx        # 模组搜索
│   ├── mod-manager.tsx       # 模组管理
│   ├── download-panel.tsx    # 下载队列
│   ├── dependency-analyzer.tsx
│   ├── mod-config-editor.tsx
│   └── ...
├── lib/                      # 工具库
│   ├── modrinth.ts           # Modrinth API 封装
│   ├── db.ts                 # JSON 数据库操作
│   ├── download-queue.tsx    # 下载队列状态管理
│   └── ...
├── data/                     # 本地数据存储
│   ├── auth.json             # 管理员密码
│   ├── config.json           # 服务器配置
│   ├── mods.json             # 已安装模组列表
│   └── mod-configs.json      # 配置文件关联
└── public/                   # 静态资源
```

---

## API 接口

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/auth` | POST | 管理员登录验证 |
| `/api/config` | GET/POST | 读取/保存服务器配置 |
| `/api/mods` | GET/POST/DELETE | 模组列表/安装/卸载 |
| `/api/mods/check-updates` | POST | 检查模组更新 |
| `/api/search` | GET | 搜索 Modrinth 模组 |
| `/api/projects/:id` | GET | 获取项目详情 |
| `/api/download` | POST | 下载文件到服务器 |
| `/api/mod-configs` | GET/POST/PUT/DELETE | 配置文件关联管理 |
| `/api/mod-configs/scan` | POST | 自动扫描 config 目录 |
| `/api/mod-configs/file` | GET/POST/PUT | 读取/保存/验证配置文件 |

---

## 注意事项

1. **权限要求**: 应用需要对配置的服务端目录有读写权限
2. **安全性**: 生产环境务必修改默认管理员密码
3. **数据持久化**: `data/` 目录需要持久化存储，避免数据丢失
4. **API 限制**: 注意 Modrinth API 的调用频率限制
5. **主题**: 应用采用固定的 Modrinth 风格深色主题

---

## 相关资源

- [Modrinth API 文档](https://docs.modrinth.com/)
- [Next.js 文档](https://nextjs.org/docs)
- [shadcn/ui 文档](https://ui.shadcn.com/)

---

## License

[MIT](LICENSE)

# Modrinth Server Panel

Minecraft 服务器模组管理面板，对接 Modrinth 平台，提供从搜索、下载到依赖分析的全流程管理。

## 核心功能

**双模式访问**
- 访客模式：浏览和下载双端必需模组
- 管理员模式：完整的模组管理、配置和更新控制

**智能依赖管理**
- 自动扫描模组依赖关系
- 检测缺失的前置模组和版本冲突
- 一键添加缺失依赖

**自动化更新**
- 智能版本检查（支持 Semantic Versioning）
- 仅展示兼容当前服务端配置的更新
- 批量更新支持

**模组分类管理**
- 双端必需 / 仅服务端 / 仅客户端 三种分类
- 独立的客户端模组目录隔离
- 模组启用/禁用切换

## 技术栈

- **框架**: Next.js 16 + React 19 + TypeScript 5
- **样式**: TailwindCSS v4 + shadcn/ui
- **动画**: Framer Motion
- **数据**: JSON 文件本地存储
- **API**: Modrinth REST API

## 快速开始

**环境要求**
- Node.js 18+

**安装与启动**

```bash
npm install
npm run dev
```

访问 http://localhost:3000，默认管理员密码 `admin`。

**生产部署**

```bash
npm run build
npm start
```

构建输出为 standalone 模式，可直接部署。

## 配置说明

首次启动后，在管理员界面配置服务端路径、Minecraft 版本和加载器类型（Fabric / Forge / Quilt / NeoForge）。

模组将下载到 `{服务端路径}/mods/` 目录，数据存储在 `data/` 目录下。

## 许可证

MIT

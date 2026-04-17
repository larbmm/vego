# 文档索引

## 主要文档

- **[README.md](README.md)** - 项目主文档，包含功能介绍、快速开始、配置说明
- **[QUICKSTART.md](QUICKSTART.md)** - 快速开始指南
- **[CHANGELOG.md](CHANGELOG.md)** - 完整的更新日志

## 配置文件

- **[config.example.toml](config.example.toml)** - 配置文件示例
- **[.env.example](.env.example)** - 环境变量示例

## 详细文档（在 backups/docs/ 目录）

- **[GROUP_CHAT_FEATURES.md](backups/docs/GROUP_CHAT_FEATURES.md)** - 群聊功能详细说明
  - 场景区分机制
  - 多群隔离机制
  - 跨角色协作
  - 上下文管理
  - 配置说明
  - 测试方法

- **[MULTI_GROUP_EXPLANATION.md](backups/docs/MULTI_GROUP_EXPLANATION.md)** - 多群隔离机制详解
  - 架构设计
  - 示例场景
  - 隔离机制
  - 工作流程

- **[WEB_INTERFACE.md](backups/docs/WEB_INTERFACE.md)** - Web管理界面详细说明
  - 功能列表
  - 使用方法
  - API接口

- **[DATABASE_MIGRATION.md](backups/docs/DATABASE_MIGRATION.md)** - 数据库迁移说明
  - 迁移历史
  - 字段说明
  - 注意事项

## 开发相关

- **[package.json](package.json)** - 项目依赖和脚本
- **[tsconfig.json](tsconfig.json)** - TypeScript 配置
- **[vitest.config.ts](vitest.config.ts)** - 测试配置

## 目录结构

```
vego/
├── src/                    # 源代码
│   ├── ai/                 # AI 相关（GPT客户端、工作区加载器）
│   ├── bots/               # Bot 实现（Telegram、Discord、飞书）
│   ├── character/          # 角色管理
│   ├── config/             # 配置管理
│   ├── memory/             # 记忆系统（数据库、记忆管理器）
│   ├── router/             # 消息路由
│   ├── scheduler/          # 定时任务
│   ├── tools/              # 工具（聊天管理器）
│   ├── web/                # Web 管理界面
│   └── __tests__/          # 测试文件
├── backups/                # 备份和文档
│   ├── docs/               # 详细文档
│   └── temp/               # 临时文件
├── .vego/                  # 配置和工作区（用户数据）
│   ├── config.toml         # 主配置文件
│   └── workspace_*/        # 角色工作区
└── build/                  # 编译输出
```

## 快速链接

### 新手入门
1. 阅读 [README.md](README.md) 了解项目
2. 按照 [QUICKSTART.md](QUICKSTART.md) 快速开始
3. 查看 [config.example.toml](config.example.toml) 配置示例

### 群聊功能
1. 阅读 [GROUP_CHAT_FEATURES.md](backups/docs/GROUP_CHAT_FEATURES.md) 了解群聊功能
2. 查看 [MULTI_GROUP_EXPLANATION.md](backups/docs/MULTI_GROUP_EXPLANATION.md) 理解多群隔离

### Web管理
1. 阅读 [WEB_INTERFACE.md](backups/docs/WEB_INTERFACE.md) 了解Web界面
2. 访问 http://localhost:3000 使用管理界面

### 数据库
1. 查看 [DATABASE_MIGRATION.md](backups/docs/DATABASE_MIGRATION.md) 了解数据库结构
2. 数据库文件位置：`.vego/workspace_*/memory.db`

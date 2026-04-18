# 文档索引

## 主要文档

- **[README.md](README.md)** - 项目主文档，包含功能介绍、快速开始、配置说明
- **[QUICKSTART.md](QUICKSTART.md)** - 快速开始指南
- **[CHANGELOG.md](CHANGELOG.md)** - 完整的更新日志

## 配置文件

- **[config.example.toml](config.example.toml)** - 配置文件示例
- **[.env.example](.env.example)** - 环境变量示例

## 详细文档

所有详细文档都在 **[docs/](docs/)** 目录中：

### 功能文档
- **[docs/CREATE_CHARACTER.md](docs/CREATE_CHARACTER.md)** - 创建新角色指南
- **[docs/COPY_CHARACTER.md](docs/COPY_CHARACTER.md)** - 复制角色指南
- **[docs/DISPLAY_NAME.md](docs/DISPLAY_NAME.md)** - 角色显示名称功能
- **[docs/GROUP_CHAT_FEATURES.md](docs/GROUP_CHAT_FEATURES.md)** - 群聊功能详细说明
- **[docs/WEB_INTERFACE.md](docs/WEB_INTERFACE.md)** - Web 管理界面使用指南
- **[docs/VEGO_HOME.md](docs/VEGO_HOME.md)** - VEGO_HOME 目录说明

### 技术文档
- **[docs/MULTI_GROUP_EXPLANATION.md](docs/MULTI_GROUP_EXPLANATION.md)** - 多群隔离机制详解
- **[docs/配置文件结构优化.md](docs/配置文件结构优化.md)** - 配置文件结构说明
- **[docs/删除角色修复说明.md](docs/删除角色修复说明.md)** - 删除角色功能修复

### 完整文档列表
查看 **[docs/README.md](docs/README.md)** 获取所有文档的完整列表和分类。

## 开发相关

- **[package.json](package.json)** - 项目依赖和脚本
- **[tsconfig.json](tsconfig.json)** - TypeScript 配置
- **[vitest.config.ts](vitest.config.ts)** - 测试配置
- **[ecosystem.config.js](ecosystem.config.js)** - PM2 配置

## 目录结构

```
vego/
├── src/                    # 源代码
│   ├── ai/                 # AI 相关（GPT客户端、工作区加载器）
│   ├── bots/               # Bot 实现（Telegram、Discord、飞书）
│   ├── character/          # 角色管理
│   ├── config/             # 配置管理
│   ├── memory/             # 记忆系统（数据库、记忆管理器）
│   ├── scheduler/          # 定时任务
│   ├── tools/              # 工具（聊天管理器）
│   ├── web/                # Web 管理界面
│   └── __tests__/          # 测试文件
├── docs/                   # 详细文档
├── backups/                # 备份文件
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
4. 浏览 [docs/README.md](docs/README.md) 查看所有文档

### 角色管理
1. [创建新角色](docs/CREATE_CHARACTER.md)
2. [从现有角色复制](docs/COPY_CHARACTER.md)
3. [设置显示名称](docs/DISPLAY_NAME.md)

### 群聊功能
1. [群聊功能说明](docs/GROUP_CHAT_FEATURES.md)
2. [多群隔离机制](docs/MULTI_GROUP_EXPLANATION.md)

### Web 管理
1. [Web 界面使用指南](docs/WEB_INTERFACE.md)
2. 访问 http://localhost:3000 使用管理界面

### 问题修复
1. [快速修复指南](docs/快速修复指南.md)
2. [删除角色问题](docs/删除角色-快速修复.md)
3. [配置文件结构](docs/配置文件结构优化.md)

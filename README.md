# Vego - Node.js 多角色聊天机器人

基于 Node.js 和 TypeScript 的多角色聊天机器人，支持分层记忆系统和多平台接入。

## 特性

- 🤖 **多角色管理** - 支持多个独立的聊天机器人角色，每个角色有独立的人设和记忆
- 💬 **多平台支持** - Telegram、Discord、飞书三个平台
- 🧠 **分层记忆系统** - 包括身份认同、关系信息、长期记忆、关系图式、当前状态、情景记忆和对话历史
- 📁 **Workspace 文件系统** - 每个角色有独立的 workspace 目录，包含 persona/、relationship/、memory/ 等 Markdown 文件
- 🤖 **GPT API 集成** - 调用 OpenAI 兼容 API 生成回复
- ⏰ **定时任务系统** - 每日凌晨记忆整理和每周审视
- 💾 **对话压缩** - 当消息数达到阈值时自动压缩保留最近消息
- ⚙️ **配置管理** - 使用 TOML 配置文件管理 API、角色、记忆、调度器等配置

## 项目结构

```
src/
├── index.ts              # 主程序入口
├── app.ts                # 应用程序主类
├── config/
│   └── config.ts         # 配置解析
├── character/
│   └── character.ts      # Character 类，管理单个角色
├── ai/
│   ├── workspace-loader.ts  # workspace 文件加载
│   └── gpt-client.ts        # GPT 客户端
├── bots/
│   ├── telegram-bot.ts   # Telegram bot
│   ├── discord-bot.ts    # Discord bot
│   └── feishu-bot.ts     # 飞书 bot
├── memory/
│   ├── database.ts       # 数据库管理
│   └── memory-manager.ts # 记忆管理器
├── scheduler/
│   ├── scheduler.ts      # 定时任务调度器
│   └── tasks.ts          # 记忆整理任务
└── router/
    └── message.ts        # UnifiedMessage 消息结构
```

## Workspace 标准结构

每个角色的 workspace 目录结构如下：

```
workspace_{角色名}/
├── index.md              # 入口文件，引用所有模块
│
├── persona/              # 身份认同层（手动维护）
│   ├── basic.md          # 基本信息：名字、年龄、身份
│   ├── personality.md    # 性格特点、情绪节奏
│   ├── background.md     # 背景故事
│   ├── interests.md      # 兴趣爱好
│   ├── speaking.md       # 说话风格
│   └── rules.md          # 行为规则
│
├── relationship/         # 关系层（手动维护）
│   └── user.md           # 用户信息
│
└── memory/               # 记忆层（自动生成 + 配置）
    ├── dream_prompt.md   # 记忆整理提示词（可自定义）
    ├── recall.md         # 近期记忆（自动生成）
    ├── state.md          # 当前状态（自动生成）
    ├── relationship.md   # 关系图式（自动生成）
    └── weekly_review.md  # 周审视报告（自动生成）
```

## 安装

### 前置要求

- **Node.js 18-22** (推荐使用 v20 LTS 或 v22 LTS)
- npm 或 pnpm
- 一个 OpenAI 兼容的 API key

**重要**: 如果你使用 Node.js v24，可能会遇到编译错误。请参考 [INSTALL.md](INSTALL.md) 解决。

```bash
# 检查 Node.js 版本
node -v

# 如果是 v24，建议降级到 v20 或 v22
nvm install 20
nvm use 20

# 安装依赖
npm install
```

## 配置

配置文件位于 `~/.vego/config.toml`：

```toml
[api]
key = "your-api-key"
model = "Pro/moonshotai/Kimi-K2.5"
base = "https://api.siliconflow.cn/v1"

[character.yuyan]
path = "workspace_yuyan"
telegram_bot_token = "xxx"
discord_bot_token = "xxx"

[character.yunxiu]
path = "workspace_yunxiu"
telegram_bot_token = "xxx"

[memory]
max_history_messages = 100
max_recent_messages = 100
compress_threshold = 300

[scheduler]
enabled = true
schedule_time = "3:00"
min_conversations = 20

[weekly_review]
enabled = true
day_of_week = 0
schedule_time = "4:00"
```

## 运行

```bash
# 开发模式（带热重载）
npm run dev

# 构建
npm run build

# 生产模式
npm start
```

## 核心流程

### 消息处理流程

```
用户消息到达
    ↓
1. 存储用户消息到数据库
    ↓
2. 获取对话历史（最近100条）
    ↓
3. 构建系统提示词（只从Markdown文件加载）
    ↓
4. 调用 GPT API 生成回复
    ↓
5. 存储 AI 回复
    ↓
返回回复给用户
```

### 系统提示词构建

GPTClient 会自动构建系统提示词，**只从Markdown文件加载**：

```
{persona 内容 - 从 index.md 展开}
  ├─ persona/basic.md
  ├─ persona/personality.md
  ├─ persona/speaking.md
  ├─ persona/rules.md
  ├─ relationship/user.md
  └─ memory/
      ├─ memories.md      # 长期记忆
      ├─ recall.md        # 近期记忆
      ├─ state.md         # 当前状态
      └─ relationship.md  # 关系图式
```

### 每日记忆整理

**工作流程**：

```
凌晨3点触发
    ↓
从数据库读取昨天的对话
    ↓
AI 分析对话 → 识别信息属于哪一层
    ↓
├─ 日记 → memory/YYYY-MM-DD.md（备份）
├─ 一句话总结 → recall.md（最近5条）
├─ 重要事实 → memories.md（最近50条）
├─ 关系变化 → relationship.md（累积）
└─ 状态更新 → state.md（覆盖）
```

### 对话压缩

当对话消息数超过阈值时，系统会自动压缩：

**触发条件**：
- 消息数达到300条时触发压缩

**压缩行为**：
- 删除旧消息
- 保留最近100条消息（约50轮对话）

## 技术栈

- **Node.js** - 运行时环境
- **TypeScript** - 类型安全的 JavaScript
- **better-sqlite3** - SQLite 数据库
- **OpenAI SDK** - GPT API 客户端
- **Telegraf** - Telegram Bot 框架
- **Discord.js** - Discord Bot 框架
- **node-cron** - 定时任务调度
- **toml** - TOML 配置解析

## 从 Python 版本迁移

如果你有现有的 Python 版本 vego 项目：

1. 配置文件 `~/.vego/config.toml` 可以直接使用
2. Workspace 目录结构完全兼容
3. 数据库结构相同，可以直接使用现有的 `memory.db`

## 开发

```bash
# 运行测试
npm test

# 类型检查
npx tsc --noEmit

# 代码格式化
npx prettier --write src/
```

## License

MIT

## 更新日志

### 2026-04 (v1.0.0)

**初始版本**

- 从 Python 版本迁移到 Node.js/TypeScript
- 完整实现多角色管理和分层记忆系统
- 支持 Telegram、Discord、飞书三个平台
- 实现每日记忆整理和每周审视功能
- 使用 better-sqlite3 替代 SQLAlchemy
- 使用 node-cron 替代 Python 的 schedule

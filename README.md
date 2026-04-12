# Vego - Node.js 多角色聊天机器人

基于 Node.js 和 TypeScript 的多角色聊天机器人，支持分层记忆系统和多平台接入。

## ✨ 特性

- 🤖 **多角色管理** - 支持多个独立的聊天机器人角色，每个角色有独立的人设和记忆
- 💬 **多平台支持** - Telegram、Discord 双平台，支持私聊和群聊
- 👥 **智能群聊** - AI 判断是否参与对话，支持中文名字识别、@提及、回复检测
- 🧠 **分层记忆系统** - 包括身份认同、关系信息、长期记忆、关系图式、当前状态和对话历史
- � **自动日记** - 每天凌晨自动整理对话，生成日记和记忆
- �📁 **Workspace 文件系统** - 每个角色有独立的 workspace 目录，使用 Markdown 文件管理人设
- 🤖 **GPT API 集成** - 支持 OpenAI 兼容 API（硅基流动、Kimi 等）
- ⏰ **定时任务系统** - 每日记忆整理和每周回顾
- 💾 **对话压缩** - 自动压缩历史消息，节省 token
- ⚙️ **配置管理** - 使用 TOML 配置文件，简单易用

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone <your-repo-url>
cd vego

# 安装依赖
npm install

# 编译
npm run build
```

### 配置

创建配置文件 `~/.vego/config.toml`（Windows: `C:\Users\你的用户名\.vego\config.toml`）：

```toml
[api]
key = "your-api-key"
model = "deepseek-chat"  # 或其他模型
base = "https://api.deepseek.com/v1"

[character.qianqian]
path = "workspace_qianqian"
discord_bot_token = "your-discord-bot-token"

[memory]
max_history_messages = 20  # 减少 token 消耗
max_recent_messages = 100
compress_threshold = 300

[scheduler]
enabled = true
schedule_time = "3:00"
min_conversations = 20

[group_chat]
use_ai_judgment = false  # 使用规则判断，省 token
question_response_probability = 0.6
normal_response_probability = 0.2
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 📚 群聊功能

### Telegram 群聊设置

1. 将 bot 添加到群组
2. 找到 @BotFather，发送 `/mybots`
3. 选择你的 bot → `Bot Settings` → `Group Privacy` → `Turn off`
4. 现在 bot 可以看到群里的所有消息了

### 群聊响应规则

Bot 会在以下情况下回复：

✅ **必定回复**：
- 被 @提及（`@bot_username`）
- 消息中包含角色名字（如"芊芊"、"婉清"）
- 回复 bot 的消息

🎲 **可能回复**（根据配置概率）：
- 问题（包含问号）
- 以"你们"、"大家"开头的消息
- 包含"你们俩"、"你俩"等词

❌ **不会回复**：
- 刚说过话（避免刷屏）
- 消息太短（<3 字符）
- 只有 emoji

## 🗂️ Workspace 结构

```
.vego/
├── config.toml           # 配置文件
├── workspace_qianqian/   # 芊芊的 workspace
│   ├── index.md          # 入口文件
│   ├── persona/          # 人设文件
│   │   ├── basic.md      # 基本信息
│   │   ├── personality.md # 性格特点
│   │   ├── background.md  # 背景故事
│   │   ├── interests.md   # 兴趣爱好
│   │   ├── speaking.md    # 说话风格
│   │   └── rules.md       # 行为规则
│   ├── relationship/      # 关系信息
│   │   └── user.md        # 用户信息
│   ├── memory/            # 记忆文件（自动生成）
│   │   ├── diary.md       # 日记（每天追加）
│   │   ├── memories.md    # 长期记忆
│   │   ├── recall.md      # 近期记忆
│   │   ├── state.md       # 当前状态
│   │   └── relationship.md # 关系变化
│   └── memory.db          # 对话数据库
└── workspace_wanqing/     # 婉清的 workspace
    └── ...
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
- **Discord.js** - Discord Bot 框架
- **Telegraf** - Telegram Bot 框架
- **node-cron** - 定时任务调度
- **toml** - TOML 配置解析

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
- 支持 Discord、Telegram、飞书三个平台
- 实现每日记忆整理和每周审视功能
- 使用 better-sqlite3 替代 SQLAlchemy
- 使用 node-cron 替代 Python 的 schedule

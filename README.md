# Vego - Node.js 多角色聊天机器人

基于 Node.js 和 TypeScript 的多角色聊天机器人，支持分层记忆系统和多平台接入。

📖 **[快速开始](QUICKSTART.md)** | 📚 **[完整文档](docs/)** | 📝 **[更新日志](docs/CHANGELOG.md)**

## ✨ 特性

- 🤖 **多角色管理** - 支持多个独立的聊天机器人角色，每个角色有独立的人设和记忆
- 💬 **多平台支持** - Telegram、Discord、飞书多平台，支持私聊和群聊
- 👥 **智能群聊** - AI 判断是否参与对话，支持中文名字识别、@提及、回复检测
  - 🔒 **多群隔离** - 不同群聊完全独立，消息互不干扰
  - 🤝 **跨角色协作** - 同一群聊中的多个bot能看到彼此的对话
  - ⏰ **时间过滤** - 自动过滤过期消息（默认30分钟）
  - 📝 **上下文存储** - 群聊上下文完整保存到数据库
- 🧠 **分层记忆系统** - 包括身份认同、关系信息、长期记忆、关系图式、当前状态和对话历史
- 📝 **自动日记** - 每天凌晨自动整理对话，生成日记和记忆
- 💬 **主动聊天** - 定时主动发送消息，让角色更有生命力（支持 Telegram）
- 📁 **Workspace 文件系统** - 每个角色有独立的 workspace 目录，使用 Markdown 文件管理人设
- 💾 **SQLite 存储** - 高性能数据库存储，支持复杂查询和大数据量
- 🌐 **Web 管理界面** - 图形化管理角色、对话记录、人设配置、系统配置
- 🤖 **GPT API 集成** - 支持 OpenAI 兼容 API（硅基流动、Kimi、DeepSeek 等）
- ⏰ **定时任务系统** - 每日记忆整理和每周回顾
- 🗜️ **对话压缩** - 自动压缩历史消息，节省 token
- ⚙️ **配置管理** - 使用 TOML 配置文件，支持 Web 在线编辑

## 🌐 Web 管理界面

访问 `http://localhost:3000` 可以使用图形化界面管理：

### 功能列表

1. **👥 角色管理**
   - 查看所有角色
   - 新增角色（自动创建默认人设）
   - 删除角色
   - 编辑角色人设（Markdown 文件）

2. **💬 对话管理**
   - 查看聊天记录（气泡界面）
   - 群聊消息显示发言人名字
   - 群聊上下文完整展示
   - 编辑单条消息（无弹窗提示）
   - 多选删除消息
   - 删除所有消息
   - 直接与 AI 对话

3. **⚙️ 配置管理**
   - 在线编辑 config.toml
   - 修改 API 密钥、模型、网址
   - 调整角色配置（Bot Token）
   - 配置定时任务、主动聊天、群聊参数
   - 自动备份旧配置
   - TOML 格式验证

4. **📊 系统状态**
   - 实时查看系统运行状态
   - 运行时间、内存使用、CPU 核心数
   - 角色状态（Telegram/Discord 配置）
   - 功能开关状态（定时任务、主动聊天、AI 群聊判断）
   - 运行日志查看（支持按级别过滤）
   - 自动刷新（每 5 秒）

### 配置管理说明

配置管理界面支持在线编辑所有配置项：

- **API 配置**：密钥、模型名称、API 地址
- **角色配置**：工作区路径、各平台 Bot Token
- **记忆配置**：历史消息数、压缩阈值
- **定时任务**：每日整理、每周回顾
- **主动聊天**：活跃时段、发送概率
- **群聊配置**：AI 判断、回复概率

⚠️ **注意**：修改配置后需要重启应用才能生效。保存时会自动备份当前配置到 `config.toml.backup.时间戳`。

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/larbmm/vego
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

[proactive_chat]
enabled = true                  # 启用主动聊天
active_hours_start = 6.5        # 活跃时段开始（6:30）
active_hours_end = 22.5         # 活跃时段结束（22:30）
min_interval_hours = 2          # 最小间隔（小时）
random_probability = 0.3        # 触发概率（30%）

[group_chat]
use_ai_judgment = false  # 使用规则判断，省 token
question_response_probability = 0.6
normal_response_probability = 0.2
message_expiry_minutes = 30  # 群聊消息过期时间（分钟）
```

### 主动聊天说明

主动聊天功能让角色可以定时主动发送消息：

- **工作原理**：每小时检查一次，根据配置的概率决定是否发送
- **时间控制**：只在活跃时段内发送（如 6:30-22:30）
- **间隔控制**：两次主动消息之间至少间隔指定小时数
- **概率控制**：每次检查时按概率决定是否发送（如 30%）
- **内容生成**：AI 根据角色人设自动生成自然的问候或分享
- **仅私聊**：只向私聊用户发送，不会在群聊中主动发言

⚠️ **注意**：
- 需要配置角色的 Telegram Bot Token
- 用户需要先发送一条消息，系统才能获取用户 ID
- 建议设置合理的概率和间隔，避免打扰用户

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 📚 群聊功能

### 群聊响应规则

Bot 会在以下情况下回复：

✅ **必定回复**：
- 被 @提及（`@bot_username`）
- 消息中包含角色名字（如"芊芊"）
- 回复 bot 的消息

🎲 **可能回复**（根据配置概率）：
- 问题（包含问号）
- 以"你们"、"大家"开头的消息
- 包含"你们俩"、"你俩"等词

❌ **不会回复**：
- 刚说过话（避免刷屏）
- 消息太短（<3 字符）
- 只有 emoji

### 群聊场景区分

系统会自动识别私聊和群聊场景，给AI不同的行为指导：

**私聊场景**：
- AI 可以更加亲密和放松
- 可以说一些私密的话
- 可以表达更多的情感

**群聊场景**：
- 保持得体和礼貌
- 避免过于私密或不适合公开的内容
- 注意其他成员也能看到回复

### 多群隔离机制

- 每个群聊有独立的消息缓存（按 chatId 区分）
- 不同群聊的消息完全隔离，互不干扰
- 示例：
  - 古代群（芊芊、婉清）：chatId = `-1001234567890`
  - 现代群（曦月）：chatId = `-1009876543210`
  - 曦月在现代群中，完全看不到古代群的对话

### 跨角色协作

- 同一群聊中的多个bot共享消息缓存
- 芊芊能看到婉清说了什么，婉清也能看到芊芊说了什么
- 主人的消息和所有bot的回复都会被记录
- 最多保留10条消息或30分钟内的消息

### 群聊上下文存储

触发回复时，会将完整的群聊上下文存入数据库：

```
[群聊上下文]
群成员：张三、李四、王五
最近的聊天记录：
张三: 今天天气真好
李四: 是啊，要不要出去玩
王五: @bot 你觉得呢？
[/群聊上下文]

@bot 你觉得呢？
```

这样在web界面可以看到完整的对话场景。

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

### 2026-04-23 (v0.9.0)

**记忆系统优化**

- ✅ **日记生成质量提升**
  - 将 `max_tokens` 从 800 提升到 4000
  - 字数要求改为动态调整（300-2500字，根据内容复杂度）
  - 优化 `dream_prompt.md`，要求详细展开重要事件（争吵、和解、亲密时刻等）
  - 平淡日常 300-500字，重要事件 1200-2000字，重大转折 2000-2500字

- ✅ **记忆系统简化**
  - 只保留 `diary.md`（详细日记）和 `memories.md`（长期事实）
  - 删除 `recall.md`、`state.md`、`relationship.md` 的引用
  - 减少 token 消耗和维护成本，信息不丢失
  - 更新所有角色的 `index.md` 和 `dream_prompt.md`

- ✅ **Web 界面优化**
  - 对话管理界面更紧凑，节省移动端屏幕空间
  - 合并顶部栏，将角色信息和操作按钮放在同一行
  - 减少不必要的间距和装饰元素

**新增工具**

- 添加 `regenerate_diary.py` 脚本，支持手动重新生成指定日期的日记
- 用法：`python regenerate_diary.py <角色名> <日期>`

**设计决策**

- 基本人设保持相对稳定，日记记录动态变化
- 暂不实现人设自动演化功能
- 当前"基本人设 + 日记"的方式足够应付半年使用

### 2026-04-17 (v0.8.0)

**群聊功能重大更新**

- ✅ **场景区分**
  - 自动识别私聊和群聊场景
  - 私聊：AI 更亲密、可以说私密话
  - 群聊：AI 保持得体、避免过于私密的内容

- ✅ **多群隔离机制**
  - 每个群聊有独立的消息缓存（按 chatId 区分）
  - 不同群聊的消息完全隔离，互不干扰
  - 支持角色在不同群聊中扮演不同身份

- ✅ **跨角色协作**
  - 同一群聊中的多个bot共享消息缓存
  - 所有bot能看到彼此的对话
  - 主人和bot的消息都会被记录

- ✅ **群聊上下文管理**
  - 持续收集群聊消息（最多10条）
  - 时间过滤机制（默认30分钟，可配置）
  - 完整上下文存入数据库

- ✅ **Web界面优化**
  - 群聊消息显示发言人名字（蓝色标签）
  - 显示完整的群聊上下文
  - 编辑消息后不再弹窗提示

- ✅ **AI回复优化**
  - 修复AI回复包含时间戳的问题
  - 只给用户消息添加时间戳，不给AI历史回复添加
  - 加强系统提示，明确告知AI不要使用时间戳格式

**数据库更新**

- 添加 `sender_name` 字段（存储群聊发言人名字）
- 自动迁移，无需手动操作

**配置新增**

- `group_chat.message_expiry_minutes` - 群聊消息过期时间（分钟）

### 2026-04 (v0.7.0)

**新增功能**

- ✅ Web 配置管理界面
  - 在线编辑 config.toml 配置文件
  - 支持修改 API 密钥、模型、网址
  - 支持修改角色配置（Bot Token）
  - 支持调整定时任务、主动聊天、群聊参数
  - 自动备份旧配置（保存到 config.toml.backup.时间戳）
  - TOML 格式实时验证
  - 配置说明文档内置

- ✅ 主动聊天功能完善
  - 修复数据库结构，添加平台用户 ID 字段
  - 自动保存用户的 Telegram/Discord/飞书 ID
  - 每小时检查一次，根据概率和时间段决定是否发送
  - AI 自动生成自然的问候或分享内容
  - 支持配置活跃时段、最小间隔、触发概率
  - 只向私聊用户发送，不会在群聊中主动发言

**改进**

- 完善 Web 管理界面功能
- 优化配置文件读写逻辑
- 改进数据库结构以支持主动聊天

**数据库迁移**

- 添加 `telegram_user_id`、`discord_user_id`、`feishu_user_id` 字段
- 自动迁移，无需手动操作

### 2026-04 (v0.6.0)

**初始版本**

- 从 Python 版本迁移到 Node.js/TypeScript
- 完整实现多角色管理和分层记忆系统
- 支持 Discord、Telegram、飞书三个平台
- 实现每日记忆整理和每周审视功能
- 使用 better-sqlite3 替代 SQLAlchemy
- 使用 node-cron 替代 Python 的 schedule

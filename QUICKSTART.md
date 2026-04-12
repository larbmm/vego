# 快速开始指南

## 5 分钟快速部署

### 1. 安装依赖

```bash
npm install
npm run build
```

### 2. 创建配置文件

创建 `~/.vego/config.toml`（Windows: `C:\Users\你的用户名\.vego\config.toml`）：

```toml
[api]
key = "your-api-key"
model = "deepseek-chat"
base = "https://api.deepseek.com/v1"

[character.mybot]
path = "workspace_mybot"
discord_bot_token = "your-discord-bot-token"

[memory]
max_history_messages = 20
max_recent_messages = 100
compress_threshold = 300

[scheduler]
enabled = true
schedule_time = "3:00"
min_conversations = 20

[group_chat]
use_ai_judgment = false
question_response_probability = 0.6
normal_response_probability = 0.2
```

### 3. 创建角色 Workspace

复制示例 workspace：

```bash
# Linux/Mac
cp -r .vego/workspace_qianqian ~/.vego/workspace_mybot

# Windows
xcopy .vego\workspace_qianqian %USERPROFILE%\.vego\workspace_mybot /E /I
```

### 4. 修改人设

编辑 `~/.vego/workspace_mybot/persona/basic.md`：

```markdown
# 基本信息

- 名字：你的角色名
- 年龄：18岁
- 身份：你的角色身份
- 性格：你的角色性格
```

### 5. 启动

```bash
npm run dev
```

## 获取 Telegram Bot Token

1. 在 Telegram 中找到 @BotFather
2. 发送 `/newbot`
3. 按提示设置 bot 名字和 username
4. 复制获得的 token

## 获取 API Key

### 硅基流动（推荐）

1. 访问 https://siliconflow.cn
2. 注册账号
3. 充值（新用户有免费额度）
4. 在"API 密钥"页面创建密钥

### 推荐模型

- **DeepSeek-V3.2** - 性价比最高，角色扮演强
- **Qwen3-235B** - 中文理解优秀
- **GLM-4.6** - 智谱模型，性价比高

## 群聊设置

### 关闭 Privacy Mode

1. 找到 @BotFather
2. 发送 `/mybots`
3. 选择你的 bot
4. `Bot Settings` → `Group Privacy` → `Turn off`

### 添加到群组

1. 将 bot 添加到群组
2. 在群里发送消息测试
3. @bot 或提到角色名字，bot 会回复

## 常见问题

### Q: 403 错误？
A: 检查 API key 是否正确，余额是否充足，模型是否可用

### Q: Bot 不回复群消息？
A: 确保关闭了 Privacy Mode

### Q: 回复太慢？
A: 减少 `max_history_messages`，或换更快的模型

### Q: Token 消耗太快？
A: 
- 设置 `max_history_messages = 20`
- 设置 `use_ai_judgment = false`
- 使用便宜的模型（如 GLM-4.5-Air）

### Q: 如何添加多个角色？
A: 在 config.toml 中添加多个 `[character.xxx]` 段

## 下一步

- 阅读 [README.md](README.md) 了解完整功能
- 查看 [CHANGELOG.md](CHANGELOG.md) 了解更新内容
- 自定义角色人设文件
- 调整群聊响应规则

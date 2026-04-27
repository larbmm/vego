# 配置热加载 - 快速开始

## 什么是热加载？

热加载允许你在不重启应用的情况下修改配置文件，修改会立即生效。这意味着你可以：

- 切换 API 模型而不中断服务
- 调整内存配置立即生效
- 添加新角色无需重启
- 修改调度器时间实时更新

## 快速体验

### 1. 启动应用

```bash
npm start
```

你会看到类似的日志：
```
[Config] Using .vego directory: /path/to/.vego
[Config] Watching config file for changes: /path/to/.vego/config.toml
[App] Initializing PersonaBotApp...
```

### 2. 修改配置

打开 `.vego/config.toml` 文件，修改任意配置项，例如：

```toml
[api]
model = "gpt-4"  # 从 gpt-3.5-turbo 改为 gpt-4
```

### 3. 保存文件

保存后，你会立即在控制台看到：

```
[Config] Config file changed, reloading...
[Config] Config reloaded successfully
[App] Config changed, applying updates...
[App] API config changed, updating all bots...
[GPTClient] API config updated: base=https://api.openai.com/v1, model=gpt-4
[App] ✓ Config updates applied successfully
```

### 4. 验证生效

发送一条消息给你的 bot，它会使用新的模型回复。

## 常见使用场景

### 场景 1: 切换 API 提供商

```toml
# 从 OpenAI 切换到 DeepSeek
[api]
base = "https://api.deepseek.com"
model = "deepseek-chat"
```

保存后立即生效，下一条消息就会使用 DeepSeek API。

### 场景 2: 调整内存大小

```toml
[memory]
max_history_messages = 200  # 从 100 增加到 200
```

保存后，所有角色的内存配置立即更新。

### 场景 3: 添加新角色

```toml
[character.alice]
name = "alice"
path = "workspace_alice"
telegram_bot_token = "your_new_token"
```

保存后，新角色会自动初始化并开始工作，无需重启。

### 场景 4: 修改调度时间

```toml
[scheduler]
schedule_time = "4:00"  # 从 3:00 改为 4:00
```

保存后，调度器会自动重启并使用新时间。

### 场景 5: 调整群聊响应概率

```toml
[group_chat]
normal_response_probability = 0.3  # 从 0.2 提高到 0.3
```

保存后立即生效，bot 会更积极地参与群聊。

## 注意事项

### ✅ 支持热加载的配置

- API 配置（key, base, model）
- 内存配置（max_history_messages, max_recent_messages, compress_threshold）
- 调度器配置（enabled, schedule_time, min_conversations）
- 周报配置（enabled, day_of_week, schedule_time）
- 主动聊天配置（enabled, active_hours_start, active_hours_end, etc.）
- 群聊配置（use_ai_judgment, question_response_probability, etc.）
- 角色配置（添加、删除、修改角色）

### ❌ 不支持热加载的配置

- `timezone` - 时区配置（需要重启）
- 数据库路径相关配置（需要重启）

### ⚠️ 配置错误处理

如果配置文件有语法错误，热加载会失败：

```
[Config] Config file changed, reloading...
[Config] Failed to reload config: Error: Invalid TOML syntax
```

此时应用会继续使用旧配置运行，修复配置文件后会自动重试。

## 测试脚本

项目包含一个测试脚本 `test-hot-reload.js`，可以自动测试热加载功能：

```bash
# 终端 1: 启动应用
npm start

# 终端 2: 运行测试脚本
node test-hot-reload.js
```

测试脚本会：
1. 备份当前配置
2. 修改 API 模型配置
3. 等待 3 秒
4. 修改内存配置
5. 等待 3 秒
6. 恢复原始配置

观察终端 1 的输出，你会看到配置变化的日志。

## Web 界面配合使用

Web 配置管理界面（`http://localhost:3000`）也支持热加载：

1. 在 Web 界面修改配置
2. 点击"保存配置"
3. 配置会自动重新加载
4. 无需手动重启应用

## 故障排除

### 问题：配置修改后没有生效

**解决方案**：
1. 检查控制台是否有错误日志
2. 确认配置文件路径正确（`.vego/config.toml`）
3. 确认文件已保存（某些编辑器有延迟保存）
4. 检查配置文件语法是否正确

### 问题：应用崩溃

**解决方案**：
1. 检查配置文件是否有语法错误
2. 恢复备份配置（`config.toml.backup.*`）
3. 重启应用
4. 提交 issue 报告问题

### 问题：某些配置没有热加载

**解决方案**：
查看 [完整文档](HOT_RELOAD.md) 确认该配置是否支持热加载。不支持的配置需要重启应用。

## 更多信息

- [完整热加载文档](HOT_RELOAD.md)
- [配置文件说明](../config.example.toml)
- [更新日志](CHANGELOG.md)

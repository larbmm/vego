# 配置热加载功能

## 概述

Vego 现在支持配置文件热加载功能。当你修改 `.vego/config.toml` 文件并保存后，系统会自动检测变化并重新加载配置，无需手动重启应用。

## 支持的配置热加载

### 1. API 配置
- `api.key` - API 密钥
- `api.base` - API 基础 URL
- `api.model` - 使用的模型

**效果**: 所有 bot 和 character 会立即使用新的 API 配置。

### 2. 内存配置
- `memory.max_history_messages` - 最大历史消息数
- `memory.max_recent_messages` - 最大最近消息数
- `memory.compress_threshold` - 压缩阈值

**效果**: 所有 character 的内存管理器会立即使用新的配置。

### 3. 调度器配置
- `scheduler.enabled` - 是否启用调度器
- `scheduler.schedule_time` - 调度时间
- `scheduler.min_conversations` - 最小对话数
- `weekly_review.*` - 周报配置
- `proactive_chat.*` - 主动聊天配置

**效果**: 调度器会停止并使用新配置重新启动。

### 4. 角色配置
- 添加新角色
- 删除现有角色
- 修改角色的 bot token 或其他配置

**效果**: 
- 新角色会被初始化并启动
- 删除的角色会被清理并停止
- 修改的角色会被重新初始化

### 5. 群聊配置
- `group_chat.use_ai_judgment` - 是否使用 AI 判断
- `group_chat.question_response_probability` - 问题响应概率
- `group_chat.normal_response_probability` - 普通响应概率
- `group_chat.message_expiry_minutes` - 消息过期时间

**效果**: 配置会立即生效，影响后续的群聊消息处理。

## 使用方法

1. 启动应用：
```bash
npm start
```

2. 修改配置文件 `.vego/config.toml`

3. 保存文件

4. 观察控制台输出，你会看到类似以下的日志：
```
[Config] Config file changed, reloading...
[Config] Config reloaded successfully
[App] Config changed, applying updates...
[App] API config changed, updating all bots...
[App] ✓ Config updates applied successfully
```

## 注意事项

### 防抖机制
配置文件监听使用了 500ms 的防抖机制，避免在快速连续保存时触发多次重载。

### 错误处理
如果配置文件格式错误或包含无效值，热加载会失败并在控制台显示错误信息，但应用会继续使用旧配置运行。

### 不支持热加载的配置
- `timezone` - 时区配置（需要重启）
- 数据库路径相关配置（需要重启）

### 角色变更的影响
- **删除角色**: 相关的 bot 会立即停止，数据库连接会被关闭
- **添加角色**: 新角色会被初始化，如果应用正在运行，bot 会立即启动
- **修改角色**: 旧的实例会被清理，新的实例会被创建

## 实现细节

### 文件监听
使用 Node.js 的 `fs.watch` API 监听配置文件变化。

### 回调机制
通过 `onConfigChange` 注册回调函数，在配置变化时执行相应的更新逻辑。

### 配置比较
通过 JSON 序列化比较新旧配置，只更新发生变化的部分。

## 示例场景

### 场景 1: 切换 API 模型
```toml
# 修改前
[api]
model = "gpt-3.5-turbo"

# 修改后
[api]
model = "gpt-4"
```
保存后，所有后续的对话都会使用 GPT-4 模型。

### 场景 2: 添加新角色
```toml
# 在 config.toml 中添加
[character.new_character]
name = "new_character"
path = "workspace_new"
telegram_bot_token = "your_token_here"
```
保存后，新角色会被初始化并开始工作。

### 场景 3: 调整调度器时间
```toml
# 修改前
[scheduler]
schedule_time = "3:00"

# 修改后
[scheduler]
schedule_time = "4:00"
```
保存后，调度器会使用新的时间重新启动。

## 故障排除

### 配置没有生效
1. 检查控制台是否有错误信息
2. 确认配置文件格式正确（TOML 语法）
3. 确认文件已保存
4. 检查文件权限

### 应用崩溃
如果热加载导致应用崩溃，请：
1. 检查配置文件是否有语法错误
2. 恢复到之前的配置
3. 重启应用
4. 提交 issue 报告问题

## 开发者信息

### 相关文件
- `src/config/config.ts` - 配置加载和监听
- `src/app.ts` - 配置变化处理
- `src/character/character.ts` - 角色配置更新
- `src/ai/gpt-client.ts` - API 配置更新
- `src/memory/memory-manager.ts` - 内存配置更新

### 扩展热加载
如果需要为新的配置项添加热加载支持：

1. 在 `src/app.ts` 的 `setupConfigWatcher` 方法中添加检测逻辑
2. 实现相应的更新方法
3. 在 `onConfigChange` 回调中调用更新方法

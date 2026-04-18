# 角色显示名称说明

## 概述

从本版本开始，角色支持**英文ID**和**中文显示名称**分离：

- **英文ID**（如 `qianqian`）：用于系统内部标识、文件夹名称
- **中文显示名称**（如 `芊芊`）：用于界面显示，让用户更容易识别

## 为什么需要分离？

### 问题场景

在配置文件中：
```toml
[character.qianqian]  # 这是英文ID
path = "workspace_qianqian"
```

但用户看到的应该是"芊芊"而不是"qianqian"。

### 解决方案

添加 `display_name` 字段：
```toml
[character.qianqian]
display_name = "芊芊"  # 界面显示这个名字
path = "workspace_qianqian"
telegram_bot_token = "..."
```

## 使用方法

### 创建新角色时

在Web界面创建角色时，会提示输入两个字段：

1. **英文ID**（必填）
   - 只能使用小写字母和下划线
   - 例如：`alice`、`xiao_ming`
   - 用于系统内部

2. **中文名称**（可选）
   - 可以使用任何字符
   - 例如：`爱丽丝`、`小明`
   - 用于界面显示

### 为现有角色添加显示名称

编辑 `config.toml`，在角色配置中添加 `display_name` 字段：

```toml
# 修改前
[character.xiyue]
path = "workspace_xiyue"
telegram_bot_token = "..."

# 修改后
[character.xiyue]
display_name = "曦月"  # 添加这一行
path = "workspace_xiyue"
telegram_bot_token = "..."
```

保存后重启应用，界面上就会显示"曦月"而不是"xiyue"。

## 配置示例

### 示例1：中文名称

```toml
[character.qianqian]
display_name = "芊芊"
path = "workspace_qianqian"
telegram_bot_token = "..."

[character.wanqing]
display_name = "婉清"
path = "workspace_wanqing"
telegram_bot_token = "..."

[character.xiyue]
display_name = "曦月"
path = "workspace_xiyue"
telegram_bot_token = "..."
```

### 示例2：英文名称

```toml
[character.alice]
display_name = "Alice"  # 也可以用英文
path = "workspace_alice"
telegram_bot_token = "..."

[character.bob]
display_name = "Bob"
path = "workspace_bob"
telegram_bot_token = "..."
```

### 示例3：混合使用

```toml
[character.xiao_ming]
display_name = "小明 (Xiao Ming)"  # 中英文混合
path = "workspace_xiao_ming"
telegram_bot_token = "..."

[character.my_assistant]
display_name = "我的助手 🤖"  # 可以包含emoji
path = "workspace_my_assistant"
telegram_bot_token = "..."
```

### 示例4：不使用显示名称

```toml
[character.alice]
# 不设置 display_name，界面会显示 "alice"
path = "workspace_alice"
telegram_bot_token = "..."
```

## 界面显示效果

### 角色管理页面

- **列表显示**：显示中文名称（如"芊芊"）
- **编辑按钮**：点击后显示"编辑角色：芊芊"
- **删除确认**：提示"确定删除角色 芊芊 吗？"

### 对话管理页面

- **角色选择下拉框**：显示中文名称
- **页面标题**：显示"对话管理 - 芊芊"

### 配置管理页面

- **配置文件内容**：仍然显示英文ID（`[character.qianqian]`）
- 这是正常的，因为配置文件本身使用英文ID

### 系统状态页面

- **角色状态卡片**：显示中文名称

## 技术细节

### 数据流

1. **配置文件**：存储 `display_name` 字段
2. **后端API**：读取配置，返回 `{ name: "qianqian", display_name: "芊芊" }`
3. **前端显示**：优先使用 `display_name`，不存在则使用 `name`

### 兼容性

- **向后兼容**：不设置 `display_name` 的角色仍然正常工作
- **自动降级**：如果 `display_name` 为空，自动使用英文ID
- **无需迁移**：现有角色不需要修改配置文件

### 代码实现

```typescript
// 配置接口
export interface CharacterConfig {
  name: string;
  display_name?: string;  // 可选字段
  path: string;
  // ...
}

// 前端显示
getCharacterDisplayName(name) {
  const char = this.characters.find(c => c.name === name);
  return char?.display_name || name;  // 降级到name
}
```

## 常见问题

### Q: 必须设置 display_name 吗？
A: 不必须。这是一个可选字段，不设置的话界面会显示英文ID。

### Q: 可以修改现有角色的 display_name 吗？
A: 可以！直接编辑配置文件，添加或修改 `display_name` 字段，然后重启应用。

### Q: display_name 可以和其他角色重复吗？
A: 可以，但不推荐。display_name 只用于显示，不影响系统功能，但重复的名字会让用户混淆。

### Q: 可以在 display_name 中使用特殊字符吗？
A: 可以！display_name 没有格式限制，可以使用中文、英文、数字、符号、emoji等任何字符。

### Q: 修改 display_name 需要重启应用吗？
A: 是的。配置文件的修改需要重启应用才能生效。

### Q: 可以通过Web界面修改 display_name 吗？
A: 目前只能在创建角色时设置，修改需要编辑配置文件。未来版本可能会添加Web界面编辑功能。

## 迁移指南

### 为现有角色添加中文名称

1. 停止应用
2. 编辑 `~/.vego/config.toml` 或项目目录下的 `.vego/config.toml`
3. 在每个角色配置中添加 `display_name` 字段：

```toml
[character.qianqian]
display_name = "芊芊"  # 添加这一行
path = "workspace_qianqian"
# ... 其他配置保持不变
```

4. 保存文件
5. 重启应用
6. 打开Web界面，验证显示名称是否正确

### 批量添加示例

```toml
[character.qianqian]
display_name = "芊芊"
path = "workspace_qianqian"
telegram_bot_token = "..."

[character.wanqing]
display_name = "婉清"
path = "workspace_wanqing"
telegram_bot_token = "..."

[character.xiyue]
display_name = "曦月"
path = "workspace_xiyue"
telegram_bot_token = "..."
```

## 最佳实践

1. **使用有意义的英文ID**
   - 好：`xiao_ming`、`alice`、`assistant`
   - 差：`char1`、`bot_001`、`test`

2. **display_name 简洁明了**
   - 好：`小明`、`爱丽丝`、`助手`
   - 差：`我的第一个聊天机器人角色小明`

3. **保持一致性**
   - 如果使用中文名称，所有角色都用中文
   - 如果使用英文名称，所有角色都用英文

4. **避免混淆**
   - 不要让 display_name 和其他角色的 name 或 display_name 重复
   - 例如：不要有 `[character.alice]` 和 `[character.bob] display_name = "alice"`

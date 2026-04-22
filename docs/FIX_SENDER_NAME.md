# 修复 sender_name 字段问题

## 问题描述

在数据库中发现私聊消息也有 `sender_name` 字段的值，这导致 Web 界面错误地将私聊消息显示为群聊消息。

### 问题表现
- 在 Web 对话管理界面，私聊消息旁边显示了发言人名字（如 `[莫非]`）
- 这个标记本应只在群聊消息中出现

### 根本原因
历史代码可能存在 bug，导致私聊消息也设置了 `sender_name` 字段。

当前代码逻辑是正确的：
```typescript
// src/bots/telegram-bot.ts
const message: UnifiedMessage = {
  platform: 'telegram',
  user_id: isGroup ? `${userId}@${chatId}` : userId,
  senderName: isGroup ? senderName : undefined,  // 只在群聊时设置
  // ...
};
```

## 判断标准

系统通过以下方式区分群聊和私聊：

1. **user_id 格式**：
   - 私聊：`userId`（纯数字或字符串）
   - 群聊：`userId@chatId`（包含 @ 符号）

2. **sender_name 字段**：
   - 私聊：应该为 `NULL`
   - 群聊：存储发言人的名字

## 修复方案

### 自动修复脚本

创建了 `scripts/fix-sender-name.js` 脚本来自动修复所有工作区的数据：

```bash
node scripts/fix-sender-name.js
```

### 脚本功能

1. 扫描 `.vego` 目录下的所有工作区
2. 对每个工作区的数据库：
   - 查找 `user_id` 不包含 `@` 但 `sender_name` 不为空的记录
   - 将这些记录的 `sender_name` 设置为 `NULL`
   - 保持群聊消息的 `sender_name` 不变
3. 显示修复统计信息

### 修复结果

运行脚本后的结果：

```
📂 处理角色: qianqian
   ✅ 已修复 7 条记录

📂 处理角色: wanqing
   ✅ 已修复 6 条记录

📂 处理角色: xiyue
   ✅ 已修复 50 条记录
```

## 验证修复

### SQL 查询验证

```sql
-- 查看最近的消息，确认 sender_name 已清除
SELECT id, user_id, role, sender_name, platform, 
       substr(content, 1, 30) as content_preview 
FROM messages 
ORDER BY id DESC 
LIMIT 10;
```

### 预期结果
- 私聊消息（`user_id` 不包含 `@`）的 `sender_name` 应该为 `NULL`
- 群聊消息（`user_id` 包含 `@`）的 `sender_name` 可以有值

## Web 界面效果

修复后，Web 对话管理界面：
- ✅ 私聊消息不再显示 `[发言人名字]` 标记
- ✅ 只有群聊消息才显示发言人名字
- ✅ 正确区分私聊和群聊对话

## 预防措施

当前代码已经修复了这个问题：

1. **Telegram Bot**：只在 `isGroup` 为 true 时设置 `senderName`
2. **Discord Bot**：只在 `isGuild` 为 true 时设置 `senderName`
3. **Web Chat**：不设置 `senderName`（因为是私聊）

未来的消息不会再出现这个问题。

## 相关文件

- `scripts/fix-sender-name.js` - 修复脚本
- `src/bots/telegram-bot.ts` - Telegram bot 实现
- `src/bots/discord-bot.ts` - Discord bot 实现
- `src/character/character.ts` - 消息处理逻辑
- `src/memory/database.ts` - 数据库操作

## 技术细节

### 数据库结构

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  platform TEXT NOT NULL,
  message_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sender_name TEXT,  -- 群聊发言人名字，私聊时应为 NULL
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 修复 SQL

```sql
-- 清除私聊消息的 sender_name
UPDATE messages
SET sender_name = NULL
WHERE sender_name IS NOT NULL
  AND user_id NOT LIKE '%@%';
```

## 总结

- ✅ 问题已修复：所有私聊消息的 `sender_name` 已清除
- ✅ 代码已优化：未来不会再出现此问题
- ✅ 数据已验证：Web 界面显示正常
- ✅ 脚本可复用：如果需要可以再次运行

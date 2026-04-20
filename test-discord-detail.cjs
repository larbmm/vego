const Database = require('better-sqlite3');

console.log('=== Discord 消息详细信息 ===\n');

const db = new Database('.vego/workspace_qianqian/memory.db');

// 查看所有 Discord 消息的 user_id
const allDiscord = db.prepare(
  "SELECT id, role, user_id, sender_name, substr(content, 1, 80) as preview FROM messages WHERE platform = 'discord' ORDER BY id"
).all();

console.log('所有 Discord 消息:\n');
allDiscord.forEach(msg => {
  const userId = String(msg.user_id);
  const isGroup = userId.includes('@');
  const type = isGroup ? '群聊' : '私聊';
  const sender = msg.sender_name || '(无)';
  console.log(`[${msg.id}] ${msg.role} | ${type} | user_id: ${userId}`);
  console.log(`    sender_name: ${sender}`);
  console.log(`    content: ${msg.preview}...\n`);
});

db.close();

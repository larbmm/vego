const Database = require('better-sqlite3');

console.log('=== Discord 消息统计 ===\n');

const characters = ['qianqian', 'wanqing'];

for (const char of characters) {
  console.log(`\n--- ${char} ---`);
  
  const db = new Database(`.vego/workspace_${char}/memory.db`);
  
  // Discord 私聊消息（没有 sender_name）
  const privateDiscord = db.prepare(
    "SELECT COUNT(*) as count FROM messages WHERE platform = 'discord' AND sender_name IS NULL"
  ).get();
  
  // Discord 群聊消息（有 sender_name）
  const groupDiscord = db.prepare(
    "SELECT COUNT(*) as count FROM messages WHERE platform = 'discord' AND sender_name IS NOT NULL"
  ).get();
  
  console.log('Discord 私聊消息:', privateDiscord.count);
  console.log('Discord 群聊消息:', groupDiscord.count);
  
  // 查看最近的 Discord 消息
  const recentDiscord = db.prepare(
    "SELECT id, role, sender_name, substr(content, 1, 60) as preview FROM messages WHERE platform = 'discord' ORDER BY id DESC LIMIT 5"
  ).all();
  
  console.log('\n最近的 Discord 消息:');
  recentDiscord.forEach(msg => {
    const type = msg.sender_name ? `群聊(${msg.sender_name})` : '私聊';
    console.log(`  [${msg.id}] ${msg.role} ${type}: ${msg.preview}...`);
  });
  
  db.close();
}

const Database = require('better-sqlite3');

console.log('=== 检查曦月数据库 ===\n');

const db = new Database('.vego/workspace_xiyue/memory.db');

// 检查表结构
console.log('1. messages 表结构:');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
console.log(schema.sql);
console.log();

// 检查最近的消息
console.log('2. 最近5条消息:');
const messages = db.prepare('SELECT id, role, substr(content, 1, 50) as content_preview, created_at FROM messages ORDER BY id DESC LIMIT 5').all();
console.log(JSON.stringify(messages, null, 2));
console.log();

// 检查消息总数
const count = db.prepare('SELECT COUNT(*) as count FROM messages').get();
console.log(`3. 消息总数: ${count.count}`);
console.log();

// 检查 users 表
console.log('4. users 表:');
const users = db.prepare('SELECT * FROM users').all();
console.log(JSON.stringify(users, null, 2));

db.close();

console.log('\n=== 检查芊芊数据库（对比）===\n');

const db2 = new Database('.vego/workspace_qianqian/memory.db');

console.log('1. messages 表结构:');
const schema2 = db2.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
console.log(schema2.sql);
console.log();

console.log('2. 最近5条消息:');
const messages2 = db2.prepare('SELECT id, role, substr(content, 1, 50) as content_preview, created_at FROM messages ORDER BY id DESC LIMIT 5').all();
console.log(JSON.stringify(messages2, null, 2));

db2.close();

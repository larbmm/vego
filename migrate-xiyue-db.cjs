/**
 * 曦月数据库迁移脚本
 * 
 * 问题：曦月的数据库是旧格式，表结构与其他角色不同
 * 解决：重建 messages 表为新格式
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = '.vego/workspace_xiyue/memory.db';
const backupPath = '.vego/workspace_xiyue/memory.db.backup';

console.log('=== 曦月数据库迁移 ===\n');

// 1. 备份数据库
console.log('1. 备份数据库...');
fs.copyFileSync(dbPath, backupPath);
console.log(`   ✓ 备份已保存到: ${backupPath}\n`);

// 2. 打开数据库
const db = new Database(dbPath);

// 3. 检查当前表结构
console.log('2. 当前表结构:');
const oldSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
console.log(oldSchema.sql);
console.log();

// 4. 导出现有数据
console.log('3. 导出现有数据...');
const messages = db.prepare('SELECT * FROM messages ORDER BY id').all();
console.log(`   ✓ 导出了 ${messages.length} 条消息\n`);

// 5. 删除旧表
console.log('4. 删除旧表...');
db.exec('DROP TABLE messages');
console.log('   ✓ 旧表已删除\n');

// 6. 创建新表（与芊芊、婉清一致）
console.log('5. 创建新表...');
db.exec(`
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    platform TEXT NOT NULL,
    message_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sender_name TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX idx_messages_user_id ON messages(user_id);
  CREATE INDEX idx_messages_created_at ON messages(created_at);
`);
console.log('   ✓ 新表已创建\n');

// 7. 导入数据
console.log('6. 导入数据...');
const insert = db.prepare(`
  INSERT INTO messages (id, user_id, role, content, platform, message_id, created_at, sender_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((messages) => {
  for (const msg of messages) {
    insert.run(
      msg.id,
      msg.user_id,
      msg.role,
      msg.content,
      msg.platform,
      msg.message_id,
      msg.created_at,
      msg.sender_name || null
    );
  }
});

insertMany(messages);
console.log(`   ✓ 导入了 ${messages.length} 条消息\n`);

// 8. 验证
console.log('7. 验证迁移结果:');
const newSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
console.log(newSchema.sql);
console.log();

const count = db.prepare('SELECT COUNT(*) as count FROM messages').get();
console.log(`   ✓ 消息总数: ${count.count}`);

const recent = db.prepare('SELECT id, role, substr(content, 1, 30) as preview, created_at FROM messages ORDER BY id DESC LIMIT 3').all();
console.log('\n   最近3条消息:');
recent.forEach(msg => {
  console.log(`   - [${msg.id}] ${msg.role}: ${msg.preview}... (${msg.created_at})`);
});

db.close();

console.log('\n=== 迁移完成 ===');
console.log(`✓ 数据库已更新为新格式`);
console.log(`✓ 备份文件: ${backupPath}`);
console.log(`✓ 如果出现问题，可以恢复备份：`);
console.log(`  cp ${backupPath} ${dbPath}`);

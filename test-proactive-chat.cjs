// 测试主动聊天功能
const Database = require('better-sqlite3');

console.log('=== 测试主动聊天功能 ===\n');

// 检查三个角色的数据库
const characters = ['xiyue', 'qianqian', 'wanqing'];

for (const char of characters) {
  console.log(`\n--- ${char} ---`);
  
  try {
    const db = new Database(`.vego/workspace_${char}/memory.db`);
    
    // 检查用户
    const user = db.prepare('SELECT id, telegram_user_id FROM users WHERE id = 1').get();
    console.log('User:', user);
    
    if (!user) {
      console.log('❌ 没有用户记录');
    } else if (!user.telegram_user_id) {
      console.log('❌ 没有 telegram_user_id');
    } else {
      console.log('✅ 用户数据正常');
    }
    
    // 检查消息数量
    const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    console.log('消息数量:', msgCount.count);
    
    db.close();
  } catch (error) {
    console.log('❌ 错误:', error.message);
  }
}

console.log('\n=== 检查调度器状态 ===\n');

// 检查调度器状态
const fs = require('fs');
const stateFiles = [
  '.vego/workspace_xiyue/scheduler_state.json',
  '.vego/scheduler_state.json'
];

for (const file of stateFiles) {
  if (fs.existsSync(file)) {
    console.log(`\n找到状态文件: ${file}`);
    const state = JSON.parse(fs.readFileSync(file, 'utf-8'));
    
    // 检查主动聊天状态
    for (const char of characters) {
      const key = `proactive_chat_${char}`;
      if (state[key]) {
        console.log(`\n${char} 主动聊天状态:`);
        console.log('  上次发送:', state[key].last_message_time);
        console.log('  消息内容:', state[key].last_message);
      } else {
        console.log(`\n${char}: ❌ 没有主动聊天记录`);
      }
    }
  }
}

console.log('\n=== 检查配置 ===\n');

// 检查配置
const toml = require('toml');
const configContent = fs.readFileSync('.vego/config.toml', 'utf-8');
const config = toml.parse(configContent);

console.log('主动聊天配置:');
console.log('  enabled:', config.proactive_chat.enabled);
console.log('  active_hours:', config.proactive_chat.active_hours_start, '-', config.proactive_chat.active_hours_end);
console.log('  min_interval_hours:', config.proactive_chat.min_interval_hours);
console.log('  random_probability:', config.proactive_chat.random_probability);

console.log('\n角色配置:');
for (const char of characters) {
  const charConfig = config.character[char];
  if (charConfig) {
    console.log(`\n${char}:`);
    console.log('  display_name:', charConfig.display_name);
    console.log('  telegram_bot_token:', charConfig.telegram_bot_token ? '✅ 已配置' : '❌ 未配置');
  }
}

console.log('\n=== 测试完成 ===');

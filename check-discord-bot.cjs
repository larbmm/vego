// 检查 Discord Bot 配置
const fs = require('fs');
const toml = require('toml');

console.log('=== Discord Bot 配置检查 ===\n');

// 读取配置
const configContent = fs.readFileSync('.vego/config.toml', 'utf-8');
const config = toml.parse(configContent);

console.log('角色配置:');
for (const [name, char] of Object.entries(config.character)) {
  console.log(`\n${name} (${char.display_name}):`);
  console.log('  Discord Bot Token:', char.discord_bot_token ? '✅ 已配置' : '❌ 未配置');
  console.log('  Telegram Bot Token:', char.telegram_bot_token ? '✅ 已配置' : '❌ 未配置');
  
  if (char.discord_bot_token) {
    // 检查 token 格式
    const tokenParts = char.discord_bot_token.split('.');
    if (tokenParts.length === 3) {
      console.log('  Token 格式: ✅ 正确 (3 部分)');
    } else {
      console.log('  Token 格式: ❌ 错误 (应该有 3 部分，用 . 分隔)');
    }
  }
}

console.log('\n=== Discord Bot 权限检查清单 ===\n');
console.log('请在 Discord Developer Portal 检查以下设置：');
console.log('https://discord.com/developers/applications\n');

console.log('1. Bot 权限 (Bot Permissions):');
console.log('   ✓ Send Messages');
console.log('   ✓ Read Messages/View Channels');
console.log('   ✓ Read Message History\n');

console.log('2. Privileged Gateway Intents (必须启用！):');
console.log('   ✓ MESSAGE CONTENT INTENT ← 非常重要！\n');

console.log('3. OAuth2 URL Generator:');
console.log('   Scopes: bot');
console.log('   Bot Permissions: Send Messages, Read Messages, Read Message History\n');

console.log('4. 检查 Bot 是否在线:');
console.log('   - 在 Discord 中查看 bot 的状态');
console.log('   - 应该显示为"在线"（绿色圆点）\n');

console.log('=== 常见问题 ===\n');
console.log('Q: Bot 在服务器中可以回复，但私聊不行？');
console.log('A: 检查是否启用了 MESSAGE CONTENT INTENT\n');

console.log('Q: Bot 显示离线？');
console.log('A: 检查应用是否正在运行，token 是否正确\n');

console.log('Q: 如何测试 Bot 是否在线？');
console.log('A: 在服务器中 @bot，如果能回复说明 bot 在线\n');

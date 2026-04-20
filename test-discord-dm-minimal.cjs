/**
 * 最小化 Discord DM 测试脚本
 * 
 * 用途：测试 Discord Bot 是否能接收私聊消息
 * 
 * 使用方法：
 * 1. 将下面的 YOUR_BOT_TOKEN 替换为实际的 bot token
 * 2. 运行：node test-discord-dm-minimal.cjs
 * 3. 在 Discord 中向 bot 发送私聊消息
 * 4. 观察终端输出
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');

// 替换为你的 bot token（从 .vego/config.toml 中复制）
const BOT_TOKEN = 'YOUR_BOT_TOKEN';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
  ],
});

client.on('ready', () => {
  console.log('='.repeat(60));
  console.log(`✅ Bot 已登录: ${client.user.tag}`);
  console.log(`📝 Bot ID: ${client.user.id}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('现在可以在 Discord 中向 bot 发送私聊消息了！');
  console.log('等待消息...');
  console.log('');
});

client.on('messageCreate', (msg) => {
  console.log('='.repeat(60));
  console.log('📨 收到消息！');
  console.log('='.repeat(60));
  console.log(`发送者: ${msg.author.username} (${msg.author.id})`);
  console.log(`是否为 Bot: ${msg.author.bot}`);
  console.log(`频道类型: ${msg.channel.type} (1=私聊, 0=群聊)`);
  console.log(`服务器: ${msg.guild ? msg.guild.name : 'DM（私聊）'}`);
  console.log(`消息内容: ${msg.content}`);
  console.log('='.repeat(60));
  console.log('');
  
  if (!msg.author.bot) {
    msg.reply('✅ 收到！这是一条测试回复。')
      .then(() => console.log('✅ 已发送回复'))
      .catch(err => console.error('❌ 发送回复失败:', err));
  }
});

client.on('error', (error) => {
  console.error('❌ Discord 客户端错误:', error);
});

console.log('正在启动 Discord Bot...');
console.log('');

client.login(BOT_TOKEN).catch(err => {
  console.error('❌ 登录失败:', err);
  console.error('');
  console.error('请检查：');
  console.error('1. Bot Token 是否正确');
  console.error('2. 是否已将 YOUR_BOT_TOKEN 替换为实际的 token');
  process.exit(1);
});

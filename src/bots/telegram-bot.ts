import { Telegraf, Context } from 'telegraf';
import { UnifiedMessage, MessageHandler } from '../router/message.js';

export class TelegramBot {
  private bot: Telegraf;
  private handler: MessageHandler;
  private characterName: string;

  constructor(handler: MessageHandler, characterName: string) {
    this.handler = handler;
    this.characterName = characterName;
    this.bot = new Telegraf('');
  }

  async setup(token: string): Promise<void> {
    this.bot = new Telegraf(token);

    this.bot.on('text', async (ctx: Context) => {
      try {
        if (!ctx.message || !('text' in ctx.message)) {
          return;
        }

        const message: UnifiedMessage = {
          platform: 'telegram',
          user_id: String(ctx.from?.id || ''),
          platform_message_id: String(ctx.message.message_id || ''),
          content: ctx.message.text || '',
          timestamp: new Date(),
        };

        const response = await this.handler(message);
        await ctx.reply(response);
      } catch (error) {
        console.error(`[TelegramBot:${this.characterName}] Error:`, error);
        await ctx.reply('Sorry, an error occurred.');
      }
    });
  }

  async run(): Promise<void> {
    console.log(`[TelegramBot:${this.characterName}] Starting...`);
    await this.bot.launch();

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  stop(): void {
    this.bot.stop();
  }
}

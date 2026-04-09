import { Client, GatewayIntentBits, Message as DiscordMessage } from 'discord.js';
import { UnifiedMessage, MessageHandler } from '../router/message.js';

export class DiscordBot {
  private client: Client;
  private handler: MessageHandler;
  private characterName: string;

  constructor(handler: MessageHandler, characterName: string) {
    this.handler = handler;
    this.characterName = characterName;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    });
  }

  async setup(token: string): Promise<void> {
    this.client.on('messageCreate', async (msg: DiscordMessage) => {
      if (msg.author.bot) return;

      try {
        const message: UnifiedMessage = {
          platform: 'discord',
          user_id: msg.author.id,
          platform_message_id: msg.id,
          content: msg.content,
          timestamp: new Date(),
        };

        const response = await this.handler(message);
        await msg.reply(response);
      } catch (error) {
        console.error(`[DiscordBot:${this.characterName}] Error:`, error);
        await msg.reply('Sorry, an error occurred.');
      }
    });

    await this.client.login(token);
  }

  async run(): Promise<void> {
    console.log(`[DiscordBot:${this.characterName}] Running...`);
    // Client is already running after login
  }

  stop(): void {
    this.client.destroy();
  }
}

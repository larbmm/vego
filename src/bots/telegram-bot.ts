import { Telegraf, Context } from 'telegraf';
import { UnifiedMessage, MessageHandler } from '../router/message.js';
import { GroupParticipation, GroupMessage } from './group-participation.js';

export class TelegramBot {
  private bot: Telegraf;
  private handler: MessageHandler;
  private characterName: string;
  private groupParticipation?: GroupParticipation;
  private recentGroupMessages: Map<string, GroupMessage[]> = new Map();

  constructor(handler: MessageHandler, characterName: string) {
    this.handler = handler;
    this.characterName = characterName;
    this.bot = new Telegraf('');
  }

  async setup(token: string, apiKey?: string, apiBase?: string, model?: string): Promise<void> {
    this.bot = new Telegraf(token);

    // Get bot info to know the actual username
    const botInfo = await this.bot.telegram.getMe();
    const botUsername = botInfo.username;
    console.log(`[TelegramBot:${this.characterName}] Bot username: @${botUsername}`);

    // Initialize group participation if API credentials provided
    if (apiKey && apiBase && model) {
      // Import config to check if AI judgment is enabled
      const { config } = await import('../config/config.js');
      this.groupParticipation = new GroupParticipation(
        apiKey, 
        apiBase, 
        model, 
        this.characterName,
        config.group_chat.use_ai_judgment
      );
    }

    // Add global error handler to suppress detailed error logs
    this.bot.catch((err: unknown, ctx: Context) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[TelegramBot:${this.characterName}] Error processing update:`, errorMsg);
    });

    this.bot.on('text', async (ctx: Context) => {
      try {
        if (!ctx.message || !('text' in ctx.message)) {
          return;
        }

        const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
        const userId = String(ctx.from?.id || '');
        const chatId = String(ctx.chat?.id || '');
        const senderName = ctx.from?.first_name || ctx.from?.username || 'Unknown';

        console.log(`[TelegramBot:${this.characterName}] Received message from ${senderName} in ${isGroup ? 'group' : 'private'}: ${ctx.message.text.substring(0, 50)}`);

        // Check if message mentions this bot (using actual bot username or character name)
        // Also check for Chinese character names in the message
        const characterNameVariations = [
          botUsername,
          this.characterName,
          this.characterName.toLowerCase(),
        ];
        
        // Add Chinese name mapping
        const chineseNameMap: Record<string, string> = {
          'qianqian': '芊芊',
          'wanqing': '婉清',
          'xiyue': '曦月',
        };
        
        if (chineseNameMap[this.characterName.toLowerCase()]) {
          characterNameVariations.push(chineseNameMap[this.characterName.toLowerCase()]);
        }
        
        const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
        const mentionsMe = characterNameVariations.some(name => 
          messageText.includes(`@${name}`) || messageText.includes(name)
        );

        // Check if it's a reply to this bot's message
        const isReplyToMe = ctx.message?.reply_to_message?.from?.id === botInfo.id;

        console.log(`[TelegramBot:${this.characterName}] mentionsMe: ${mentionsMe}, isReplyToMe: ${isReplyToMe}`);

        // For group chats, check if should respond
        if (isGroup && this.groupParticipation) {
          // Store recent messages
          if (!this.recentGroupMessages.has(chatId)) {
            this.recentGroupMessages.set(chatId, []);
          }
          const recentMessages = this.recentGroupMessages.get(chatId)!;
          
          const groupMessage: GroupMessage = {
            sender: senderName,
            content: ctx.message.text,
            timestamp: new Date(),
            mentionsMe,
            isReplyToMe,
          };

          recentMessages.push(groupMessage);
          if (recentMessages.length > 10) {
            recentMessages.shift(); // Keep only last 10 messages
          }

          // Decide if should respond
          const { config } = await import('../config/config.js');
          
          // Load character persona for AI judgment
          let characterPersona = '';
          if (config.group_chat.use_ai_judgment) {
            try {
              const { WorkspaceLoader } = await import('../ai/workspace-loader.js');
              const workspacePath = (this.handler as any).character?.workspacePath;
              if (workspacePath) {
                const loader = new WorkspaceLoader(workspacePath);
                characterPersona = loader.loadPersona();
              }
            } catch (error) {
              console.warn('[TelegramBot] Failed to load persona for AI judgment');
            }
          }

          const decision = await this.groupParticipation.shouldRespond(
            groupMessage,
            recentMessages.slice(0, -1),
            {
              questionProbability: config.group_chat.question_response_probability,
              normalProbability: config.group_chat.normal_response_probability,
              characterPersona,
            }
          );

          if (!decision.shouldRespond) {
            console.info(`[TelegramBot:${this.characterName}] Skipping: ${decision.reason}`);
            return;
          }

          console.info(`[TelegramBot:${this.characterName}] Responding: ${decision.reason}`);
        } else if (isGroup) {
          // No group participation logic, skip group messages unless mentioned/replied
          if (!mentionsMe && !isReplyToMe) {
            console.info(`[TelegramBot:${this.characterName}] Skipping: Not mentioned in group`);
            return;
          }
          console.info(`[TelegramBot:${this.characterName}] Responding: Mentioned or replied to`);
        }

        const message: UnifiedMessage = {
          platform: 'telegram',
          user_id: isGroup ? `${userId}@${chatId}` : userId,
          platform_message_id: String(ctx.message.message_id || ''),
          content: ctx.message.text || '',
          timestamp: new Date(),
        };

        console.log(`[TelegramBot:${this.characterName}] Calling handler...`);
        const response = await this.handler(message);
        console.log(`[TelegramBot:${this.characterName}] Got response: ${response.substring(0, 50)}...`);
        
        await ctx.reply(response);
        console.log(`[TelegramBot:${this.characterName}] Reply sent successfully`);

        // Store bot's response in recent messages
        if (isGroup && this.recentGroupMessages.has(chatId)) {
          this.recentGroupMessages.get(chatId)!.push({
            sender: this.characterName,
            content: response,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error(`[TelegramBot:${this.characterName}] Error:`, error);
        try {
          await ctx.reply('抱歉，出现了一些问题...');
        } catch (replyError) {
          console.error(`[TelegramBot:${this.characterName}] Failed to send error reply:`, replyError);
        }
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

  getBot(): Telegraf {
    return this.bot;
  }
}

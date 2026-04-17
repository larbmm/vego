import { Telegraf, Context } from 'telegraf';
import { UnifiedMessage, MessageHandler } from '../router/message.js';
import { GroupParticipation, GroupMessage } from './group-participation.js';

export class TelegramBot {
  private bot: Telegraf;
  private handler: MessageHandler;
  private characterName: string;
  private groupParticipation?: GroupParticipation;
  private recentGroupMessages: Map<string, GroupMessage[]> = new Map();
  private lastBotResponseTime: Map<string, Date> = new Map(); // 记录每个群最后一次回复的时间

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

        // For group chats, check if should respond
        if (isGroup && this.groupParticipation) {
          // Store recent messages (since last bot response)
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
          
          // 限制最多10条（从上次 bot 回复后开始计数）
          if (recentMessages.length > 10) {
            recentMessages.shift();
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
            return;
          }
        } else if (isGroup) {
          // No group participation logic, skip group messages unless mentioned/replied
          if (!mentionsMe && !isReplyToMe) {
            return;
          }
          
          // Store messages for context (even without AI judgment)
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
            recentMessages.shift();
          }
        }

        const message: UnifiedMessage = {
          platform: 'telegram',
          user_id: isGroup ? `${userId}@${chatId}` : userId,
          platform_message_id: String(ctx.message.message_id || ''),
          content: ctx.message.text || '',
          timestamp: new Date(),
          groupContext: isGroup ? {
            recentMessages: this.recentGroupMessages.get(chatId) || [],
            members: this.getGroupMemberNames(chatId),
          } : undefined,
        };

        const response = await this.handler(message);
        await ctx.reply(response);

        // Store bot's response in recent messages and clear the buffer
        if (isGroup) {
          // 清空群聊消息缓存（因为 bot 已经回复了，重新开始计数）
          this.recentGroupMessages.set(chatId, []);
          this.lastBotResponseTime.set(chatId, new Date());
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

  private getGroupMemberNames(chatId: string): string[] {
    const messages = this.recentGroupMessages.get(chatId) || [];
    const uniqueMembers = new Set<string>();
    
    messages.forEach(msg => {
      if (msg.sender && msg.sender !== this.characterName) {
        uniqueMembers.add(msg.sender);
      }
    });
    
    return Array.from(uniqueMembers);
  }
}

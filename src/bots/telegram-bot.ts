import { Telegraf, Context } from 'telegraf';
import { UnifiedMessage, MessageHandler } from '../router/message.js';
import { GroupParticipation, GroupMessage } from './group-participation.js';
import { sharedGroupCache } from './shared-group-cache.js';

export class TelegramBot {
  private bot: Telegraf;
  private handler: MessageHandler;
  private characterName: string;
  private groupParticipation?: GroupParticipation;

  constructor(handler: MessageHandler, characterName: string) {
    this.handler = handler;
    this.characterName = characterName;
    this.bot = new Telegraf('');
  }

  // 过滤掉过期的消息
  private async filterExpiredMessages(messages: GroupMessage[]): Promise<GroupMessage[]> {
    const { config } = await import('../config/config.js');
    const expiryMinutes = config.group_chat.message_expiry_minutes || 30;
    const now = new Date();
    const expiryMs = expiryMinutes * 60 * 1000;
    
    return messages.filter(msg => {
      const messageAge = now.getTime() - msg.timestamp.getTime();
      return messageAge < expiryMs;
    });
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
          let recentMessages = sharedGroupCache.getMessages(chatId);
          
          // 先过滤掉过期的消息
          recentMessages = await this.filterExpiredMessages(recentMessages);
          sharedGroupCache.setMessages(chatId, recentMessages);
          
          const groupMessage: GroupMessage = {
            sender: senderName,
            content: ctx.message.text,
            timestamp: new Date(),
            mentionsMe,
            isReplyToMe,
          };

          sharedGroupCache.addMessage(chatId, groupMessage);
          recentMessages = sharedGroupCache.getMessages(chatId);

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

          // 如果消息没有提到自己，不要回复（即使AI判断说要回复）
          if (!mentionsMe && !isReplyToMe && !decision.shouldRespond) {
            return;
          }
          
          // 如果消息没有明确提到自己，但AI判断说要回复，也不回复
          // 只有在被明确提及或回复时才回复
          if (!mentionsMe && !isReplyToMe) {
            return;
          }
        } else if (isGroup) {
          // No group participation logic, skip group messages unless mentioned/replied
          if (!mentionsMe && !isReplyToMe) {
            return;
          }
          
          // Store messages for context (even without AI judgment)
          let recentMessages = sharedGroupCache.getMessages(chatId);
          
          // 先过滤掉过期的消息
          recentMessages = await this.filterExpiredMessages(recentMessages);
          sharedGroupCache.setMessages(chatId, recentMessages);
          
          const groupMessage: GroupMessage = {
            sender: senderName,
            content: ctx.message.text,
            timestamp: new Date(),
            mentionsMe,
            isReplyToMe,
          };

          sharedGroupCache.addMessage(chatId, groupMessage);
        }

        const message: UnifiedMessage = {
          platform: 'telegram',
          user_id: isGroup ? `${userId}@${chatId}` : userId,
          platform_message_id: String(ctx.message.message_id || ''),
          content: ctx.message.text || '',
          timestamp: new Date(),
          senderName: isGroup ? senderName : undefined,
          groupContext: isGroup ? {
            recentMessages: await this.filterExpiredMessages(
              sharedGroupCache.getMessagesSinceLastResponse(chatId, this.characterName)
            ),
            members: this.getGroupMemberNames(chatId),
          } : undefined,
        };

        const response = await this.handler(message);
        await ctx.reply(response);

        // Store bot's response in recent messages
        if (isGroup) {
          // 将bot的回复加入共享缓存
          sharedGroupCache.addMessage(chatId, {
            sender: this.characterName,
            content: response,
            timestamp: new Date(),
            mentionsMe: false,
            isReplyToMe: false,
          });
          
          // 记录bot回复的位置
          sharedGroupCache.recordBotResponse(chatId, this.characterName);
          sharedGroupCache.setLastResponseTime(chatId, new Date());
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
    const messages = sharedGroupCache.getMessages(chatId);
    const uniqueMembers = new Set<string>();
    
    messages.forEach(msg => {
      if (msg.sender && msg.sender !== this.characterName) {
        uniqueMembers.add(msg.sender);
      }
    });
    
    return Array.from(uniqueMembers);
  }
}

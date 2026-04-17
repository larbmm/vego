import { Client, GatewayIntentBits, Message as DiscordMessage } from 'discord.js';
import { UnifiedMessage, MessageHandler } from '../router/message.js';
import { GroupParticipation, GroupMessage } from './group-participation.js';
import { sharedGroupCache } from './shared-group-cache.js';

export class DiscordBot {
  private client: Client;
  private handler: MessageHandler;
  private characterName: string;
  private groupParticipation?: GroupParticipation;
  private botId: string = '';

  constructor(handler: MessageHandler, characterName: string) {
    this.handler = handler;
    this.characterName = characterName;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
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
    // Initialize group participation if API credentials provided
    if (apiKey && apiBase && model) {
      const { config } = await import('../config/config.js');
      this.groupParticipation = new GroupParticipation(
        apiKey,
        apiBase,
        model,
        this.characterName,
        config.group_chat.use_ai_judgment
      );
    }

    this.client.on('ready', () => {
      this.botId = this.client.user?.id || '';
      console.log(`[DiscordBot:${this.characterName}] Logged in as ${this.client.user?.tag}`);
    });

    // Also listen to clientReady for future compatibility
    if ('clientReady' in this.client) {
      (this.client as any).on('clientReady', () => {
        this.botId = this.client.user?.id || '';
      });
    }

    this.client.on('messageCreate', async (msg: DiscordMessage) => {
      if (msg.author.bot) return;

      try {
        const isGuild = msg.guild !== null;
        const userId = msg.author.id;
        const channelId = msg.channel.id;
        const senderName = msg.author.username;

        // Check if message mentions this bot
        const chineseNameMap: Record<string, string> = {
          'qianqian': '芊芊',
          'wanqing': '婉清',
          'xiyue': '曦月',
        };

        const characterNameVariations = [
          this.characterName,
          this.characterName.toLowerCase(),
        ];

        if (chineseNameMap[this.characterName.toLowerCase()]) {
          characterNameVariations.push(chineseNameMap[this.characterName.toLowerCase()]);
        }

        const mentionsMe = msg.mentions.users.has(this.botId) ||
          characterNameVariations.some(name => msg.content.includes(name));

        const isReplyToMe = msg.reference?.messageId
          ? (await msg.channel.messages.fetch(msg.reference.messageId)).author.id === this.botId
          : false;

        // For guild (server) messages, check if should respond
        if (isGuild && this.groupParticipation) {
          let recentMessages = sharedGroupCache.getMessages(channelId);

          // 先过滤掉过期的消息
          recentMessages = await this.filterExpiredMessages(recentMessages);
          sharedGroupCache.setMessages(channelId, recentMessages);

          const groupMessage: GroupMessage = {
            sender: senderName,
            content: msg.content,
            timestamp: new Date(),
            mentionsMe,
            isReplyToMe,
          };

          sharedGroupCache.addMessage(channelId, groupMessage);
          recentMessages = sharedGroupCache.getMessages(channelId);

          const { config } = await import('../config/config.js');

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
              console.warn('[DiscordBot] Failed to load persona for AI judgment');
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
        } else if (isGuild) {
          // No group participation logic, skip guild messages unless mentioned/replied
          if (!mentionsMe && !isReplyToMe) {
            return;
          }
        }

        const message: UnifiedMessage = {
          platform: 'discord',
          user_id: isGuild ? `${userId}@${channelId}` : userId,
          platform_message_id: msg.id,
          content: msg.content,
          timestamp: new Date(),
          senderName: isGuild ? senderName : undefined,
        };

        const response = await this.handler(message);
        await msg.reply(response);

        // Store bot's response in shared cache
        if (isGuild) {
          sharedGroupCache.addMessage(channelId, {
            sender: this.characterName,
            content: response,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error(`[DiscordBot:${this.characterName}] Error:`, error);
        try {
          await msg.reply('抱歉，出现了一些问题...');
        } catch (replyError) {
          console.error(`[DiscordBot:${this.characterName}] Failed to send error reply:`, replyError);
        }
      }
    });

    await this.client.login(token);
  }

  async run(): Promise<void> {
    console.log(`[DiscordBot:${this.characterName}] Starting...`);
    // Client is already running after login
  }

  stop(): void {
    this.client.destroy();
  }
}

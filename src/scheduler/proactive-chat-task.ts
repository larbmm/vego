import { Character } from '../character/character.js';
import { Telegraf } from 'telegraf';
import { ProactiveChatConfig } from '../config/config.js';

export class ProactiveChatTask {
  private character: Character;
  private bot: Telegraf;
  private config: ProactiveChatConfig;

  constructor(
    character: Character,
    telegramBot: Telegraf,
    config: ProactiveChatConfig
  ) {
    this.character = character;
    this.bot = telegramBot;
    this.config = config;
  }

  /**
   * Check if current time is within active hours
   */
  private isActiveTime(): boolean {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    return hours >= this.config.active_hours_start && hours <= this.config.active_hours_end;
  }

  /**
   * Get primary user ID from database
   */
  private getPrimaryUserId(): number | null {
    if (!this.character.memoryManager) {
      return null;
    }
    
    // Get the first user (usually the main user)
    const user = this.character.memoryManager.getOrCreateUser('telegram');
    return user ? user.id : null;
  }

  /**
   * Get user's Telegram ID from database
   */
  private getUserTelegramId(userId: number): string | null {
    if (!this.character.memoryManager) {
      return null;
    }

    try {
      // Access the database through memory manager
      const db = (this.character.memoryManager as any).db;
      const result = db.db
        .prepare('SELECT telegram_user_id FROM users WHERE id = ?')
        .get(userId) as { telegram_user_id: string | null } | undefined;
      
      return result?.telegram_user_id || null;
    } catch (error) {
      console.error('[ProactiveChatTask] Error getting telegram ID:', error);
      return null;
    }
  }

  /**
   * Generate a proactive message using Character's GPTClient
   * This ensures the message uses the same persona and context as normal conversations
   */
  private async generateProactiveMessage(userId: number): Promise<string> {
    if (!this.character.gptClient) {
      throw new Error('GPTClient not initialized');
    }

    // Use a simple prompt that triggers the character to initiate conversation
    // The GPTClient will automatically load the persona and apply it
    const prompt = `现在想主动跟对方打个招呼或分享一下生活。请发送一条简短自然的消息（1-2句话），可以是问候、分享、想念等。直接输出消息内容，不要有其他说明。`;

    try {
      // Use the character's GPTClient which already has persona loaded
      const response = await this.character.gptClient.chat(
        userId,
        prompt,
        [], // No conversation history for proactive messages
        false // Not a group chat
      );

      return response || '在吗？';
    } catch (error) {
      console.error('[ProactiveChatTask] Error generating message:', error);
      return '在吗？';
    }
  }

  /**
   * Send proactive message to user
   */
  async call(state: Record<string, any>): Promise<Record<string, any>> {
    const charName = this.character.name;
    const stateKey = `proactive_chat_${charName}`;
    const taskState = state[stateKey] || {};

    // Check if within active hours
    if (!this.isActiveTime()) {
      return {};
    }

    // Random probability check
    if (Math.random() > this.config.random_probability) {
      return {};
    }

    // Get user ID
    const userId = this.getPrimaryUserId();
    if (!userId) {
      console.info(`[ProactiveChatTask:${charName}] No user found, skipping`);
      return {};
    }

    const telegramId = this.getUserTelegramId(userId);
    if (!telegramId) {
      console.info(`[ProactiveChatTask:${charName}] No telegram ID found, skipping`);
      return {};
    }

    // Check last message time to avoid being too frequent
    const lastMessageTime = taskState.last_message_time
      ? new Date(taskState.last_message_time)
      : null;

    if (lastMessageTime) {
      const hoursSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastMessage < this.config.min_interval_hours) {
        return {};
      }
    }

    try {
      const message = await this.generateProactiveMessage(userId);
      
      await this.bot.telegram.sendMessage(telegramId, message);
      console.info(`[ProactiveChatTask:${charName}] Sent proactive message: ${message}`);

      // Save the proactive message to database
      if (this.character.memoryManager) {
        this.character.memoryManager.storeMessage(
          userId,
          'assistant',
          message,
          'telegram',
          ''
        );
        console.info(`[ProactiveChatTask:${charName}] Saved proactive message to database`);
      }

      return {
        [stateKey]: {
          last_message_time: new Date().toISOString(),
          last_message: message,
        },
      };
    } catch (error) {
      console.error(`[ProactiveChatTask:${charName}] Error sending message:`, error);
      return {};
    }
  }
}

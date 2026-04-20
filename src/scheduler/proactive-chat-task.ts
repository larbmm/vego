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
   * Get recent conversation history for context
   */
  private getRecentHistory(userId: number, limit: number = 10): Array<{ role: string; content: string }> {
    if (!this.character.memoryManager) {
      return [];
    }

    try {
      const db = (this.character.memoryManager as any).db;
      const messages = db.db
        .prepare(`
          SELECT role, content 
          FROM messages 
          WHERE user_id = ? 
          ORDER BY timestamp DESC 
          LIMIT ?
        `)
        .all(userId, limit) as Array<{ role: string; content: string }>;
      
      // Reverse to get chronological order
      return messages.reverse();
    } catch (error) {
      console.error('[ProactiveChatTask] Error getting history:', error);
      return [];
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

    // Get current time information
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dayOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
    
    // Determine time period
    let timePeriod = '';
    if (hours >= 6 && hours < 12) {
      timePeriod = '早上';
    } else if (hours >= 12 && hours < 14) {
      timePeriod = '中午';
    } else if (hours >= 14 && hours < 18) {
      timePeriod = '下午';
    } else if (hours >= 18 && hours < 22) {
      timePeriod = '晚上';
    } else {
      timePeriod = '深夜';
    }

    // Get recent conversation history for context
    const recentHistory = this.getRecentHistory(userId, 10);

    // Use a detailed prompt that includes time context
    const prompt = `现在是${dayOfWeek}${timePeriod}${timeStr}。你想主动跟对方打个招呼或分享一下生活。

要求：
1. 必须符合你的身份设定和当前时间场景（注意：深夜不会有阳光，早上不会说晚安等）
2. 内容要自然真实，符合你的说话风格和性格
3. 根据时间选择合适的话题和活动（要符合这个时段你可能在做的事）
4. 可以结合之前的对话内容，如果之前提到了计划或约定，可以自然地延续话题
5. 1-2句话即可，简短自然
6. 直接输出消息内容，不要有其他说明

请发送一条符合当前时间和你身份的消息：`;

    try {
      // Use the character's GPTClient with recent conversation history
      const response = await this.character.gptClient.chat(
        userId,
        prompt,
        recentHistory, // Include recent conversation history
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

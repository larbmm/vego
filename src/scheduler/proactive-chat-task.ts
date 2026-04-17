import { Character } from '../character/character.js';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import { ProactiveChatConfig } from '../config/config.js';

export class ProactiveChatTask {
  private character: Character;
  private client?: OpenAI;
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

  async initialize(): Promise<void> {
    this.client = new OpenAI({
      apiKey: this.character.apiKey,
      baseURL: this.character.apiBase,
    });
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
   * Generate a proactive message based on character persona
   */
  private async generateProactiveMessage(): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    const prompt = `你是一个虚拟角色，现在想主动跟主人打个招呼或分享一下生活。

要求：
1. 根据你的人设和关系，选择合适的称呼和语气
2. 内容可以是：简单问候、分享生活小事、想念对方、询问对方在做什么等
3. 保持简短自然，1-2句话即可
4. 不要太频繁或打扰，语气要轻松随意

示例：
- 女友风格："老公在吗？想你了~"
- 丫鬟风格："主人，奴婢想您了"
- 朋友风格："在干嘛呢？"
- 生活分享："刚才看到一只好可爱的猫咪！"

请直接输出一句话，不要有其他内容：`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.character.apiModel,
        messages: [
          { role: 'system', content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 100,
      });

      return response.choices[0].message.content?.trim() || '在吗？';
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
      const message = await this.generateProactiveMessage();
      
      await this.bot.telegram.sendMessage(telegramId, message);
      console.info(`[ProactiveChatTask:${charName}] Sent proactive message: ${message}`);

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

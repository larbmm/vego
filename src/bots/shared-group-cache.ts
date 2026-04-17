/**
 * 共享的群聊消息缓存
 * 所有bot实例共享同一个缓存，这样不同角色的bot可以看到彼此的消息
 */

import { GroupMessage } from './group-participation.js';

class SharedGroupCache {
  private static instance: SharedGroupCache;
  private recentGroupMessages: Map<string, GroupMessage[]> = new Map();
  private lastBotResponseTime: Map<string, Date> = new Map();
  // 记录每个bot在每个群中最后回复时的消息索引
  private botLastResponseIndex: Map<string, Map<string, number>> = new Map();

  private constructor() {}

  static getInstance(): SharedGroupCache {
    if (!SharedGroupCache.instance) {
      SharedGroupCache.instance = new SharedGroupCache();
    }
    return SharedGroupCache.instance;
  }

  getMessages(chatId: string): GroupMessage[] {
    return this.recentGroupMessages.get(chatId) || [];
  }

  /**
   * 获取某个bot从上次回复后到现在的消息
   * @param chatId 群聊ID
   * @param botName bot名字
   * @returns 该bot上次回复后的所有消息（不包括bot自己的回复）
   */
  getMessagesSinceLastResponse(chatId: string, botName: string): GroupMessage[] {
    const allMessages = this.getMessages(chatId);
    
    // 获取该bot上次回复的索引
    const lastIndex = this.getBotLastResponseIndex(chatId, botName);
    
    // 获取上次回复后的消息
    const messagesSince = lastIndex >= 0 
      ? allMessages.slice(lastIndex + 1)
      : allMessages;
    
    // 过滤掉bot自己的消息
    return messagesSince.filter(msg => msg.sender !== botName);
  }

  setMessages(chatId: string, messages: GroupMessage[]): void {
    this.recentGroupMessages.set(chatId, messages);
  }

  addMessage(chatId: string, message: GroupMessage): void {
    if (!this.recentGroupMessages.has(chatId)) {
      this.recentGroupMessages.set(chatId, []);
    }
    const messages = this.recentGroupMessages.get(chatId)!;
    messages.push(message);
    
    // 限制最多10条
    if (messages.length > 10) {
      messages.shift();
      // 当删除最早的消息时，所有bot的索引都需要减1
      this.adjustIndicesAfterShift(chatId);
    }
  }

  /**
   * 记录bot回复时的消息索引
   */
  recordBotResponse(chatId: string, botName: string): void {
    const messages = this.getMessages(chatId);
    const currentIndex = messages.length - 1; // 当前最后一条消息的索引
    
    if (!this.botLastResponseIndex.has(chatId)) {
      this.botLastResponseIndex.set(chatId, new Map());
    }
    
    this.botLastResponseIndex.get(chatId)!.set(botName, currentIndex);
  }

  private getBotLastResponseIndex(chatId: string, botName: string): number {
    return this.botLastResponseIndex.get(chatId)?.get(botName) ?? -1;
  }

  private adjustIndicesAfterShift(chatId: string): void {
    const botIndices = this.botLastResponseIndex.get(chatId);
    if (botIndices) {
      botIndices.forEach((index, botName) => {
        if (index > 0) {
          botIndices.set(botName, index - 1);
        } else {
          botIndices.set(botName, -1);
        }
      });
    }
  }

  clearMessages(chatId: string): void {
    this.recentGroupMessages.set(chatId, []);
    this.botLastResponseIndex.delete(chatId);
  }

  getLastResponseTime(chatId: string): Date | undefined {
    return this.lastBotResponseTime.get(chatId);
  }

  setLastResponseTime(chatId: string, time: Date): void {
    this.lastBotResponseTime.set(chatId, time);
  }
}

export const sharedGroupCache = SharedGroupCache.getInstance();

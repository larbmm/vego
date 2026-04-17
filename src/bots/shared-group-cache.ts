/**
 * 共享的群聊消息缓存
 * 所有bot实例共享同一个缓存，这样不同角色的bot可以看到彼此的消息
 */

import { GroupMessage } from './group-participation.js';

class SharedGroupCache {
  private static instance: SharedGroupCache;
  private recentGroupMessages: Map<string, GroupMessage[]> = new Map();
  private lastBotResponseTime: Map<string, Date> = new Map();

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
    }
  }

  clearMessages(chatId: string): void {
    this.recentGroupMessages.set(chatId, []);
  }

  getLastResponseTime(chatId: string): Date | undefined {
    return this.lastBotResponseTime.get(chatId);
  }

  setLastResponseTime(chatId: string, time: Date): void {
    this.lastBotResponseTime.set(chatId, time);
  }
}

export const sharedGroupCache = SharedGroupCache.getInstance();

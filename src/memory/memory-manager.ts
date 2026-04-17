import { DatabaseManager, Message, User } from './database.js';
import { MemoryConfig } from '../config/config.js';

export class MemoryManager {
  private db: DatabaseManager;
  private memoryConfig: MemoryConfig;

  constructor(dbPath: string, memoryConfig: MemoryConfig) {
    this.db = new DatabaseManager(dbPath);
    this.memoryConfig = memoryConfig;
  }

  getOrCreateUser(platform: string): User {
    return this.db.getOrCreateUser(platform);
  }

  updateUserPlatformId(userId: number, platform: string, platformUserId: string): void {
    this.db.updateUserPlatformId(userId, platform, platformUserId);
  }

  storeMessage(
    userId: number,
    role: 'user' | 'assistant',
    content: string,
    platform: string,
    messageId: string = '',
    senderName?: string
  ): void {
    this.db.storeMessage(userId, role, content, platform, messageId, senderName);
  }

  getConversationHistory(userId: number): Message[] {
    return this.db.getConversationHistory(userId, this.memoryConfig.max_history_messages);
  }

  shouldCompress(userId: number): boolean {
    return this.db.shouldCompress(userId);
  }

  compressConversation(userId: number): number {
    return this.db.compressConversation(userId);
  }

  getUnprocessedMessages(userId: number, lastId: number, targetDate: Date): Message[] {
    return this.db.getUnprocessedMessages(userId, lastId, targetDate);
  }

  getMessagesSinceId(userId: number, lastId: number): Message[] {
    return this.db.getMessagesSinceId(userId, lastId, 200);
  }

  close(): void {
    this.db.close();
  }
}

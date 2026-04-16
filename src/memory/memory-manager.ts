import { JsonlStorage, Message, User } from './jsonl-storage.js';
import { MemoryConfig } from '../config/config.js';

export class MemoryManager {
  private storage: JsonlStorage;
  private memoryConfig: MemoryConfig;

  constructor(storagePath: string, memoryConfig: MemoryConfig) {
    this.storage = new JsonlStorage(storagePath);
    this.memoryConfig = memoryConfig;
  }

  getOrCreateUser(platform: string): User {
    return this.storage.getOrCreateUser(platform);
  }

  storeMessage(
    userId: number,
    role: 'user' | 'assistant',
    content: string,
    platform: string,
    messageId: string = ''
  ): void {
    this.storage.storeMessage(userId, role, content, platform, messageId);
  }

  getConversationHistory(userId: number): Message[] {
    return this.storage.getConversationHistory(userId, this.memoryConfig.max_history_messages);
  }

  shouldCompress(userId: number): boolean {
    return this.storage.shouldCompress(userId);
  }

  compressConversation(userId: number): number {
    return this.storage.compressConversation(userId);
  }

  getUnprocessedMessages(userId: number, lastId: number, targetDate: Date): Message[] {
    return this.storage.getUnprocessedMessages(userId, lastId, targetDate);
  }

  getMessagesSinceId(userId: number, lastId: number): Message[] {
    return this.storage.getMessagesSinceId(userId, lastId, 200);
  }

  close(): void {
    this.storage.close();
  }
}

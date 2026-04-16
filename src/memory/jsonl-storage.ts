import * as fs from 'fs';
import * as path from 'path';

export interface Message {
  id: number;
  user_id: number;
  role: 'user' | 'assistant';
  content: string;
  platform: string;
  message_id: string;
  created_at: string;
}

export interface User {
  id: number;
  last_platform: string;
  last_seen: string;
  message_count_at_last_compression: number;
}

export class JsonlStorage {
  private messagesFile: string;
  private usersFile: string;
  private messageIdIndex: Map<string, number> = new Map();

  constructor(storagePath: string) {
    // Ensure directory exists
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    this.messagesFile = path.join(storagePath, 'messages.jsonl');
    this.usersFile = path.join(storagePath, 'users.json');

    // Create files if they don't exist
    if (!fs.existsSync(this.messagesFile)) {
      fs.writeFileSync(this.messagesFile, '');
    }
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify({}));
    }

    // Build message_id index
    this.buildMessageIdIndex();
  }

  private buildMessageIdIndex(): void {
    if (!fs.existsSync(this.messagesFile)) return;

    const content = fs.readFileSync(this.messagesFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as Message;
        if (msg.message_id) {
          this.messageIdIndex.set(`${msg.platform}:${msg.message_id}`, msg.id);
        }
      } catch (error) {
        console.error('[JsonlStorage] Failed to parse message line:', error);
      }
    }
  }

  getOrCreateUser(platform: string): User {
    const users = this.loadUsers();
    let user = users['1'];

    if (!user) {
      user = {
        id: 1,
        last_platform: platform,
        last_seen: new Date().toISOString().split('.')[0] + 'Z', // Remove milliseconds
        message_count_at_last_compression: 0,
      };
      users['1'] = user;
      this.saveUsers(users);
    } else {
      user.last_platform = platform;
      user.last_seen = new Date().toISOString().split('.')[0] + 'Z'; // Remove milliseconds
      users['1'] = user;
      this.saveUsers(users);
    }

    return user;
  }

  storeMessage(
    userId: number,
    role: 'user' | 'assistant',
    content: string,
    platform: string,
    messageId: string = ''
  ): void {
    // Check if message already exists
    if (messageId) {
      const key = `${platform}:${messageId}`;
      if (this.messageIdIndex.has(key)) {
        return;
      }
    }

    const id = this.getNextMessageId();
    const message: Message = {
      id,
      user_id: userId,
      role,
      content,
      platform,
      message_id: messageId,
      created_at: new Date().toISOString().split('.')[0] + 'Z', // Remove milliseconds
    };

    // Append to file
    fs.appendFileSync(this.messagesFile, JSON.stringify(message) + '\n');

    // Update index
    if (messageId) {
      this.messageIdIndex.set(`${platform}:${messageId}`, id);
    }
  }

  getConversationHistory(userId: number, limit: number = 100): Message[] {
    const allMessages = this.loadAllMessages();
    const userMessages = allMessages.filter(m => m.user_id === userId);
    return userMessages.slice(-limit);
  }

  getMessageCount(userId: number): number {
    const allMessages = this.loadAllMessages();
    return allMessages.filter(m => m.user_id === userId).length;
  }

  shouldCompress(userId: number): boolean {
    const users = this.loadUsers();
    const user = users[String(userId)];

    if (!user) {
      return false;
    }

    const currentCount = this.getMessageCount(userId);
    const messagesSinceCompression = currentCount - user.message_count_at_last_compression;
    const compressInterval = 300 - 100; // compress_threshold - max_recent_messages

    return messagesSinceCompression >= compressInterval;
  }

  compressConversation(userId: number): number {
    const allMessages = this.loadAllMessages();
    const userMessages = allMessages.filter(m => m.user_id === userId);
    const otherMessages = allMessages.filter(m => m.user_id !== userId);

    const keepCount = 100; // max_recent_messages
    const totalCount = userMessages.length;

    if (totalCount <= keepCount) {
      return 0;
    }

    const deleteCount = totalCount - keepCount;
    const keptMessages = userMessages.slice(-keepCount);

    // Rewrite file with kept messages
    const newMessages = [...otherMessages, ...keptMessages].sort((a, b) => a.id - b.id);
    this.saveAllMessages(newMessages);

    // Update user compression count
    const users = this.loadUsers();
    if (users[String(userId)]) {
      users[String(userId)].message_count_at_last_compression = keepCount;
      this.saveUsers(users);
    }

    // Rebuild index
    this.messageIdIndex.clear();
    this.buildMessageIdIndex();

    return deleteCount;
  }

  getUnprocessedMessages(userId: number, lastId: number, targetDate: Date): Message[] {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allMessages = this.loadAllMessages();
    return allMessages.filter(m => {
      if (m.user_id !== userId || m.id <= lastId) return false;
      const createdAt = new Date(m.created_at);
      return createdAt >= startOfDay && createdAt <= endOfDay;
    });
  }

  getMessagesSinceId(userId: number, lastId: number, limit: number = 200): Message[] {
    const allMessages = this.loadAllMessages();
    return allMessages
      .filter(m => m.user_id === userId && m.id > lastId)
      .slice(0, limit);
  }

  close(): void {
    // No cleanup needed for file-based storage
  }

  // Helper methods

  private loadUsers(): Record<string, User> {
    try {
      const content = fs.readFileSync(this.usersFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  private saveUsers(users: Record<string, User>): void {
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
  }

  private loadAllMessages(): Message[] {
    if (!fs.existsSync(this.messagesFile)) {
      return [];
    }

    const content = fs.readFileSync(this.messagesFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const messages: Message[] = [];
    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch (error) {
        console.error('[JsonlStorage] Failed to parse message line:', error);
      }
    }

    return messages;
  }

  private saveAllMessages(messages: Message[]): void {
    const content = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
    fs.writeFileSync(this.messagesFile, content);
  }

  private getNextMessageId(): number {
    const allMessages = this.loadAllMessages();
    if (allMessages.length === 0) {
      return 1;
    }
    return Math.max(...allMessages.map(m => m.id)) + 1;
  }
}

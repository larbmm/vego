import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface Message {
  id: number;
  user_id: number;
  role: 'user' | 'assistant';
  content: string;
  platform: string;
  message_id: string;
  created_at: string; // ISO string format
  sender_name?: string; // 群聊发言人名字
}

export interface User {
  id: number;
  last_platform: string;
  last_seen: string;
  message_count_at_last_compression: number;
  telegram_user_id?: string;
  discord_user_id?: string;
  feishu_user_id?: string;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        last_platform TEXT NOT NULL,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        message_count_at_last_compression INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        platform TEXT NOT NULL,
        message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sender_name TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    `);

    // Migrate: Add platform user ID columns if they don't exist
    this.migrateAddPlatformUserIds();
    // Migrate: Add sender_name column if it doesn't exist
    this.migrateAddSenderName();
  }

  private migrateAddPlatformUserIds(): void {
    try {
      // Check if columns exist by trying to select them
      const columns = this.db.pragma('table_info(users)') as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      if (!columnNames.includes('telegram_user_id')) {
        this.db.exec('ALTER TABLE users ADD COLUMN telegram_user_id TEXT');
        console.log('[Database] Added telegram_user_id column');
      }

      if (!columnNames.includes('discord_user_id')) {
        this.db.exec('ALTER TABLE users ADD COLUMN discord_user_id TEXT');
        console.log('[Database] Added discord_user_id column');
      }

      if (!columnNames.includes('feishu_user_id')) {
        this.db.exec('ALTER TABLE users ADD COLUMN feishu_user_id TEXT');
        console.log('[Database] Added feishu_user_id column');
      }
    } catch (error) {
      console.error('[Database] Migration error:', error);
    }
  }

  private migrateAddSenderName(): void {
    try {
      const columns = this.db.pragma('table_info(messages)') as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      if (!columnNames.includes('sender_name')) {
        this.db.exec('ALTER TABLE messages ADD COLUMN sender_name TEXT');
        console.log('[Database] Added sender_name column');
      }
    } catch (error) {
      console.error('[Database] Migration error:', error);
    }
  }

  getOrCreateUser(platform: string): User {
    let user = this.db
      .prepare('SELECT * FROM users WHERE id = 1')
      .get() as User | undefined;

    if (!user) {
      this.db.prepare(`
        INSERT INTO users (id, last_platform, last_seen, message_count_at_last_compression)
        VALUES (1, ?, datetime('now'), 0)
      `).run(platform);

      user = this.db
        .prepare('SELECT * FROM users WHERE id = 1')
        .get() as User;
    } else {
      this.db.prepare(`
        UPDATE users SET last_platform = ?, last_seen = datetime('now') WHERE id = 1
      `).run(platform);
    }

    return user;
  }

  updateUserPlatformId(userId: number, platform: string, platformUserId: string): void {
    const columnMap: Record<string, string> = {
      'telegram': 'telegram_user_id',
      'discord': 'discord_user_id',
      'feishu': 'feishu_user_id',
    };

    const column = columnMap[platform];
    if (!column) {
      return;
    }

    // platformUserId should already be extracted (no @ symbol)
    // Just update the database
    this.db.prepare(`
      UPDATE users SET ${column} = ? WHERE id = ?
    `).run(platformUserId, userId);
  }

  storeMessage(
    userId: number,
    role: 'user' | 'assistant',
    content: string,
    platform: string,
    messageId: string = '',
    senderName?: string
  ): void {
    // Check if message already exists
    if (messageId) {
      const existing = this.db
        .prepare('SELECT id FROM messages WHERE message_id = ? AND platform = ?')
        .get(messageId, platform);

      if (existing) {
        return;
      }
    }

    // Use local time instead of UTC
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO messages (user_id, role, content, platform, message_id, created_at, sender_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, role, content, platform, messageId || null, now, senderName || null);
  }

  getConversationHistory(userId: number, limit: number = 100): Message[] {
    const messages = this.db
      .prepare(`
        SELECT * FROM messages
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(userId, limit) as Message[];

    return messages.reverse();
  }

  getMessageCount(userId: number): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ?')
      .get(userId) as { count: number };

    return result.count;
  }

  shouldCompress(userId: number): boolean {
    const user = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as User | undefined;

    if (!user) {
      return false;
    }

    const currentCount = this.getMessageCount(userId);
    const messagesSinceCompression =
      currentCount - user.message_count_at_last_compression;
    const compressInterval = 300 - 100;

    return messagesSinceCompression >= compressInterval;
  }

  compressConversation(userId: number): number {
    const totalCount = this.getMessageCount(userId);
    const keepCount = 100;

    if (totalCount <= keepCount) {
      return 0;
    }

    const deleteCount = totalCount - keepCount;

    const toDelete = this.db
      .prepare(`
        SELECT id FROM messages
        WHERE user_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      `)
      .all(userId, deleteCount) as { id: number }[];

    const ids = toDelete.map((m) => m.id);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      this.db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...ids);
    }

    this.db.prepare(`
      UPDATE users
      SET message_count_at_last_compression = ?
      WHERE id = ?
    `).run(totalCount - deleteCount, userId);

    return deleteCount;
  }

  getUnprocessedMessages(userId: number, lastId: number, targetDate: Date): Message[] {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const messages = this.db
      .prepare(`
        SELECT * FROM messages
        WHERE user_id = ? AND id > ? AND created_at >= ? AND created_at <= ?
        ORDER BY created_at ASC
      `)
      .all(userId, lastId, startOfDay.toISOString(), endOfDay.toISOString()) as Message[];

    return messages;
  }

  getMessagesSinceId(userId: number, lastId: number, limit: number = 200): Message[] {
    const messages = this.db
      .prepare(`
        SELECT * FROM messages
        WHERE user_id = ? AND id > ?
        ORDER BY created_at ASC
        LIMIT ?
      `)
      .all(userId, lastId, limit) as Message[];

    return messages;
  }

  // Web interface methods
  getAllMessages(userId: number, limit: number = 50, offset: number = 0): { messages: Message[], total: number } {
    const total = this.getMessageCount(userId);
    
    const messages = this.db
      .prepare(`
        SELECT * FROM messages
        WHERE user_id = ?
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `)
      .all(userId, limit, offset) as Message[];

    return {
      messages: messages,
      total
    };
  }

  deleteMessage(messageId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM messages WHERE id = ?')
      .run(messageId);
    
    return result.changes > 0;
  }

  updateMessage(messageId: number, content: string): boolean {
    const result = this.db
      .prepare('UPDATE messages SET content = ? WHERE id = ?')
      .run(content, messageId);
    
    return result.changes > 0;
  }

  clearAllMessages(userId: number): number {
    const result = this.db
      .prepare('DELETE FROM messages WHERE user_id = ?')
      .run(userId);
    
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}

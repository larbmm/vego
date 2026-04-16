import { MemoryManager } from '../memory/memory-manager.js';
import { GPTClient } from '../ai/gpt-client.js';
import { MessageRouter, UnifiedMessage } from '../router/message.js';
import { MemoryConfig } from '../config/config.js';

export class Character {
  name: string;
  workspacePath: string;
  databasePath: string;
  apiKey: string;
  apiBase: string;
  apiModel: string;
  memoryConfig: MemoryConfig;

  memoryManager?: MemoryManager;
  gptClient?: GPTClient;
  router?: MessageRouter;

  // Message batching per user
  private userBatches: Map<number, {
    messages: UnifiedMessage[];
    timer: NodeJS.Timeout | null;
    processing: boolean;
  }> = new Map();

  private readonly BATCH_DELAY = 2000; // 2 seconds to wait for more messages

  constructor(
    name: string,
    workspacePath: string,
    storagePath: string,
    apiKey: string,
    apiBase: string,
    apiModel: string,
    memoryConfig: MemoryConfig
  ) {
    this.name = name;
    this.workspacePath = workspacePath;
    this.databasePath = storagePath;
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.apiModel = apiModel;
    this.memoryConfig = memoryConfig;
  }

  async initialize(): Promise<void> {
    this.memoryManager = new MemoryManager(this.databasePath, this.memoryConfig);

    this.gptClient = new GPTClient(
      this.memoryManager,
      this.workspacePath,
      this.apiKey,
      this.apiBase,
      this.apiModel
    );

    this.router = new MessageRouter();
    this.router.registerHandler('all', this.handleMessage.bind(this));
  }

  async handleMessage(message: UnifiedMessage): Promise<string> {
    try {
      if (!this.memoryManager || !this.gptClient) {
        throw new Error('Character not initialized');
      }

      // Use user_id instead of platform to identify users
      const user = this.memoryManager.getOrCreateUser(message.user_id);

      // Check if it's a group chat (user_id contains @)
      const isGroup = message.user_id.includes('@');

      // Skip batching for group chats
      if (isGroup) {
        return await this.processMessage(user.id, message);
      }

      // Get or create batch for this user (private chat only)
      let batch = this.userBatches.get(user.id);
      if (!batch) {
        batch = { messages: [], timer: null, processing: false };
        this.userBatches.set(user.id, batch);
      }

      // If already processing, queue this message
      if (batch.processing) {
        return new Promise((resolve) => {
          batch!.messages.push(message);
          
          // Clear existing timer
          if (batch!.timer) {
            clearTimeout(batch!.timer);
          }

          // Set new timer to process batch
          batch!.timer = setTimeout(() => {
            this.processBatch(user.id).then(resolve).catch(() => resolve(''));
          }, this.BATCH_DELAY);
        });
      }

      // Start processing
      batch.processing = true;
      batch.messages.push(message);

      // Wait a bit for more messages
      await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));

      return await this.processBatch(user.id);
    } catch (error) {
      console.error(`[ERROR] ${this.name} handle_message:`, error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async processMessage(userId: number, message: UnifiedMessage): Promise<string> {
    const history = this.memoryManager!.getConversationHistory(userId);
    const historyDict = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
    }));

    const response = await this.gptClient!.chat(userId, message.content, historyDict);

    this.memoryManager!.storeMessage(
      userId,
      'user',
      message.content,
      message.platform,
      message.platform_message_id
    );

    await this.saveResponse(userId, response, message);

    return response;
  }

  private async processBatch(userId: number): Promise<string> {
    const batch = this.userBatches.get(userId);
    if (!batch || batch.messages.length === 0) {
      return '';
    }

    try {
      // Combine all messages
      const combinedContent = batch.messages.map(m => m.content).join('\n');
      const lastMessage = batch.messages[batch.messages.length - 1];

      const history = this.memoryManager!.getConversationHistory(userId);
      const historyDict = history.map((msg) => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      }));

      const response = await this.gptClient!.chat(userId, combinedContent, historyDict);

      // Store all user messages
      for (const msg of batch.messages) {
        this.memoryManager!.storeMessage(
          userId,
          'user',
          msg.content,
          msg.platform,
          msg.platform_message_id
        );
      }

      // Store single response
      await this.saveResponse(userId, response, lastMessage);

      return response;
    } finally {
      // Clean up batch
      this.userBatches.delete(userId);
    }
  }

  private async saveResponse(userId: number, response: string, message: UnifiedMessage): Promise<void> {
    try {
      if (!this.memoryManager) {
        throw new Error('Memory manager not initialized');
      }

      this.memoryManager.storeMessage(userId, 'assistant', response, message.platform, '');
    } catch (error) {
      console.error(`[DEBUG] ${this.name} error saving response:`, error);
    }
  }

  async handleTelegramMessage(message: UnifiedMessage): Promise<string> {
    return this.handleMessage(message);
  }

  async handleDiscordMessage(message: UnifiedMessage): Promise<string> {
    return this.handleMessage(message);
  }

  async handleFeishuMessage(message: UnifiedMessage): Promise<string> {
    return this.handleMessage(message);
  }

  close(): void {
    if (this.memoryManager) {
      this.memoryManager.close();
    }
  }
}

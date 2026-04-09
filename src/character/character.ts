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

  constructor(
    name: string,
    workspacePath: string,
    databasePath: string,
    apiKey: string,
    apiBase: string,
    apiModel: string,
    memoryConfig: MemoryConfig
  ) {
    this.name = name;
    this.workspacePath = workspacePath;
    this.databasePath = databasePath;
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

      const user = this.memoryManager.getOrCreateUser(message.platform);

      const history = this.memoryManager.getConversationHistory(user.id);
      const historyDict = history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await this.gptClient.chat(user.id, message.content, historyDict);

      this.memoryManager.storeMessage(
        user.id,
        'user',
        message.content,
        message.platform,
        message.platform_message_id
      );

      await this.saveResponse(user.id, response, message);

      return response;
    } catch (error) {
      console.error(`[ERROR] ${this.name} handle_message:`, error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
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

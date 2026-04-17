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

      // Use user_id instead of platform to identify users
      const user = this.memoryManager.getOrCreateUser(message.user_id);

      // Update platform user ID (extract from user_id for private chats)
      const isGroup = message.user_id.includes('@');
      if (!isGroup) {
        // For private chats, user_id is the platform user ID
        this.memoryManager.updateUserPlatformId(user.id, message.platform, message.user_id);
      }

      // Check if it's a group chat (user_id contains @)
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

    // Check if it's a group chat (user_id contains @)
    const isGroupChat = message.user_id.includes('@');

    // Prepare group context if available
    let groupContextText = '';
    let fullMessageContent = message.content; // 用于存储的完整内容
    
    if (isGroupChat && message.groupContext) {
      // 过滤掉当前角色自己的消息，只保留其他人的
      const otherMessages = message.groupContext.recentMessages.filter(
        msg => msg.sender !== this.name
      );
      
      const members = message.groupContext.members.join('、');
      const recentChats = otherMessages
        .slice(-10) // 最多10条
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');
      
      // 只有当有其他人的消息时才添加群聊上下文
      if (recentChats) {
        groupContextText = `\n\n[群聊上下文]\n群成员：${members}\n最近的聊天记录：\n${recentChats}\n[/群聊上下文]\n\n`;
        
        // 存储时包含群聊上下文，这样在web界面能看到完整对话
        fullMessageContent = groupContextText + message.content;
      }
    }

    const response = await this.gptClient!.chat(
      userId, 
      groupContextText + message.content, 
      historyDict, 
      isGroupChat
    );

    this.memoryManager!.storeMessage(
      userId,
      'user',
      fullMessageContent, // 存储包含上下文的完整内容
      message.platform,
      message.platform_message_id,
      message.senderName
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

      // Check if it's a group chat
      const isGroupChat = lastMessage.user_id.includes('@');

      // Prepare group context if available
      let groupContextText = '';
      let fullUserMessage = combinedContent;
      
      if (isGroupChat && lastMessage.groupContext) {
        // 过滤掉当前角色自己的消息，只保留其他人的
        const otherMessages = lastMessage.groupContext.recentMessages.filter(
          msg => msg.sender !== this.name
        );
        
        const members = lastMessage.groupContext.members.join('、');
        const recentChats = otherMessages
          .slice(-10)
          .map(msg => `${msg.sender}: ${msg.content}`)
          .join('\n');
        
        // 只有当有其他人的消息时才添加群聊上下文
        if (recentChats) {
          groupContextText = `\n\n[群聊上下文]\n群成员：${members}\n最近的聊天记录：\n${recentChats}\n[/群聊上下文]\n\n`;
          
          // 将群聊上下文合并到用户消息中，用于存储到数据库
          fullUserMessage = groupContextText + combinedContent;
        }
      }

      const response = await this.gptClient!.chat(
        userId, 
        groupContextText + combinedContent, 
        historyDict, 
        isGroupChat
      );

      // Store all user messages
      for (const msg of batch.messages) {
        // 对于批量消息，只有最后一条包含群聊上下文
        const contentToStore = (msg === lastMessage && isGroupChat) ? fullUserMessage : msg.content;
        
        this.memoryManager!.storeMessage(
          userId,
          'user',
          contentToStore,
          msg.platform,
          msg.platform_message_id,
          msg.senderName
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

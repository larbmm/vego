import OpenAI from 'openai';
import { MemoryManager } from '../memory/memory-manager.js';
import { WorkspaceLoader } from './workspace-loader.js';

const DEFAULT_TIMEOUT = 60000; // 60 seconds in milliseconds

export class GPTClient {
  private client: OpenAI;
  private model: string;
  private memoryManager: MemoryManager;
  private workspace: WorkspaceLoader;

  constructor(
    memoryManager: MemoryManager,
    workspacePath: string,
    apiKey: string,
    apiBase: string,
    model: string,
    timeout: number = DEFAULT_TIMEOUT
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: apiBase,
      timeout,
    });
    this.model = model;
    this.memoryManager = memoryManager;
    this.workspace = new WorkspaceLoader(workspacePath);
  }

  private loadPersona(): string {
    try {
      return this.workspace.loadPersona();
    } catch (error) {
      console.error('[GPTClient] Failed to load persona:', error);
      return '';
    }
  }

  private async buildSystemPrompt(userId: number): Promise<string> {
    const personaContent = this.loadPersona();
    
    // 添加当前时间信息
    const now = new Date();
    const timeInfo = `\n\n---\n当前时间：${now.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    })}\n\n注意：对话历史中的时间戳格式为 (时间: YYYY/MM/DD HH:mm)，这是系统添加的，你的回复中不要包含这种格式的时间戳。\n---\n`;

    return personaContent + timeInfo;
  }

  async chat(
    userId: number,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string; created_at?: string }> = []
  ): Promise<string> {
    const systemPrompt = await this.buildSystemPrompt(userId);

    // Format conversation history with timestamps
    // Use a format that's informative but less likely to be mimicked
    const formattedHistory = conversationHistory.map((msg) => {
      let content = msg.content;
      
      // Add timestamp in a system-like format
      if (msg.created_at) {
        const msgTime = new Date(msg.created_at);
        const timeStr = msgTime.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        // Use parentheses to make it look like system metadata
        content = `(时间: ${timeStr}) ${content}`;
      }
      
      return {
        role: msg.role as 'user' | 'assistant',
        content,
      };
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.8,
        max_tokens: 500,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in response');
      }

      let reply = response.choices[0].message.content || '';
      if (!reply) {
        reply = '...';
      }

      // Schedule compression if needed
      if (this.memoryManager.shouldCompress(userId)) {
        setImmediate(() => {
          this.compressTask(userId, conversationHistory).catch((err) => {
            console.warn('[GPTClient] Failed to compress conversation:', err);
          });
        });
      }

      return reply;
    } catch (error: any) {
      console.error('[GPTClient] API call failed:', error);
      console.error('[GPTClient] Model:', this.model);
      console.error('[GPTClient] API Base:', this.client.baseURL);
      console.error('[GPTClient] Error details:', {
        status: error?.status,
        message: error?.message,
        type: error?.type,
        code: error?.code,
      });
      
      if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
        throw new Error('API 请求超时，请稍后重试');
      }
      
      if (error?.status === 403) {
        throw new Error('API 权限错误：可能是余额不足、模型不可用或 API key 无效');
      }
      
      throw error;
    }
  }

  private async compressTask(
    userId: number,
    recentContext: Array<{ role: string; content: string; created_at?: string }>
  ): Promise<void> {
    try {
      this.memoryManager.compressConversation(userId);
      console.info(`[GPTClient] Compressed conversation for user ${userId}`);
    } catch (error) {
      console.warn('[GPTClient] Failed to compress conversation:', error);
    }
  }
}

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
    })}\n---\n`;

    return personaContent + timeInfo;
  }

  async chat(
    userId: number,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    const systemPrompt = await this.buildSystemPrompt(userId);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
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
    recentContext: Array<{ role: string; content: string }>
  ): Promise<void> {
    try {
      this.memoryManager.compressConversation(userId);
      console.info(`[GPTClient] Compressed conversation for user ${userId}`);
    } catch (error) {
      console.warn('[GPTClient] Failed to compress conversation:', error);
    }
  }
}

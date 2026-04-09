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
    console.debug(`[GPTClient] Building system prompt for user ${userId}`);

    const personaContent = this.loadPersona();

    console.debug(`[GPTClient] System prompt built, length: ${personaContent.length}`);
    return personaContent;
  }

  async chat(
    userId: number,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    console.debug(`[GPTClient] Starting chat for user ${userId}`);

    const systemPrompt = await this.buildSystemPrompt(userId);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    console.debug(`[GPTClient] Calling API with ${messages.length} messages`);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.8,
        max_tokens: 500,
      });

      console.debug('[GPTClient] API call successful');

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in response');
      }

      let reply = response.choices[0].message.content || '';
      if (!reply) {
        console.warn('[GPTClient] Empty reply from API');
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
      if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
        console.error('[GPTClient] API request timed out');
        throw new Error('API 请求超时，请稍后重试');
      }
      console.error('[GPTClient] API call failed:', error);
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

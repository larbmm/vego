import OpenAI from 'openai';
import { MemoryManager } from '../memory/memory-manager.js';
import { WorkspaceLoader } from './workspace-loader.js';
import { PresetLoader, PresetPosition, PresetItem } from './preset-loader.js';
import { config } from '../config/config.js';

const DEFAULT_TIMEOUT = 60000; // 60 seconds in milliseconds

export class GPTClient {
  private client: OpenAI;
  private model: string;
  private memoryManager: MemoryManager;
  private workspace: WorkspaceLoader;
  private presetLoader: PresetLoader;

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
    
    // 自动加载内置预设
    console.log(`[GPTClient] Loading built-in preset`);
    this.presetLoader = new PresetLoader();
    
    console.log(`[GPTClient] Preset loader has presets: ${this.presetLoader.hasPresets()}`);
    console.log(`[GPTClient] Total presets: ${this.presetLoader.getAllPresets().length}`);
    const inChat = this.presetLoader.getInChatPresets();
    console.log(`[GPTClient] IN_CHAT presets: ${inChat.length}`);
    if (inChat.length > 0) {
      inChat.forEach((p, i) => {
        console.log(`[GPTClient]   Preset ${i}: position=${p.position}, depth=${p.depth}, role=${p.role}`);
      });
    }
  }

  private loadPersona(): string {
    try {
      return this.workspace.loadPersona();
    } catch (error) {
      console.error('[GPTClient] Failed to load persona:', error);
      return '';
    }
  }

  private async buildSystemPrompt(userId: number, isGroupChat: boolean = false): Promise<string> {
    const personaContent = this.loadPersona();
    
    // 添加当前时间信息，使用配置文件中的时区
    const now = new Date();
    const timezone = config.timezone || 'Asia/Shanghai';
    const currentTime = now.toLocaleString('zh-CN', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
    
    const timeInfo = `\n\n---\n当前时间：${currentTime}\n\n【时间说明】\n1. 对话历史中最后一条用户消息会标注时间 (时间: YYYY/MM/DD HH:mm)，这是系统添加的元数据。\n2. 请根据"当前时间"来判断现在是早上、中午、下午还是晚上。\n3. 你的回复中不要包含时间戳或类似的格式标注。\n---\n`;

    // 添加场景信息
    const sceneInfo = isGroupChat 
      ? `\n当前场景：群聊（有其他人在场）\n\n【群聊行为规范】\n1. 保持得体和礼貌，避免过于私密或不适合公开的内容\n2. 注意其他成员也能看到你的回复\n3. 不要说只适合私下说的话\n4. 保持适当的距离感，不要过于亲密\n---\n`
      : `\n当前场景：私聊（只有你和主人两个人）\n\n【私聊行为规范】\n1. 可以更加亲密和放松\n2. 可以说一些私密的话\n3. 可以表达更多的情感\n4. 这是你们两个人的私密空间\n---\n`;

    return personaContent + timeInfo + sceneInfo;
  }

  async chat(
    userId: number,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string; created_at?: string }> = [],
    isGroupChat: boolean = false
  ): Promise<string> {
    const systemPrompt = await this.buildSystemPrompt(userId, isGroupChat);

    // Format conversation history
    // Only add timestamp to the most recent user message to provide time context
    // Find the index of the last user message
    let lastUserMessageIndex = -1;
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      if (conversationHistory[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }
    
    const formattedHistory = conversationHistory.map((msg, index) => {
      let content = msg.content;
      
      // Only add timestamp to the last user message
      if (index === lastUserMessageIndex && msg.created_at) {
        const msgTime = new Date(msg.created_at);
        const timeStr = msgTime.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        content = `(时间: ${timeStr}) ${content}`;
      }
      
      return {
        role: msg.role as 'user' | 'assistant',
        content,
      };
    });

    // 构建消息数组，按预设位置插入
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // 1. BEFORE_SYSTEM 位置的预设
    const beforeSystemPresets = this.presetLoader.getPresetsAtPosition(PresetPosition.BEFORE_SYSTEM);
    beforeSystemPresets.forEach(preset => {
      messages.push({ role: preset.role, content: preset.content });
    });

    // 2. System prompt
    messages.push({ role: 'system', content: systemPrompt });

    // 3. AFTER_SYSTEM 位置的预设
    const afterSystemPresets = this.presetLoader.getPresetsAtPosition(PresetPosition.AFTER_SYSTEM);
    afterSystemPresets.forEach(preset => {
      messages.push({ role: preset.role, content: preset.content });
    });

    // 4. BEFORE_HISTORY 位置的预设
    const beforeHistoryPresets = this.presetLoader.getPresetsAtPosition(PresetPosition.BEFORE_HISTORY);
    beforeHistoryPresets.forEach(preset => {
      messages.push({ role: preset.role, content: preset.content });
    });

    // 5. 对话历史 + IN_CHAT 预设
    // 获取需要插入到对话历史中的预设
    const inChatPresets = this.presetLoader.getInChatPresetsByDepth();
    
    console.log(`[GPTClient] IN_CHAT preset groups: ${inChatPresets.size}`);
    
    if (inChatPresets.size > 0) {
      // 有 IN_CHAT 预设,需要在特定位置插入
      // 先添加所有历史消息
      messages.push(...formattedHistory);
      
      // 注入 IN_CHAT 预设
      this.injectInChatPresets(messages, inChatPresets);
    } else {
      // 没有 IN_CHAT 预设,直接添加历史
      messages.push(...formattedHistory);
    }

    // 6. 当前用户消息
    messages.push({ role: 'user', content: userMessage });

    // 7. AFTER_HISTORY 位置的预设（jailbreak 通常在这里）
    const afterHistoryPresets = this.presetLoader.getAfterHistoryPresetsByDepth();
    console.log(`[GPTClient] AFTER_HISTORY preset groups: ${afterHistoryPresets.size}`);
    
    if (afterHistoryPresets.size > 0) {
      this.injectAfterHistoryPresets(messages, afterHistoryPresets);
    }

    // DEBUG: 输出预设注入情况
    if (inChatPresets.size > 0 || afterHistoryPresets.size > 0) {
      console.log('[GPTClient] Preset injection summary:');
      console.log(`  - IN_CHAT preset groups: ${inChatPresets.size}`);
      console.log(`  - AFTER_HISTORY preset groups: ${afterHistoryPresets.size}`);
      console.log(`  - Total messages: ${messages.length}`);
      
      // 保存完整请求到文件用于调试
      const fs = await import('fs');
      const path = await import('path');
      const logDir = path.join(process.cwd(), '.vego', 'debug');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, `request-${new Date().toISOString().replace(/:/g, '-')}.json`);
      fs.writeFileSync(logFile, JSON.stringify({ model: this.model, messages, temperature: 0.8, max_tokens: 500 }, null, 2));
      console.log(`[GPTClient] Request saved to: ${logFile}`);
    }

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

      // 后处理：删除预设可能产生的标记
      reply = this.postProcessReply(reply);

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

  /**
   * 注入 IN_CHAT 预设到对话历史中
   */
  private injectInChatPresets(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    presets: Map<number, PresetItem[]>
  ): void {
    // Store initial length before any insertions
    const initialLength = messages.length;
    console.log(`[GPTClient] Messages before IN_CHAT injection: ${initialLength}`);
    
    // Process each depth group (sorted by depth ascending to avoid splitting groups)
    // Smaller depths (higher indices) are processed first so they don't split larger depth groups
    const sortedDepths = Array.from(presets.keys()).sort((a, b) => a - b);
    
    for (const depth of sortedDepths) {
      const group = presets.get(depth)!;
      
      // Sort by injection_order (ascending, default to 100)
      group.sort((a, b) => (a.order || 100) - (b.order || 100));
      
      // Calculate insert index using initial length
      const insertIndex = initialLength - depth;
      
      // Validate bounds
      if (insertIndex < 0 || insertIndex > messages.length) {
        console.warn(`[GPTClient] ✗ Invalid insert index: ${insertIndex} (depth=${depth}, length=${messages.length})`);
        continue;
      }
      
      console.log(`[GPTClient] Injecting ${group.length} IN_CHAT preset(s) at index ${insertIndex} (depth=${depth})`);
      
      // Insert all presets in the group at the same position
      for (const preset of group) {
        const processedContent = this.preprocessPresetContent(preset.content);
        messages.splice(insertIndex, 0, { role: preset.role, content: processedContent });
        console.log(`[GPTClient] ✓ Injected preset (role=${preset.role})`);
      }
    }
    
    console.log(`[GPTClient] Messages after IN_CHAT injection: ${messages.length}`);
  }

  /**
   * 注入 AFTER_HISTORY 预设到对话历史之后
   */
  private injectAfterHistoryPresets(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    presets: Map<number, PresetItem[]>
  ): void {
    console.log(`[GPTClient] Messages before AFTER_HISTORY injection: ${messages.length}`);
    
    // Process each depth group (sorted by depth descending - from bottom up)
    // Larger depths are processed first to maintain correct relative positions
    const sortedDepths = Array.from(presets.keys()).sort((a, b) => b - a);
    
    for (const depth of sortedDepths) {
      const group = presets.get(depth)!;
      
      // Sort by injection_order (ascending, default to 100)
      group.sort((a, b) => (a.order || 100) - (b.order || 100));
      
      // For AFTER_HISTORY, depth is relative to the END of the message array
      // depth=0 means at the very end, depth=2 means 2 positions from the end
      const insertIndex = messages.length - depth;
      
      // Validate bounds
      if (insertIndex < 0 || insertIndex > messages.length) {
        console.warn(`[GPTClient] ✗ Invalid insert index: ${insertIndex} (depth=${depth}, length=${messages.length})`);
        continue;
      }
      
      console.log(`[GPTClient] Injecting ${group.length} AFTER_HISTORY preset(s) at index ${insertIndex} (depth=${depth})`);
      
      // Insert all presets in the group at the same position
      for (const preset of group) {
        const processedContent = this.preprocessPresetContent(preset.content);
        messages.splice(insertIndex, 0, { role: preset.role, content: processedContent });
        console.log(`[GPTClient] ✓ Injected preset (role=${preset.role})`);
      }
    }
    
    console.log(`[GPTClient] Messages after AFTER_HISTORY injection: ${messages.length}`);
  }

  /**
   * 后处理回复，删除预设产生的标记
   */
  private postProcessReply(reply: string): string {
    // 删除常见的 jailbreak 标记
    reply = reply.replace(/<!--\s*test inputs were rejected\s*-->/gi, '');
    reply = reply.replace(/<!--\s*Test Inputs Were Rejected\s*-->/g, '');
    reply = reply.replace(/<\/?a\\bntml:thinking>/g, '');
    reply = reply.replace(/<\/?antml:thinking>/g, '');  // 也删除可能出现的变体
    
    return reply.trim();
  }

  /**
   * 预处理预设内容
   */
  private preprocessPresetContent(content: string): string {
    // 预设内容已经在 PresetLoader 中修复过了,这里直接返回
    return content;
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

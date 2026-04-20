import OpenAI from 'openai';

export interface GroupMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isReplyToMe?: boolean;
  mentionsMe?: boolean;
}

export class GroupParticipation {
  private client: OpenAI;
  private model: string;
  private characterName: string;
  private useAIJudgment: boolean;

  constructor(
    apiKey: string, 
    apiBase: string, 
    model: string, 
    characterName: string,
    useAIJudgment: boolean = false
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: apiBase,
    });
    this.model = model;
    this.characterName = characterName;
    this.useAIJudgment = useAIJudgment;
  }

  /**
   * Quick check if should respond (rule-based, no API call)
   */
  shouldRespondQuick(message: GroupMessage, recentMessages: GroupMessage[]): 'must' | 'maybe' | 'no' {
    // Always respond if mentioned or replied to
    if (message.mentionsMe || message.isReplyToMe) {
      return 'must';
    }

    // Check if message contains character name (including Chinese names)
    const chineseNameMap: Record<string, string> = {
      'qianqian': '芊芊',
      'wanqing': '婉清',
      'xiyue': '曦月',
    };
    
    const nameVariations = [
      this.characterName,
      this.characterName.toLowerCase(),
      this.characterName.toUpperCase(),
    ];
    
    if (chineseNameMap[this.characterName.toLowerCase()]) {
      nameVariations.push(chineseNameMap[this.characterName.toLowerCase()]);
    }

    for (const name of nameVariations) {
      if (message.content.includes(name)) {
        return 'must';
      }
    }

    // Check if addressing multiple people (like "你们俩", "你们两个")
    // This suggests the message might be for all characters in the group
    const addressingMultiple = /你们(俩|两个|几个|都)|你俩|两位/.test(message.content);
    if (addressingMultiple) {
      // Check if it's a command or request (写、做、来、去、说、唱、跳 etc.)
      const isCommandOrRequest = /(写|做|来|去|说|唱|跳|读|背|念|讲|画|弹|奏|表演|展示|准备|安排|处理|完成)/.test(message.content);
      
      if (isCommandOrRequest) {
        // If it's a command/request to "你们俩", both should respond
        return 'must';
      }
      
      // Check if there are other characters mentioned in recent messages
      // or if this character recently spoke (indicating active participation)
      const recentSpeakers = recentMessages.slice(-5).map(m => m.sender);
      const thisCharacterRecentlyActive = recentSpeakers.includes(this.characterName);
      
      if (thisCharacterRecentlyActive) {
        return 'must'; // Likely addressing this character too
      }
      return 'maybe'; // Might be addressing this character
    }

    // Don't respond if just spoke
    if (recentMessages.length > 0) {
      const lastMessage = recentMessages[recentMessages.length - 1];
      if (lastMessage.sender === this.characterName) {
        return 'no';
      }
    }

    // Don't respond to very short messages or just emoji
    if (message.content.length < 3 || /^[\u{1F300}-\u{1F9FF}]+$/u.test(message.content)) {
      return 'no';
    }

    // Check if it's a question
    const isQuestion = /[？?]/.test(message.content) || 
                      /^(怎么|为什么|什么|哪里|谁|是不是|对吗|好吗)/.test(message.content);
    
    if (isQuestion) {
      return 'maybe'; // 50% chance
    }

    // Check if addressing the group
    const addressingGroup = /^(你们|大家|各位)/.test(message.content);
    if (addressingGroup) {
      return 'maybe'; // 50% chance
    }

    // Default: low chance to respond
    return 'maybe'; // Will use low probability
  }

  /**
   * AI-based contextual judgment (for complex scenarios like rivalry)
   */
  async shouldRespondAI(
    message: GroupMessage,
    recentMessages: GroupMessage[],
    characterPersona: string
  ): Promise<{ shouldRespond: boolean; reason: string }> {
    const conversationContext = recentMessages
      .slice(-8) // Last 8 messages for context
      .map((m) => `${m.sender}: ${m.content}`)
      .join('\n');

    const prompt = `你是 ${this.characterName}。

你的人设：
${characterPersona.substring(0, 300)}

最近的群聊对话：
${conversationContext}

最新消息：
${message.sender}: ${message.content}

请判断你是否应该回复。考虑以下情境：

1. **争宠场景**：如果其他角色在向主人示好、承诺、表忠心，你是否感到威胁需要回应？
2. **话题相关**：话题是否与你的人设、专长、关系相关？
3. **情感触发**：对方的话是否触发了你的情绪（嫉妒、不服、关心等）？
4. **自然参与**：对话是否自然需要你参与？

注意：
- 不要每条都回复，保持自然
- 如果刚说过话，除非特别重要否则不要连续发言
- 根据你的性格决定是否要"争"

请用 JSON 格式回复：
\`\`\`json
{
  "should_respond": true/false,
  "reason": "简短说明原因（如：感到威胁需要表态/话题不相关/刚说过话）",
  "emotion": "当前情绪（可选）"
}
\`\`\``;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7, // Higher temperature for more personality
        max_tokens: 150,
      });

      const content = response.choices[0].message.content?.trim() || '';
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const result = JSON.parse(jsonStr);
      return {
        shouldRespond: result.should_respond || false,
        reason: result.reason || '',
      };
    } catch (error) {
      console.error('[GroupParticipation] Error in AI judgment:', error);
      return { shouldRespond: false, reason: 'Error in judgment' };
    }
  }

  /**
   * Decide if should respond based on rules and probability
   */
  async shouldRespond(
    message: GroupMessage,
    recentMessages: GroupMessage[],
    config: { 
      questionProbability?: number; 
      normalProbability?: number;
      characterPersona?: string;
    } = {}
  ): Promise<{ shouldRespond: boolean; reason: string }> {
    const quickResult = this.shouldRespondQuick(message, recentMessages);

    if (quickResult === 'must') {
      return { shouldRespond: true, reason: 'Mentioned or replied to' };
    }

    if (quickResult === 'no') {
      return { shouldRespond: false, reason: 'Just spoke or message too short' };
    }

    // If AI judgment is enabled and persona is provided, use AI
    if (this.useAIJudgment && config.characterPersona) {
      return await this.shouldRespondAI(message, recentMessages, config.characterPersona);
    }

    // Otherwise use probability-based judgment
    const isQuestion = /[？?]/.test(message.content);
    const probability = isQuestion 
      ? (config.questionProbability || 0.5)
      : (config.normalProbability || 0.2);

    const shouldRespond = Math.random() < probability;

    return {
      shouldRespond,
      reason: shouldRespond 
        ? `Random chance (${(probability * 100).toFixed(0)}%)`
        : `Skipped by probability (${(probability * 100).toFixed(0)}% chance)`,
    };
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { Character } from '../character/character.js';
import OpenAI from 'openai';

export class DreamTask {
  private character: Character;
  private minConversations: number;
  private client?: OpenAI;
  private dreamPrompt?: string;

  constructor(character: Character, minConversations: number = 20) {
    this.character = character;
    this.minConversations = minConversations;
  }

  private loadDreamPrompt(workspacePath: string): string {
    const promptPath = path.join(workspacePath, 'memory', 'dream_prompt.md');
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf-8');
    }
    return this.defaultDreamPrompt();
  }

  private defaultDreamPrompt(): string {
    return `你是一个记忆整理助手。请分析以下对话记录，提取信息并分层存储。

对话记录：
{conversations}

请按以下JSON格式输出（不要有其他内容）：
\`\`\`json
{
  "diary": "日记内容，第一人称，记录今天发生了什么、有什么感受",
  "summary": "一句话总结今天，格式：日期+关键事件+情感（例：04/06 聊了旅行计划，用户想去日本看樱花，聊得很开心）",
  "important_facts": [
    "用户提到的重要事实、偏好、承诺、约定等需要长期记住的信息",
    "例：用户喜欢吃辣",
    "例：用户计划5月去日本旅行",
    "例：用户不喜欢被打扰工作"
  ],
  "relationship": {
    "changes": ["关系变化描述，如：信任加深/变得更亲密"],
    "new_patterns": ["新的互动模式，如：开始用昵称/有了新的默契"]
  },
  "state": {
    "mood": "当前心情状态",
    "interests": ["近期感兴趣的话题"],
    "preferences": ["近期表现出的偏好变化"]
  }
}
\`\`\`

注意：
- important_facts 只记录需要长期记住的重要信息，不要记录日常寒暄或临时性的内容
- relationship 只记录重要的关系变化，没有变化就留空数组
- state 只记录有明确表现的内容，不要猜测
- 如果某个字段没有内容，使用空数组或空字符串`;
  }

  async initialize(): Promise<void> {
    this.client = new OpenAI({
      apiKey: this.character.apiKey,
      baseURL: this.character.apiBase,
    });
  }

  async call(state: Record<string, any>): Promise<Record<string, any>> {
    const charName = this.character.name;
    const stateKey = `dream_${charName}`;
    const taskState = state[stateKey] || {};

    if (!this.client) {
      await this.initialize();
    }

    if (!this.dreamPrompt) {
      this.dreamPrompt = this.loadDreamPrompt(this.character.workspacePath);
    }

    if (!this.character.memoryManager) {
      return {};
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const lastProcessedId = taskState.last_processed_id || 0;
    const pendingCount = taskState.pending_count || 0;

    const messages = this.character.memoryManager!.getUnprocessedMessages(1, lastProcessedId, yesterday);

    if (messages.length === 0) {
      console.info(`[DreamTask:${charName}] No new messages to process`);
      return {};
    }

    const totalRounds = pendingCount + messages.length;
    console.info(
      `[DreamTask:${charName}] Total rounds: ${totalRounds} (pending: ${pendingCount}, new: ${messages.length})`
    );

    if (totalRounds < this.minConversations) {
      const lastId = messages.length > 0 ? messages[messages.length - 1].id : lastProcessedId;
      return {
        [stateKey]: {
          last_processed_id: lastId,
          pending_count: totalRounds,
          last_check: yesterday.toISOString().split('T')[0],
        },
      };
    }

    const allMessages = this.character.memoryManager!.getMessagesSinceId(1, lastProcessedId);
    if (allMessages.length === 0) {
      return {};
    }

    const memoryResult = await this.processConversations(allMessages, yesterday);
    if (memoryResult) {
      await this.saveMemory(this.character.workspacePath, yesterday, memoryResult);
      const lastId = allMessages[allMessages.length - 1].id;
      console.info(`[DreamTask:${charName}] Memory processed for ${yesterday.toISOString().split('T')[0]}`);
      return {
        [stateKey]: {
          last_processed_id: lastId,
          pending_count: 0,
          last_check: yesterday.toISOString().split('T')[0],
        },
      };
    }

    return {};
  }

  private async processConversations(messages: any[], targetDate: Date): Promise<any> {
    const conversationsText = this.formatConversations(messages);
    const existingMemories = this.loadExistingMemories();

    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      const promptWithContext = this.dreamPrompt!
        .replace('{conversations}', conversationsText)
        .replace('{existing_memories}', existingMemories);

      const response = await this.client.chat.completions.create({
        model: this.character.apiModel,
        messages: [
          {
            role: 'system',
            content: promptWithContext,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0].message.content?.trim() || '';
      return this.parseResponse(content);
    } catch (error) {
      console.error('[DreamTask] Error processing conversations:', error);
      return null;
    }
  }

  private loadExistingMemories(): string {
    try {
      const memoriesPath = path.join(this.character.workspacePath, 'memory', 'memories.md');
      if (fs.existsSync(memoriesPath)) {
        const content = fs.readFileSync(memoriesPath, 'utf-8');
        // Extract just the bullet points
        const facts = content
          .split('\n')
          .filter((line) => line.startsWith('- '))
          .map((line) => line.substring(2))
          .filter((fact) => fact && !['（空）', '（无重要信息需要记忆）', '（无重要信息需记忆）'].includes(fact));
        
        if (facts.length === 0) {
          return '（暂无长期记忆）';
        }
        
        return facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
      }
    } catch (error) {
      console.warn('[DreamTask] Failed to load existing memories');
    }
    return '（暂无长期记忆）';
  }

  private parseResponse(content: string): any {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        // Continue to try parsing raw JSON
      }
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      console.warn('[DreamTask] Failed to parse JSON response');
      return {
        diary: content,
        summary: '',
        relationship: { changes: [], new_patterns: [] },
        state: { mood: '', interests: [], preferences: [] },
      };
    }
  }

  private formatConversations(messages: any[]): string {
    // Try to get user name from relationship/user.md
    const userName = this.getUserName();
    
    return messages
      .map((msg) => {
        const role = msg.role === 'user' ? userName : '我';
        const time = new Date(msg.created_at).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `[${time}] ${role}: ${msg.content}`;
      })
      .join('\n');
  }

  private getUserName(): string {
    try {
      const userPath = path.join(this.character.workspacePath, 'relationship', 'user.md');
      if (fs.existsSync(userPath)) {
        const content = fs.readFileSync(userPath, 'utf-8');
        // Try to extract name from "名字：xxx" or "姓名：xxx" pattern
        const nameMatch = content.match(/(?:名字|姓名)[:：]\s*(.+)/);
        if (nameMatch) {
          return nameMatch[1].trim();
        }
      }
    } catch (error) {
      console.warn('[DreamTask] Failed to read user name, using default');
    }
    // Fallback to generic term
    return '对方';
  }

  private async saveMemory(workspacePath: string, targetDate: Date, memoryResult: any): Promise<void> {
    const memoryDir = path.join(workspacePath, 'memory');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    this.saveDiary(memoryDir, targetDate, memoryResult.diary || '');
    this.updateRecall(memoryDir, targetDate, memoryResult.summary || '');
    this.updateMemories(memoryDir, memoryResult.important_facts || []);
    this.updateRelationship(memoryDir, memoryResult.relationship || {});
    this.updateState(memoryDir, targetDate, memoryResult.state || {});
  }

  private saveDiary(memoryDir: string, targetDate: Date, diaryContent: string): void {
    if (!diaryContent) return;

    const diaryPath = path.join(memoryDir, 'diary.md');
    const dateStr = targetDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const entry = `## ${dateStr}\n\n${diaryContent}\n\n`;

    // Append to diary file
    if (fs.existsSync(diaryPath)) {
      fs.appendFileSync(diaryPath, entry, 'utf-8');
    } else {
      // Create new file with header
      const header = '# 日记\n\n';
      fs.writeFileSync(diaryPath, header + entry, 'utf-8');
    }
    
    console.info(`[DreamTask] Diary entry added to ${diaryPath}`);
  }

  private updateRecall(memoryDir: string, targetDate: Date, summary: string): void {
    const recallPath = path.join(memoryDir, 'recall.md');

    let summaries: string[] = [];
    if (fs.existsSync(recallPath)) {
      const content = fs.readFileSync(recallPath, 'utf-8');
      summaries = content
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.substring(2));
    }

    if (summary) {
      const dateStr = targetDate.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      const newEntry = `${dateStr} ${summary}`;
      summaries = [newEntry, ...summaries.filter((s) => !s.startsWith(dateStr))];
    }

    summaries = summaries.slice(0, 5);

    let recallContent = '# 近期记忆\n\n最近发生的事情：\n\n';
    for (const s of summaries) {
      recallContent += `- ${s}\n`;
    }

    fs.writeFileSync(recallPath, recallContent, 'utf-8');
    console.info(`[DreamTask] Recall updated with ${summaries.length} entries`);
  }

  private updateMemories(memoryDir: string, importantFacts: string[]): void {
    if (importantFacts.length === 0) return;

    const memoriesPath = path.join(memoryDir, 'memories.md');

    let existingFacts: string[] = [];
    if (fs.existsSync(memoriesPath)) {
      const content = fs.readFileSync(memoriesPath, 'utf-8');
      existingFacts = content
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.substring(2))
        .filter((fact) => fact && !['（空）', '（无重要信息需要记忆）', '（无重要信息需记忆）'].includes(fact));
    }

    for (const fact of importantFacts) {
      if (fact && !existingFacts.includes(fact)) {
        existingFacts.push(fact);
      }
    }

    existingFacts = existingFacts.slice(-50);

    let content = '# 长期记忆\n\n从对话中提取的重要信息：\n\n';
    for (const fact of existingFacts) {
      content += `- ${fact}\n`;
    }

    fs.writeFileSync(memoriesPath, content, 'utf-8');
    console.info(`[DreamTask] Updated memories.md with ${existingFacts.length} facts`);
  }

  private updateRelationship(memoryDir: string, relationship: any): void {
    if (!relationship) return;

    const changes = relationship.changes || [];
    const newPatterns = relationship.new_patterns || [];

    if (changes.length === 0 && newPatterns.length === 0) return;

    const relationshipPath = path.join(memoryDir, 'relationship.md');

    let existingContent = '';
    if (fs.existsSync(relationshipPath)) {
      existingContent = fs.readFileSync(relationshipPath, 'utf-8');
    }

    const today = new Date().toISOString().split('T')[0];

    let newSection = '';
    if (changes.length > 0) {
      newSection += `### ${today} 关系变化\n`;
      for (const change of changes) {
        newSection += `- ${change}\n`;
      }
      newSection += '\n';
    }

    if (newPatterns.length > 0) {
      newSection += `### ${today} 新的互动模式\n`;
      for (const pattern of newPatterns) {
        newSection += `- ${pattern}\n`;
      }
      newSection += '\n';
    }

    let updatedContent: string;
    if (existingContent) {
      const lines = existingContent.split('\n');
      let insertPos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ') && lines[i].includes('关系变化')) {
          insertPos = i;
          break;
        } else if (lines[i].startsWith('## ')) {
          insertPos = i + 1;
        }
      }
      lines.splice(insertPos, 0, newSection.trim());
      updatedContent = lines.join('\n');
    } else {
      updatedContent = '# 关系图式\n\n记录我们之间关系的发展变化。\n\n' + newSection;
    }

    fs.writeFileSync(relationshipPath, updatedContent, 'utf-8');
    console.info('[DreamTask] Relationship updated');
  }

  private updateState(memoryDir: string, targetDate: Date, state: any): void {
    const statePath = path.join(memoryDir, 'state.md');

    const mood = state.mood || '';
    const interests = state.interests || [];
    const preferences = state.preferences || [];

    if (!mood && interests.length === 0 && preferences.length === 0) return;

    let existingState: {
      mood: string;
      interests: string[];
      preferences: string[];
      lastUpdated: string;
    } = {
      mood: '',
      interests: [],
      preferences: [],
      lastUpdated: '',
    };

    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf-8');
      const moodMatch = content.match(/\*\*当前心情\*\*：(.+)/);
      if (moodMatch) {
        existingState.mood = moodMatch[1].trim();
      }
      const interestSection = content.match(/\*\*近期兴趣\*\*：\n([\s\S]*?)(?=\*\*|$)/);
      if (interestSection) {
        existingState.interests = (interestSection[1].match(/- (.+)/g) || []).map((m) => m.substring(2));
      }
      const prefSection = content.match(/\*\*偏好变化\*\*：\n([\s\S]*?)(?=\*\*|$)/);
      if (prefSection) {
        existingState.preferences = (prefSection[1].match(/- (.+)/g) || []).map((m) => m.substring(2));
      }
    }

    if (mood) {
      existingState.mood = mood;
    }
    if (interests.length > 0) {
      existingState.interests = [...interests, ...existingState.interests.filter((i) => !interests.includes(i))];
      existingState.interests = existingState.interests.slice(0, 5);
    }
    if (preferences.length > 0) {
      existingState.preferences = [...preferences, ...existingState.preferences.filter((p) => !preferences.includes(p))];
      existingState.preferences = existingState.preferences.slice(0, 5);
    }

    existingState.lastUpdated = targetDate.toISOString().split('T')[0];

    let stateContent = '# 当前状态\n\n';
    stateContent += `**当前心情**：${existingState.mood}\n\n`;
    stateContent += '**近期兴趣**：\n';
    for (const interest of existingState.interests) {
      stateContent += `- ${interest}\n`;
    }
    stateContent += '\n**偏好变化**：\n';
    for (const pref of existingState.preferences) {
      stateContent += `- ${pref}\n`;
    }
    stateContent += `\n*最后更新：${existingState.lastUpdated}*\n`;

    fs.writeFileSync(statePath, stateContent, 'utf-8');
    console.info('[DreamTask] State updated');
  }
}

export class WeeklyReviewTask {
  private character: Character;
  private client?: OpenAI;

  constructor(character: Character) {
    this.character = character;
  }

  async initialize(): Promise<void> {
    this.client = new OpenAI({
      apiKey: this.character.apiKey,
      baseURL: this.character.apiBase,
    });
  }

  async call(state: Record<string, any>): Promise<Record<string, any>> {
    const charName = this.character.name;
    const stateKey = `weekly_review_${charName}`;
    const taskState = state[stateKey] || {};

    if (!this.client) {
      await this.initialize();
    }

    const memoryDir = path.join(this.character.workspacePath, 'memory');
    const lastReview = taskState.last_review ? new Date(taskState.last_review) : null;
    const today = new Date();

    if (lastReview) {
      const daysSinceReview = Math.floor((today.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceReview < 7) {
        console.info(`[WeeklyReview:${charName}] Not time for review yet`);
        return {};
      }
    }

    const reviewData = this.collectReviewData(memoryDir);
    const reviewReport = await this.generateReviewReport(reviewData);

    if (reviewReport) {
      this.saveReviewReport(memoryDir, reviewReport);
      console.info(`[WeeklyReview:${charName}] Weekly review completed`);
      return {
        [stateKey]: {
          last_review: today.toISOString().split('T')[0],
        },
      };
    }

    return {};
  }

  private collectReviewData(memoryDir: string): any {
    const data = {
      recall: '',
      state: '',
      relationship: '',
      persona_summary: '',
    };

    const recallPath = path.join(memoryDir, 'recall.md');
    if (fs.existsSync(recallPath)) {
      data.recall = fs.readFileSync(recallPath, 'utf-8');
    }

    const statePath = path.join(memoryDir, 'state.md');
    if (fs.existsSync(statePath)) {
      data.state = fs.readFileSync(statePath, 'utf-8');
    }

    const relationshipPath = path.join(memoryDir, 'relationship.md');
    if (fs.existsSync(relationshipPath)) {
      data.relationship = fs.readFileSync(relationshipPath, 'utf-8');
    }

    const personaDir = path.join(this.character.workspacePath, 'persona');
    if (fs.existsSync(personaDir)) {
      const personaSections: string[] = [];
      const files = fs.readdirSync(personaDir).filter((f) => f.endsWith('.md') && f !== 'basic.md');
      for (const file of files) {
        const content = fs.readFileSync(path.join(personaDir, file), 'utf-8');
        personaSections.push(`### ${file.replace('.md', '')}\n${content}`);
      }
      data.persona_summary = personaSections.join('\n\n');
    }

    return data;
  }

  private async generateReviewReport(data: any): Promise<string | null> {
    const prompt = `你是一个角色审视助手。请分析过去一周的角色记忆数据，判断是否需要更新角色的底层设定。

## 近期记忆
${data.recall}

## 当前状态
${data.state}

## 关系图式
${data.relationship}

## 现有人设
${data.persona_summary}

请分析以上数据，回答以下问题：

1. **性格演变**：过去一周是否有明显的性格变化？是否需要更新 personality.md？
2. **兴趣变化**：是否有新的兴趣或放弃的旧兴趣？是否需要更新 interests.md？
3. **关系进展**：与用户的关系是否有重要进展？是否需要更新 relationship/user.md？
4. **说话风格**：说话风格是否有变化？
5. **建议修改**：具体建议修改哪些文件的哪些内容？

请用简洁的格式输出审视报告，包括：
- 发现的变化
- 建议的修改（如果有）
- 不需要修改的部分`;

    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      const response = await this.client.chat.completions.create({
        model: this.character.apiModel,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.5,
        max_tokens: 1000,
      });

      return response.choices[0].message.content?.trim() || null;
    } catch (error) {
      console.error('[WeeklyReview] Error generating report:', error);
      return null;
    }
  }

  private saveReviewReport(memoryDir: string, report: string): void {
    const reportPath = path.join(memoryDir, 'weekly_review.md');
    const today = new Date().toISOString().split('T')[0];
    const content = `# 周审视报告 - ${today}\n\n${report}\n`;

    fs.writeFileSync(reportPath, content, 'utf-8');
    console.info(`[WeeklyReview] Report saved to ${reportPath}`);
  }
}

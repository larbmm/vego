import { Character } from '../src/character/character.js';
import { config, getVegoHome } from '../src/config/config.js';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';

async function regenerateDiary(characterName: string, targetDate: string) {
  console.log(`Regenerating diary for ${characterName} on ${targetDate}...`);

  // Find character config
  const charConfig = config.character[characterName];
  if (!charConfig) {
    console.error(`Character ${characterName} not found in config`);
    console.error(`Available characters: ${Object.keys(config.character).join(', ')}`);
    process.exit(1);
  }

  // Initialize character
  const workspacePath = path.join(getVegoHome(), `workspace_${characterName}`);
  const character = new Character(
    charConfig.name,
    charConfig.display_name,
    workspacePath,
    charConfig.api_key || config.api.key,
    charConfig.api_base || config.api.base,
    charConfig.api_model || config.api.model,
    charConfig.api_timeout
  );

  // Load messages from target date
  const messages = character.memoryManager!.db
    .prepare(`SELECT * FROM messages WHERE DATE(created_at) = ? ORDER BY id ASC`)
    .all(targetDate);

  if (messages.length === 0) {
    console.error(`No messages found for date ${targetDate}`);
    process.exit(1);
  }

  console.log(`Found ${messages.length} messages for ${targetDate}`);

  // Load dream prompt
  const dreamPromptPath = path.join(workspacePath, 'memory', 'dream_prompt.md');
  if (!fs.existsSync(dreamPromptPath)) {
    console.error(`Dream prompt not found at ${dreamPromptPath}`);
    process.exit(1);
  }

  const dreamPrompt = fs.readFileSync(dreamPromptPath, 'utf-8');

  // Format conversations
  const userName = getUserName(workspacePath);
  const conversationsText = messages
    .map((msg: any) => {
      const role = msg.role === 'user' ? userName : '我';
      const time = new Date(msg.created_at).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `[${time}] ${role}: ${msg.content}`;
    })
    .join('\n');

  // Load existing memories
  const existingMemories = loadExistingMemories(workspacePath);

  // Build prompt
  const promptWithContext = dreamPrompt
    .replace('{conversations}', conversationsText)
    .replace('{existing_memories}', existingMemories);

  // Call API
  console.log('Calling API to generate diary...');
  const client = new OpenAI({
    apiKey: charConfig.api_key || config.api.key,
    baseURL: charConfig.api_base || config.api.base,
  });

  const response = await client.chat.completions.create({
    model: charConfig.api_model || config.api.model,
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
  
  // Parse response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  let memoryResult: any;
  
  if (jsonMatch) {
    try {
      memoryResult = JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error('Failed to parse JSON response');
      console.log('Raw response:', content);
      process.exit(1);
    }
  } else {
    try {
      memoryResult = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse response as JSON');
      console.log('Raw response:', content);
      process.exit(1);
    }
  }

  // Save diary
  if (memoryResult.diary) {
    const diaryPath = path.join(workspacePath, 'memory', 'diary.md');
    const dateStr = new Date(targetDate).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const entry = `## ${dateStr}\n\n${memoryResult.diary}\n\n`;

    // Check if entry already exists
    let diaryContent = '';
    if (fs.existsSync(diaryPath)) {
      diaryContent = fs.readFileSync(diaryPath, 'utf-8');
      
      // Remove old entry for this date if exists
      const datePattern = new RegExp(`## ${dateStr.replace(/\//g, '\\/')}[\\s\\S]*?(?=## \\d{4}\\/\\d{2}\\/\\d{2}|$)`, 'g');
      diaryContent = diaryContent.replace(datePattern, '');
    } else {
      diaryContent = '# 日记\n\n';
    }

    // Append new entry
    diaryContent += entry;
    fs.writeFileSync(diaryPath, diaryContent, 'utf-8');
    
    console.log(`\n✓ Diary entry saved to ${diaryPath}`);
    console.log(`\nDiary content (${memoryResult.diary.length} characters):`);
    console.log('---');
    console.log(memoryResult.diary);
    console.log('---');
  } else {
    console.error('No diary content in response');
  }

  console.log('\nFull result:');
  console.log(JSON.stringify(memoryResult, null, 2));
}

function getUserName(workspacePath: string): string {
  try {
    const userPath = path.join(workspacePath, 'relationship', 'user.md');
    if (fs.existsSync(userPath)) {
      const content = fs.readFileSync(userPath, 'utf-8');
      const nameMatch = content.match(/(?:名字|姓名)[:：]\s*(.+)/);
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
  } catch (error) {
    console.warn('Failed to read user name, using default');
  }
  return '对方';
}

function loadExistingMemories(workspacePath: string): string {
  try {
    const memoriesPath = path.join(workspacePath, 'memory', 'memories.md');
    if (fs.existsSync(memoriesPath)) {
      const content = fs.readFileSync(memoriesPath, 'utf-8');
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
    console.warn('Failed to load existing memories');
  }
  return '（暂无长期记忆）';
}

// Get parameters from command line
const characterName = process.argv[2];
const targetDate = process.argv[3] || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

if (!characterName) {
  console.error('Usage: npm run regenerate-diary <character_name> [date]');
  console.error('Example: npm run regenerate-diary xiyue 2026-04-22');
  console.error('If date is not provided, uses yesterday');
  process.exit(1);
}

regenerateDiary(characterName, targetDate).catch(error => {
  console.error('Error regenerating diary:', error);
  process.exit(1);
});

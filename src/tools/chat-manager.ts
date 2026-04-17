#!/usr/bin/env node
/**
 * Simple CLI tool for managing chat messages
 */

import * as fs from 'fs';
import * as path from 'path';
import { config, getWorkspacePath } from '../config/config.js';

interface Message {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

function getMessagesFile(characterName: string): string {
  const workspacePath = getWorkspacePath(config.character[characterName]);
  return path.join(workspacePath, 'messages.jsonl');
}

function loadMessages(characterName: string): Message[] {
  const file = getMessagesFile(characterName);
  if (!fs.existsSync(file)) {
    return [];
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function saveMessages(characterName: string, messages: Message[]): void {
  const file = getMessagesFile(characterName);
  const content = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
  fs.writeFileSync(file, content);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // List characters
  const characters = Object.keys(config.character);
  
  if (!command || command === 'help') {
    console.log('Usage: npm run chat <command> [character] [args]');
    console.log('\nCommands:');
    console.log('  view [character] [limit]  - View recent messages (default: 10)');
    console.log('  delete [character] <n>    - Delete last N messages');
    console.log('  clear [character]         - Clear all messages');
    console.log('  search [character] <text> - Search messages by content');
    console.log('\nCharacters:', characters.join(', '));
    return;
  }
  
  const characterName = args[1] || characters[0];
  
  if (!config.character[characterName]) {
    console.error(`Character '${characterName}' not found`);
    console.log('Available:', characters.join(', '));
    return;
  }
  
  const messages = loadMessages(characterName);
  
  switch (command) {
    case 'view': {
      const limit = parseInt(args[2]) || 10;
      const recent = messages.slice(-limit);
      console.log(`\n=== Last ${recent.length} messages for ${characterName} ===\n`);
      recent.forEach(m => {
        const time = new Date(m.created_at).toLocaleString('zh-CN');
        console.log(`[${m.id}] ${m.role} (${time})`);
        console.log(`  ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}\n`);
      });
      break;
    }
    
    case 'delete': {
      const n = parseInt(args[2]);
      if (!n || n < 1) {
        console.error('Please specify number of messages to delete');
        return;
      }
      
      if (n > messages.length) {
        console.error(`Only ${messages.length} messages available`);
        return;
      }
      
      const toDelete = messages.slice(-n);
      console.log(`\nWill delete these ${n} messages:`);
      toDelete.forEach(m => {
        console.log(`  [${m.id}] ${m.role}: ${m.content.substring(0, 50)}...`);
      });
      
      // Simple confirmation (in real use, you might want readline)
      const newMessages = messages.slice(0, -n);
      saveMessages(characterName, newMessages);
      console.log(`\n✓ Deleted ${n} messages`);
      break;
    }
    
    case 'clear': {
      console.log(`\nClearing all ${messages.length} messages for ${characterName}`);
      saveMessages(characterName, []);
      console.log('✓ All messages cleared');
      break;
    }
    
    case 'search': {
      const query = args.slice(2).join(' ');
      if (!query) {
        console.error('Please specify search text');
        return;
      }
      
      const results = messages.filter(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log(`\n=== Found ${results.length} messages containing "${query}" ===\n`);
      results.forEach(m => {
        const time = new Date(m.created_at).toLocaleString('zh-CN');
        console.log(`[${m.id}] ${m.role} (${time})`);
        console.log(`  ${m.content}\n`);
      });
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "npm run chat help" for usage');
  }
}

main().catch(console.error);

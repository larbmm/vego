import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { config, getWorkspacePath, getDatabasePath } from '../config/config.js';
import { DatabaseManager } from '../memory/database.js';

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'src/web/public')));

interface Message {
  id: number;
  user_id: number;
  role: string;
  content: string;
  platform: string;
  message_id: string;
  created_at: string;
}

// Get database for character
function getDatabase(characterName: string): DatabaseManager {
  const charConfig = config.character[characterName];
  if (!charConfig) {
    throw new Error('Character not found');
  }
  const dbPath = getDatabasePath(charConfig);
  return new DatabaseManager(dbPath);
}

// API: Get all characters
app.get('/api/characters', (req, res) => {
  const characters = Object.keys(config.character).map(name => ({
    name,
    path: config.character[name].path,
  }));
  res.json(characters);
});

// API: Get messages for a character
app.get('/api/messages/:character', (req, res) => {
  const { character } = req.params;
  const { limit = '50', offset = '0' } = req.query;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  try {
    const db = getDatabase(character);
    const result = db.getAllMessages(1, parseInt(limit as string), parseInt(offset as string));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete a message
app.delete('/api/messages/:character/:id', (req, res) => {
  const { character, id } = req.params;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  try {
    const db = getDatabase(character);
    const success = db.deleteMessage(parseInt(id));
    
    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update a message
app.put('/api/messages/:character/:id', (req, res) => {
  const { character, id } = req.params;
  const { content } = req.body;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  try {
    const db = getDatabase(character);
    const success = db.updateMessage(parseInt(id), content);
    
    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Clear all messages
app.delete('/api/messages/:character', (req, res) => {
  const { character } = req.params;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  try {
    const db = getDatabase(character);
    const count = db.clearAllMessages(1);
    res.json({ success: true, deleted: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get persona files
app.get('/api/persona/:character', (req, res) => {
  const { character } = req.params;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  const workspacePath = getWorkspacePath(config.character[character]);
  const personaDir = path.join(workspacePath, 'persona');
  
  if (!fs.existsSync(personaDir)) {
    return res.json({ files: [] });
  }
  
  const files = fs.readdirSync(personaDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      content: fs.readFileSync(path.join(personaDir, f), 'utf-8'),
    }));
  
  res.json({ files });
});

// API: Update persona file
app.put('/api/persona/:character/:file', (req, res) => {
  const { character, file } = req.params;
  const { content } = req.body;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  const workspacePath = getWorkspacePath(config.character[character]);
  const filePath = path.join(workspacePath, 'persona', file);
  
  fs.writeFileSync(filePath, content, 'utf-8');
  res.json({ success: true });
});

// API: Create new character
app.post('/api/characters', (req, res) => {
  const { name } = req.body;
  
  if (!name || !/^[a-z_]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid character name (use lowercase letters and underscores only)' });
  }
  
  if (config.character[name]) {
    return res.status(400).json({ error: 'Character already exists' });
  }
  
  // Create workspace directory
  const workspacePath = path.join(process.cwd(), '.vego', `workspace_${name}`);
  
  if (fs.existsSync(workspacePath)) {
    return res.status(400).json({ error: 'Workspace directory already exists' });
  }
  
  // Create directory structure
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'persona'), { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'relationship'), { recursive: true });
  
  // Create default persona files
  const defaultPersona = {
    'basic.md': `# 基本信息\n\n- 名字：${name}\n- 性别：\n- 年龄：\n`,
    'personality.md': `# 性格特点\n\n`,
    'background.md': `# 背景故事\n\n`,
    'speaking.md': `# 说话风格\n\n`,
    'rules.md': `# 行为规则\n\n`,
  };
  
  for (const [filename, content] of Object.entries(defaultPersona)) {
    fs.writeFileSync(path.join(workspacePath, 'persona', filename), content, 'utf-8');
  }
  
  // Create index.md
  fs.writeFileSync(
    path.join(workspacePath, 'index.md'),
    `# ${name}\n\n角色工作区`,
    'utf-8'
  );
  
  // Create empty SQLite database
  const dbPath = path.join(workspacePath, 'memory.db');
  const db = new DatabaseManager(dbPath);
  db.close();
  
  res.json({ success: true, name, path: `workspace_${name}` });
});

// API: Delete character
app.delete('/api/characters/:character', (req, res) => {
  const { character } = req.params;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  const workspacePath = getWorkspacePath(config.character[character]);
  
  // Delete workspace directory
  if (fs.existsSync(workspacePath)) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
  
  res.json({ success: true });
});

// API: Send message to character (for web chat)
app.post('/api/chat/:character', async (req, res) => {
  const { character } = req.params;
  const { message } = req.body;
  
  if (!config.character[character]) {
    return res.status(404).json({ error: 'Character not found' });
  }
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    // Import app instance
    const { getAppInstance } = await import('../index.js');
    const appInstance = getAppInstance();
    
    if (!appInstance) {
      return res.status(500).json({ error: 'App not initialized' });
    }
    
    const char = appInstance.getCharacter(character);
    
    if (!char) {
      return res.status(500).json({ error: 'Character not found in app' });
    }
    
    // Create unified message
    const unifiedMessage: any = {
      platform: 'web',
      user_id: 'web_admin',
      platform_message_id: `web_${Date.now()}`,
      content: message.trim(),
      timestamp: new Date(),
    };
    
    // Get response from character
    const response = await char.handleMessage(unifiedMessage);
    
    res.json({ success: true, response });
  } catch (error: any) {
    console.error('[Web] Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

export function startWebServer(port: number = 3000): void {
  app.listen(port, () => {
    console.log(`[Web] Management interface available at http://localhost:${port}`);
  });
}

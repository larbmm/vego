import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceLoader } from '../ai/workspace-loader.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceLoader', () => {
  let testDir: string;
  let loader: WorkspaceLoader;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `vego-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    loader = new WorkspaceLoader(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load persona from index.md', () => {
    const indexContent = '# Test Persona\n\nThis is a test persona.';
    fs.writeFileSync(path.join(testDir, 'index.md'), indexContent, 'utf-8');

    const persona = loader.loadPersona();
    expect(persona).toBe(indexContent);
  });

  it('should expand file references', () => {
    const basicContent = 'Name: Test\nAge: 25';
    fs.mkdirSync(path.join(testDir, 'persona'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'persona', 'basic.md'), basicContent, 'utf-8');

    const indexContent = '# Persona\n\n[[file:persona/basic.md]]';
    fs.writeFileSync(path.join(testDir, 'index.md'), indexContent, 'utf-8');

    const persona = loader.loadPersona();
    expect(persona).toContain(basicContent);
  });

  it('should save file correctly', () => {
    const content = 'Test content';
    loader.saveFile('test.md', content);

    const savedContent = fs.readFileSync(path.join(testDir, 'test.md'), 'utf-8');
    expect(savedContent).toBe(content);
  });

  it('should create directories when saving file', () => {
    const content = 'Test content';
    loader.saveFile('memory/test.md', content);

    expect(fs.existsSync(path.join(testDir, 'memory', 'test.md'))).toBe(true);
  });

  it('should return empty string for non-existent file', () => {
    const content = loader.loadFile('non-existent.md');
    expect(content).toBe('');
  });
});

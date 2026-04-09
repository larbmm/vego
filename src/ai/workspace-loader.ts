import * as fs from 'fs';
import * as path from 'path';

export class WorkspaceLoader {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  loadPersona(): string {
    const indexPath = path.join(this.workspacePath, 'index.md');

    if (!fs.existsSync(indexPath)) {
      return '';
    }

    let content = fs.readFileSync(indexPath, 'utf-8');

    // Expand references to other files
    const fileRefRegex = /\[\[file:([^\]]+)\]\]/g;
    content = content.replace(fileRefRegex, (match, filePath) => {
      const fullPath = path.join(this.workspacePath, filePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
      return match;
    });

    return content;
  }

  loadFile(filePath: string): string {
    const fullPath = path.join(this.workspacePath, filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf-8');
    }
    return '';
  }

  saveFile(filePath: string, content: string): void {
    const fullPath = path.join(this.workspacePath, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }
}

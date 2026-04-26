import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 预设注入位置
 */
export enum PresetPosition {
  BEFORE_SYSTEM = 'before_system',  // 在 system prompt 之前
  AFTER_SYSTEM = 'after_system',    // 在 system prompt 之后
  BEFORE_HISTORY = 'before_history', // 在对话历史之前
  AFTER_HISTORY = 'after_history',   // 在对话历史之后（最底部）
  IN_CHAT = 'in_chat',               // 在对话历史中（根据 depth 插入）
}

/**
 * 预设项配置
 */
export interface PresetItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
  position: PresetPosition;
  enabled: boolean;
  order?: number;  // 同一位置的排序优先级
  depth?: number;  // 当 position 为 IN_CHAT 时,表示从底部往上数第几条消息
}

/**
 * 预设加载选项（已废弃，保留接口兼容）
 */
export interface PresetLoaderOptions {
  // 不再需要任何选项
}

/**
 * 预设文件结构（兼容 SillyTavern 格式）
 */
export interface PresetFile {
  name?: string;
  description?: string;
  prompts?: Array<{
    name?: string;
    role?: string;
    content?: string;
    identifier?: string;
    enabled?: boolean;
    injection_position?: number;
    injection_depth?: number;
    injection_order?: number;
    system_prompt?: boolean;
  }>;
}

/**
 * 预设加载器
 */
export class PresetLoader {
  private presetPath: string;
  private presets: PresetItem[] = [];

  constructor(presetPath?: string) {
    // 优先加载内置预设
    const builtInPresetPath = this.getBuiltInPresetPath();
    if (builtInPresetPath) {
      console.log(`[PresetLoader] Loading built-in preset from: ${builtInPresetPath}`);
      this.presetPath = builtInPresetPath;
      this.loadPreset();
      return;
    }
    
    console.warn(`[PresetLoader] Built-in preset not found`);
    this.presetPath = '';
    this.presets = [];
  }
  
  /**
   * 获取内置预设路径
   */
  private getBuiltInPresetPath(): string {
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(process.cwd(), '.vego', 'vego-preset.json'),
      path.join(__dirname, '..', '..', '.vego', 'vego-preset.json'),
      path.join(process.env.VEGO_HOME || '', '.vego', 'vego-preset.json'),
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    
    return '';
  }

  /**
   * 加载预设文件
   */
  private loadPreset(): void {
    try {
      const content = fs.readFileSync(this.presetPath, 'utf-8');
      const presetData: PresetFile = JSON.parse(content);

      if (!presetData.prompts || !Array.isArray(presetData.prompts)) {
        console.warn('[PresetLoader] No prompts found in preset file');
        return;
      }

      // 加载所有启用的预设项
      let prompts = presetData.prompts
        .filter(p => p.content && p.enabled !== false);

      // 应用预设过滤
      prompts = this.applyPresetFilter(prompts);

      this.presets = prompts
        .map(p => this.convertToPresetItem(p))
        .sort((a, b) => (a.order || 0) - (b.order || 0)); // 按 order 排序

      console.log(`[PresetLoader] Loaded ${this.presets.length} preset items from ${this.presetPath}`);
      
      // 输出预设统计信息
      this.logPresetStatistics();
    } catch (error) {
      console.error('[PresetLoader] Failed to load preset:', error);
      this.presets = [];
    }
  }

  /**
   * 应用预设过滤规则
   */
  private applyPresetFilter(prompts: any[]): any[] {
    // 动态导入 config 以避免循环依赖
    let filterMode: string = 'all';
    let whitelist: string[] = [];
    let blacklist: string[] = [];
    
    try {
      const { config } = require('../config/config.js');
      filterMode = config.preset?.filter_mode || 'all';
      whitelist = config.preset?.whitelist || [];
      blacklist = config.preset?.blacklist || [];
    } catch (error) {
      console.warn('[PresetLoader] Failed to load preset config, using default (all)');
    }

    console.log(`[PresetLoader] Filter mode: ${filterMode}`);

    if (filterMode === 'whitelist' && whitelist.length > 0) {
      const filtered = prompts.filter(p => whitelist.includes(p.identifier));
      console.log(`[PresetLoader] Whitelist filter: ${prompts.length} → ${filtered.length} presets`);
      return filtered;
    }

    if (filterMode === 'blacklist' && blacklist.length > 0) {
      const filtered = prompts.filter(p => !blacklist.includes(p.identifier));
      console.log(`[PresetLoader] Blacklist filter: ${prompts.length} → ${filtered.length} presets`);
      return filtered;
    }

    // 默认 'all' 模式: 加载所有启用的预设
    console.log(`[PresetLoader] Loading all ${prompts.length} enabled presets`);
    return prompts;
  }

  /**
   * 输出预设统计信息
   */
  private logPresetStatistics(): void {
    const stats = {
      total: this.presets.length,
      byPosition: new Map<PresetPosition, number>(),
      byRole: new Map<string, number>(),
      assistant: 0,
    };
    
    for (const preset of this.presets) {
      // 按位置统计
      const count = stats.byPosition.get(preset.position) || 0;
      stats.byPosition.set(preset.position, count + 1);
      
      // 按角色统计
      const roleCount = stats.byRole.get(preset.role) || 0;
      stats.byRole.set(preset.role, roleCount + 1);
      
      // 统计 assistant 预设
      if (preset.role === 'assistant') {
        stats.assistant++;
      }
    }
    
    console.log('[PresetLoader] Preset breakdown:');
    console.log(`  - BEFORE_SYSTEM: ${stats.byPosition.get(PresetPosition.BEFORE_SYSTEM) || 0} preset(s)`);
    console.log(`  - AFTER_SYSTEM: ${stats.byPosition.get(PresetPosition.AFTER_SYSTEM) || 0} preset(s)`);
    console.log(`  - BEFORE_HISTORY: ${stats.byPosition.get(PresetPosition.BEFORE_HISTORY) || 0} preset(s)`);
    console.log(`  - IN_CHAT: ${stats.byPosition.get(PresetPosition.IN_CHAT) || 0} preset(s)`);
    console.log(`  - AFTER_HISTORY: ${stats.byPosition.get(PresetPosition.AFTER_HISTORY) || 0} preset(s)`);
    console.log('[PresetLoader] Role breakdown:');
    console.log(`  - system: ${stats.byRole.get('system') || 0} preset(s)`);
    console.log(`  - user: ${stats.byRole.get('user') || 0} preset(s)`);
    console.log(`  - assistant: ${stats.byRole.get('assistant') || 0} preset(s)`);
  }

  /**
   * 转换 SillyTavern 格式到内部格式
   */
  private convertToPresetItem(prompt: any): PresetItem {
    // 根据 identifier 或 injection_position 判断位置
    let position = PresetPosition.AFTER_SYSTEM;
    let depth: number | undefined = undefined;

    console.log(`[PresetLoader] Converting preset: name="${prompt.name}", identifier=${prompt.identifier}, role=${prompt.role}, injection_position=${prompt.injection_position}, injection_depth=${prompt.injection_depth}`);

    // SillyTavern 的 injection_position 和 injection_depth:
    // - injection_position: 0 表示相对于对话历史 (IN_CHAT)
    // - injection_position: 1 表示对话历史之后 (AFTER_HISTORY)
    // - injection_position: null/undefined 表示在 system 之前 (BEFORE_SYSTEM)
    // - injection_depth: 从底部往上数第几条消息（4 表示倒数第 4 条）
    if (prompt.injection_position === 0 && prompt.injection_depth) {
      // 插入到对话历史中
      position = PresetPosition.IN_CHAT;
      depth = prompt.injection_depth;
      console.log(`[PresetLoader] ✓ Set position to IN_CHAT with depth=${depth}`);
    } else if (prompt.injection_position === 1 && prompt.injection_depth) {
      // 插入到对话历史之后
      position = PresetPosition.AFTER_HISTORY;
      depth = prompt.injection_depth;
      console.log(`[PresetLoader] ✓ Set position to AFTER_HISTORY with depth=${depth}`);
    } else if (prompt.identifier === 'main' || prompt.system_prompt === true) {
      // main prompt 在 system 之前
      position = PresetPosition.BEFORE_SYSTEM;
      console.log(`[PresetLoader] Set position to BEFORE_SYSTEM`);
    } else if (prompt.injection_position === null || prompt.injection_position === undefined) {
      // 没有指定 injection_position 的预设默认在 BEFORE_SYSTEM
      position = PresetPosition.BEFORE_SYSTEM;
      console.log(`[PresetLoader] Set position to BEFORE_SYSTEM (default for jailbreak)`);
    } else if (prompt.injection_depth && prompt.injection_depth > 2) {
      // 较深的注入在历史之后
      position = PresetPosition.AFTER_HISTORY;
      console.log(`[PresetLoader] Set position to AFTER_HISTORY`);
    } else {
      console.log(`[PresetLoader] Using default position: AFTER_SYSTEM`);
    }

    // 修复 JSON 转义问题：<a\bntml: 在 JSON 中 \b 会被解析为退格符（ASCII 8）
    // 实际存储为 <a[退格]ntml:，显示时退格符会删除 a，变成 <ntml:
    let content = prompt.content || '';
    
    // 检查是否包含退格符
    if (content.includes('\x08')) {
      // 替换 <a[退格]ntml: 为 <a\bntml:
      content = content.replace(/<a\x08ntml:/g, '<a\\bntml:');
      // 替换结束标签 </a[退格]ntml: 为 </a\bntml:
      content = content.replace(/<\/a\x08ntml:/g, '</a\\bntml:');
      console.log('[PresetLoader] Fixed JSON escape issue: restored <a\\bntml: tags');
    }

    return {
      role: (prompt.role as 'system' | 'user' | 'assistant') || 'system',
      content,
      position,
      enabled: prompt.enabled !== false,
      order: prompt.injection_order || 100,
      depth,
    };
  }

  /**
   * 获取指定位置的预设内容
   */
  getPresetsAtPosition(position: PresetPosition): PresetItem[] {
    return this.presets.filter(p => p.position === position && p.enabled);
  }

  /**
   * 获取需要插入到对话历史中的预设（IN_CHAT 位置）
   */
  getInChatPresets(): PresetItem[] {
    return this.presets.filter(p => p.position === PresetPosition.IN_CHAT && p.enabled);
  }

  /**
   * 获取 IN_CHAT 预设，按 depth 分组
   */
  getInChatPresetsByDepth(): Map<number, PresetItem[]> {
    const presets = this.getInChatPresets();
    const grouped = new Map<number, PresetItem[]>();
    
    for (const preset of presets) {
      if (preset.depth && preset.depth > 0) {
        if (!grouped.has(preset.depth)) {
          grouped.set(preset.depth, []);
        }
        grouped.get(preset.depth)!.push(preset);
      }
    }
    
    return grouped;
  }

  /**
   * 获取 AFTER_HISTORY 预设，按 depth 分组
   */
  getAfterHistoryPresetsByDepth(): Map<number, PresetItem[]> {
    const presets = this.presets.filter(p => p.position === PresetPosition.AFTER_HISTORY && p.enabled);
    const grouped = new Map<number, PresetItem[]>();
    
    for (const preset of presets) {
      if (preset.depth && preset.depth > 0) {
        if (!grouped.has(preset.depth)) {
          grouped.set(preset.depth, []);
        }
        grouped.get(preset.depth)!.push(preset);
      } else {
        // 没有 depth 的预设默认 depth=0 (最底部)
        if (!grouped.has(0)) {
          grouped.set(0, []);
        }
        grouped.get(0)!.push(preset);
      }
    }
    
    return grouped;
  }

  /**
   * 获取所有 assistant role 的预设
   */
  getAssistantPresets(): PresetItem[] {
    return this.presets.filter(p => p.role === 'assistant' && p.enabled);
  }

  /**
   * 检查是否有预设加载
   */
  hasPresets(): boolean {
    return this.presets.length > 0;
  }

  /**
   * 获取所有预设
   */
  getAllPresets(): PresetItem[] {
    return this.presets;
  }

  /**
   * 重新加载预设
   */
  reload(): void {
    this.presets = [];
    if (this.presetPath && fs.existsSync(this.presetPath)) {
      this.loadPreset();
    }
  }

  /**
   * 设置预设路径并加载
   */
  setPresetPath(presetPath: string): void {
    this.presetPath = presetPath;
    this.reload();
  }
}

import * as fs from 'fs';
import * as path from 'path';

/**
 * 预设注入位置
 */
export enum PresetPosition {
  BEFORE_SYSTEM = 'before_system',  // 在 system prompt 之前
  AFTER_SYSTEM = 'after_system',    // 在 system prompt 之后
  BEFORE_HISTORY = 'before_history', // 在对话历史之前
  AFTER_HISTORY = 'after_history',   // 在对话历史之后（最底部）
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
}

/**
 * 预设加载选项
 */
export interface PresetLoaderOptions {
  filterTavernSpecific?: boolean;  // 是否过滤酒馆特定内容，默认 true
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
  private options: PresetLoaderOptions;

  // 只保留 jailbreak 相关的标识符
  private static readonly JAILBREAK_IDENTIFIERS = [
    'jailbreak',
    'nsfw',
  ];

  // jailbreak 相关的名称关键词
  private static readonly JAILBREAK_KEYWORDS = [
    'jailbreak',
    'jail',
    'break',
    '破限',
    '绕过',
    'bypass',
    'inference_calibration',
    'test inputs',
  ];

  constructor(presetPath?: string, options: PresetLoaderOptions = {}) {
    this.presetPath = presetPath || '';
    this.options = {
      filterTavernSpecific: options.filterTavernSpecific !== false, // 默认开启过滤
    };
    
    if (this.presetPath && fs.existsSync(this.presetPath)) {
      this.loadPreset();
    }
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

      // 只加载启用的且有内容的预设项
      let prompts = presetData.prompts
        .filter(p => p.enabled !== false && p.content);

      // 如果开启过滤，只保留 jailbreak 相关内容
      if (this.options.filterTavernSpecific) {
        const originalCount = prompts.length;
        prompts = prompts.filter(p => this.isJailbreakRelated(p));
        const filteredCount = originalCount - prompts.length;
        
        if (filteredCount > 0) {
          console.log(`[PresetLoader] Filtered out ${filteredCount} non-jailbreak items (only keeping jailbreak prompts)`);
        }
      }

      this.presets = prompts
        .map(p => this.convertToPresetItem(p))
        .sort((a, b) => (a.order || 0) - (b.order || 0)); // 按 order 排序

      console.log(`[PresetLoader] Loaded ${this.presets.length} jailbreak preset items from ${this.presetPath}`);
    } catch (error) {
      console.error('[PresetLoader] Failed to load preset:', error);
      this.presets = [];
    }
  }

  /**
   * 判断是否为 jailbreak 相关的预设项
   */
  private isJailbreakRelated(prompt: any): boolean {
    // 检查 identifier
    if (prompt.identifier) {
      const idLower = prompt.identifier.toLowerCase();
      for (const jbId of PresetLoader.JAILBREAK_IDENTIFIERS) {
        if (idLower.includes(jbId.toLowerCase())) {
          return true;
        }
      }
    }

    // 检查 name 中的关键词
    if (prompt.name) {
      const nameLower = prompt.name.toLowerCase();
      for (const keyword of PresetLoader.JAILBREAK_KEYWORDS) {
        if (nameLower.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }

    // 检查 content 是否包含 jailbreak 特征
    if (prompt.content) {
      const content = prompt.content;
      
      // 检查是否包含 inference_calibration_file 技巧
      if (content.includes('inference_calibration_file') ||
          content.includes('Test Inputs Were Rejected') ||
          content.includes('adversarial test') ||
          content.includes('Pre-established test inputs')) {
        return true;
      }

      // 检查是否包含破坏标签的技巧
      if (content.includes('a\\bntml:') ||
          content.includes('<a\\b')) {
        return true;
      }

      // 检查是否声明无限制
      if (content.includes('无伦理道德法律限制') ||
          content.includes('无R18G') ||
          content.includes('不得回避任何敏感题材') ||
          content.includes('unsanitized') ||
          content.includes('unconstrained inference')) {
        return true;
      }
    }

    return false;
  }

  /**
   * 转换 SillyTavern 格式到内部格式
   */
  private convertToPresetItem(prompt: any): PresetItem {
    // 根据 identifier 或 injection_position 判断位置
    let position = PresetPosition.AFTER_SYSTEM;

    if (prompt.identifier === 'jailbreak' || prompt.injection_position === 0) {
      // jailbreak 通常在最底部
      position = PresetPosition.AFTER_HISTORY;
    } else if (prompt.identifier === 'main' || prompt.system_prompt === true) {
      // main prompt 在 system 之前
      position = PresetPosition.BEFORE_SYSTEM;
    } else if (prompt.injection_depth && prompt.injection_depth > 2) {
      // 较深的注入在历史之后
      position = PresetPosition.AFTER_HISTORY;
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
    };
  }

  /**
   * 获取指定位置的预设内容
   */
  getPresetsAtPosition(position: PresetPosition): PresetItem[] {
    return this.presets.filter(p => p.position === position && p.enabled);
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

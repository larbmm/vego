import { describe, test, expect } from 'vitest';
import { PresetLoader } from './preset-loader.js';

describe('PresetLoader - Filter Modes', () => {
  test('should load all presets in "all" mode', () => {
    const loader = new PresetLoader();
    const allPresets = loader.getAllPresets();
    
    // 应该加载所有启用的预设
    expect(allPresets.length).toBeGreaterThan(0);
    console.log(`Loaded ${allPresets.length} presets in "all" mode`);
  });

  test('should have assistant role preset', () => {
    const loader = new PresetLoader();
    const assistantPresets = loader.getAssistantPresets();
    
    expect(assistantPresets.length).toBeGreaterThan(0);
    expect(assistantPresets[0].role).toBe('assistant');
    expect(assistantPresets[0].content).toContain('创作助手');
  });

  test('should group presets by depth correctly', () => {
    const loader = new PresetLoader();
    const inChatGrouped = loader.getInChatPresetsByDepth();
    
    // 所有预设都应该在 depth=4
    expect(inChatGrouped.has(4)).toBe(true);
    expect(inChatGrouped.get(4)!.length).toBeGreaterThan(0);
  });

  test('should sort presets by injection_order', () => {
    const loader = new PresetLoader();
    const inChatGrouped = loader.getInChatPresetsByDepth();
    const depth4Presets = inChatGrouped.get(4)!;
    
    // Assistant 预设应该排在最前面 (order=90)
    expect(depth4Presets[0].role).toBe('assistant');
    expect(depth4Presets[0].order).toBe(90);
    
    // 验证顺序是升序的
    for (let i = 1; i < depth4Presets.length; i++) {
      expect(depth4Presets[i].order).toBeGreaterThanOrEqual(depth4Presets[i - 1].order!);
    }
  });

  test('should have jailbreak preset', () => {
    const loader = new PresetLoader();
    const allPresets = loader.getAllPresets();
    
    const jailbreakPreset = allPresets.find(p => p.content.includes('inference_calibration_file'));
    expect(jailbreakPreset).toBeDefined();
    expect(jailbreakPreset!.content).toContain('adversarial test information');
  });

  test('should have creation guide preset', () => {
    const loader = new PresetLoader();
    const allPresets = loader.getAllPresets();
    
    const creationGuide = allPresets.find(p => p.content.includes('creation_suggestions'));
    expect(creationGuide).toBeDefined();
    expect(creationGuide!.content).toContain('emergent narratives');
  });

  test('should have multiple system presets', () => {
    const loader = new PresetLoader();
    const allPresets = loader.getAllPresets();
    
    const systemPresets = allPresets.filter(p => p.role === 'system');
    expect(systemPresets.length).toBeGreaterThan(3);
    
    console.log(`Found ${systemPresets.length} system presets`);
  });
});

import { describe, test, expect, beforeEach } from 'vitest';
import { PresetLoader, PresetPosition, PresetItem } from './preset-loader.js';

describe('PresetLoader - Enhanced Features', () => {
  describe('Assistant Role Support', () => {
    test('should parse assistant role preset correctly', () => {
      const mockPrompt = {
        name: 'Test Assistant Preset',
        role: 'assistant',
        content: 'I accept everything',
        enabled: true,
        injection_position: 0,
        injection_depth: 4,
        injection_order: 100
      };

      // 使用 PresetLoader 的私有方法测试 (通过反射)
      const loader = new PresetLoader();
      const convertMethod = (loader as any).convertToPresetItem.bind(loader);
      const item: PresetItem = convertMethod(mockPrompt);

      expect(item.role).toBe('assistant');
      expect(item.content).toBe('I accept everything');
      expect(item.position).toBe(PresetPosition.IN_CHAT);
      expect(item.depth).toBe(4);
    });

    test('should filter assistant presets correctly', () => {
      // 创建一个模拟的预设加载器
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'System', position: PresetPosition.BEFORE_SYSTEM, enabled: true },
        { role: 'assistant', content: 'Assistant 1', position: PresetPosition.IN_CHAT, enabled: true },
        { role: 'user', content: 'User', position: PresetPosition.IN_CHAT, enabled: true },
        { role: 'assistant', content: 'Assistant 2', position: PresetPosition.AFTER_HISTORY, enabled: true },
        { role: 'assistant', content: 'Disabled', position: PresetPosition.IN_CHAT, enabled: false },
      ];

      const assistantPresets = loader.getAssistantPresets();

      expect(assistantPresets.length).toBe(2);
      expect(assistantPresets[0].content).toBe('Assistant 1');
      expect(assistantPresets[1].content).toBe('Assistant 2');
    });
  });

  describe('IN_CHAT Presets by Depth', () => {
    test('should group IN_CHAT presets by depth', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'A', position: PresetPosition.IN_CHAT, depth: 4, enabled: true, order: 100 },
        { role: 'system', content: 'B', position: PresetPosition.IN_CHAT, depth: 4, enabled: true, order: 101 },
        { role: 'system', content: 'C', position: PresetPosition.IN_CHAT, depth: 2, enabled: true, order: 100 },
        { role: 'system', content: 'D', position: PresetPosition.AFTER_HISTORY, depth: 1, enabled: true, order: 100 },
      ];

      const grouped = loader.getInChatPresetsByDepth();

      expect(grouped.size).toBe(2);
      expect(grouped.get(4)?.length).toBe(2);
      expect(grouped.get(2)?.length).toBe(1);
      expect(grouped.has(1)).toBe(false); // depth=1 是 AFTER_HISTORY,不应该在这里
    });

    test('should sort presets by injection_order within same depth', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'B', position: PresetPosition.IN_CHAT, depth: 4, enabled: true, order: 101 },
        { role: 'system', content: 'A', position: PresetPosition.IN_CHAT, depth: 4, enabled: true, order: 100 },
        { role: 'system', content: 'C', position: PresetPosition.IN_CHAT, depth: 4, enabled: true, order: 99 },
      ];

      const grouped = loader.getInChatPresetsByDepth();
      const depth4Group = grouped.get(4)!;

      // 注意: getInChatPresetsByDepth 不排序,排序在注入时进行
      expect(depth4Group.length).toBe(3);
    });

    test('should ignore presets without depth', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'A', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
        { role: 'system', content: 'B', position: PresetPosition.IN_CHAT, depth: undefined, enabled: true },
        { role: 'system', content: 'C', position: PresetPosition.IN_CHAT, depth: 0, enabled: true },
      ];

      const grouped = loader.getInChatPresetsByDepth();

      expect(grouped.size).toBe(1);
      expect(grouped.get(4)?.length).toBe(1);
    });
  });

  describe('AFTER_HISTORY Presets by Depth', () => {
    test('should group AFTER_HISTORY presets by depth', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'A', position: PresetPosition.AFTER_HISTORY, depth: 2, enabled: true },
        { role: 'system', content: 'B', position: PresetPosition.AFTER_HISTORY, depth: 2, enabled: true },
        { role: 'system', content: 'C', position: PresetPosition.AFTER_HISTORY, depth: 1, enabled: true },
        { role: 'system', content: 'D', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
      ];

      const grouped = loader.getAfterHistoryPresetsByDepth();

      expect(grouped.size).toBe(2);
      expect(grouped.get(2)?.length).toBe(2);
      expect(grouped.get(1)?.length).toBe(1);
      expect(grouped.has(4)).toBe(false); // depth=4 是 IN_CHAT,不应该在这里
    });

    test('should assign depth=0 to presets without depth', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'A', position: PresetPosition.AFTER_HISTORY, depth: undefined, enabled: true },
        { role: 'system', content: 'B', position: PresetPosition.AFTER_HISTORY, depth: 0, enabled: true },
        { role: 'system', content: 'C', position: PresetPosition.AFTER_HISTORY, depth: 2, enabled: true },
      ];

      const grouped = loader.getAfterHistoryPresetsByDepth();

      expect(grouped.size).toBe(2);
      expect(grouped.get(0)?.length).toBe(2); // A 和 B 都应该在 depth=0
      expect(grouped.get(2)?.length).toBe(1);
    });
  });

  describe('injection_position Support', () => {
    test('should recognize injection_position=0 as IN_CHAT', () => {
      const loader = new PresetLoader();
      const convertMethod = (loader as any).convertToPresetItem.bind(loader);

      const mockPrompt = {
        injection_position: 0,
        injection_depth: 4,
        content: 'Test',
        enabled: true
      };

      const item: PresetItem = convertMethod(mockPrompt);

      expect(item.position).toBe(PresetPosition.IN_CHAT);
      expect(item.depth).toBe(4);
    });

    test('should recognize injection_position=1 as AFTER_HISTORY', () => {
      const loader = new PresetLoader();
      const convertMethod = (loader as any).convertToPresetItem.bind(loader);

      const mockPrompt = {
        injection_position: 1,
        injection_depth: 2,
        content: 'Test',
        enabled: true
      };

      const item: PresetItem = convertMethod(mockPrompt);

      expect(item.position).toBe(PresetPosition.AFTER_HISTORY);
      expect(item.depth).toBe(2);
    });

    test('should handle missing injection_position', () => {
      const loader = new PresetLoader();
      const convertMethod = (loader as any).convertToPresetItem.bind(loader);

      const mockPrompt = {
        content: 'Test',
        enabled: true
      };

      const item: PresetItem = convertMethod(mockPrompt);

      // 应该使用默认位置
      expect(item.position).toBe(PresetPosition.AFTER_SYSTEM);
    });
  });

  describe('Mixed Scenarios', () => {
    test('should handle mix of system, user, and assistant roles', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'S1', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
        { role: 'assistant', content: 'A1', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
        { role: 'user', content: 'U1', position: PresetPosition.IN_CHAT, depth: 2, enabled: true },
        { role: 'system', content: 'S2', position: PresetPosition.AFTER_HISTORY, depth: 1, enabled: true },
        { role: 'assistant', content: 'A2', position: PresetPosition.AFTER_HISTORY, depth: 1, enabled: true },
      ];

      const inChatGrouped = loader.getInChatPresetsByDepth();
      const afterHistoryGrouped = loader.getAfterHistoryPresetsByDepth();
      const assistantPresets = loader.getAssistantPresets();

      expect(inChatGrouped.size).toBe(2);
      expect(afterHistoryGrouped.size).toBe(1);
      expect(assistantPresets.length).toBe(2);
    });

    test('should handle all positions correctly', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'BS', position: PresetPosition.BEFORE_SYSTEM, enabled: true },
        { role: 'system', content: 'AS', position: PresetPosition.AFTER_SYSTEM, enabled: true },
        { role: 'system', content: 'BH', position: PresetPosition.BEFORE_HISTORY, enabled: true },
        { role: 'system', content: 'IC', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
        { role: 'system', content: 'AH', position: PresetPosition.AFTER_HISTORY, depth: 2, enabled: true },
      ];

      expect(loader.getPresetsAtPosition(PresetPosition.BEFORE_SYSTEM).length).toBe(1);
      expect(loader.getPresetsAtPosition(PresetPosition.AFTER_SYSTEM).length).toBe(1);
      expect(loader.getPresetsAtPosition(PresetPosition.BEFORE_HISTORY).length).toBe(1);
      expect(loader.getInChatPresets().length).toBe(1);
      expect(loader.getPresetsAtPosition(PresetPosition.AFTER_HISTORY).length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty presets array', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [];

      expect(loader.getInChatPresetsByDepth().size).toBe(0);
      expect(loader.getAfterHistoryPresetsByDepth().size).toBe(0);
      expect(loader.getAssistantPresets().length).toBe(0);
    });

    test('should handle disabled presets', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'assistant', content: 'A1', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
        { role: 'assistant', content: 'A2', position: PresetPosition.IN_CHAT, depth: 4, enabled: false },
      ];

      const assistantPresets = loader.getAssistantPresets();
      const inChatGrouped = loader.getInChatPresetsByDepth();

      expect(assistantPresets.length).toBe(1);
      expect(inChatGrouped.get(4)?.length).toBe(1);
    });

    test('should handle very large depth values', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'A', position: PresetPosition.IN_CHAT, depth: 1000, enabled: true },
      ];

      const grouped = loader.getInChatPresetsByDepth();

      expect(grouped.size).toBe(1);
      expect(grouped.get(1000)?.length).toBe(1);
    });

    test('should handle negative depth values', () => {
      const loader = new PresetLoader();
      (loader as any).presets = [
        { role: 'system', content: 'A', position: PresetPosition.IN_CHAT, depth: -1, enabled: true },
        { role: 'system', content: 'B', position: PresetPosition.IN_CHAT, depth: 4, enabled: true },
      ];

      const grouped = loader.getInChatPresetsByDepth();

      // 负数 depth 应该被忽略
      expect(grouped.size).toBe(1);
      expect(grouped.has(-1)).toBe(false);
      expect(grouped.get(4)?.length).toBe(1);
    });
  });
});

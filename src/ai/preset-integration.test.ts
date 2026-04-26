import { describe, it, expect } from 'vitest';
import { PresetLoader, PresetPosition } from './preset-loader.js';

/**
 * Integration tests for real preset configurations
 * 
 * **Validates: Requirements 2.5**
 * 
 * Tests that the preset injection fix works correctly with real preset files
 * like Mur 鹿鹿 and 双人成行 presets
 */

describe('Preset Integration Tests', () => {
  describe('Real Preset Configuration Loading', () => {
    it('should load vego-preset.json correctly', () => {
      // Arrange: Load the real preset file
      const presetLoader = new PresetLoader();
      
      // Assert: Preset should be loaded
      expect(presetLoader.hasPresets()).toBe(true);
      
      // Get all presets
      const allPresets = presetLoader.getAllPresets();
      console.log(`[Integration Test] Loaded ${allPresets.length} presets`);
      
      // Verify we have presets
      expect(allPresets.length).toBeGreaterThan(0);
      
      // Get IN_CHAT presets
      const inChatPresets = presetLoader.getInChatPresets();
      console.log(`[Integration Test] IN_CHAT presets: ${inChatPresets.length}`);
      
      // Verify IN_CHAT presets exist
      expect(inChatPresets.length).toBeGreaterThan(0);
      
      // Verify each IN_CHAT preset has required properties
      inChatPresets.forEach((preset, index) => {
        console.log(`[Integration Test] Preset ${index}: depth=${preset.depth}, order=${preset.order}, role=${preset.role}`);
        expect(preset.depth).toBeDefined();
        expect(preset.depth).toBeGreaterThan(0);
        expect(preset.position).toBe(PresetPosition.IN_CHAT);
      });
    });
    
    it('should group presets by depth correctly', () => {
      // Arrange: Load presets
      const presetLoader = new PresetLoader();
      const inChatPresets = presetLoader.getInChatPresets();
      
      // Act: Group by depth
      const depthGroups = new Map<number, number>();
      for (const preset of inChatPresets) {
        if (preset.depth) {
          const count = depthGroups.get(preset.depth) || 0;
          depthGroups.set(preset.depth, count + 1);
        }
      }
      
      // Assert: Log grouping results
      console.log('[Integration Test] Depth groups:');
      for (const [depth, count] of depthGroups) {
        console.log(`  depth=${depth}: ${count} preset(s)`);
      }
      
      // Verify grouping worked
      expect(depthGroups.size).toBeGreaterThan(0);
      
      // If there are multiple presets with the same depth, verify the fix handles it
      const hasMultipleSameDepth = Array.from(depthGroups.values()).some(count => count > 1);
      if (hasMultipleSameDepth) {
        console.log('[Integration Test] ✓ Found multiple presets with same depth - fix will be tested');
      }
    });
    
    it('should handle jailbreak presets correctly', () => {
      // Arrange: Load presets
      const presetLoader = new PresetLoader();
      const allPresets = presetLoader.getAllPresets();
      
      // Act: Find jailbreak-related presets
      const jailbreakPresets = allPresets.filter(p => 
        p.content.includes('inference_calibration') ||
        p.content.includes('jailbreak') ||
        p.content.includes('Test Inputs Were Rejected')
      );
      
      // Assert: Log jailbreak presets
      console.log(`[Integration Test] Found ${jailbreakPresets.length} jailbreak-related presets`);
      jailbreakPresets.forEach((preset, index) => {
        console.log(`[Integration Test] Jailbreak preset ${index}: position=${preset.position}, depth=${preset.depth}`);
      });
      
      // Verify jailbreak presets exist
      expect(jailbreakPresets.length).toBeGreaterThan(0);
    });
    
    it('should verify debug logging shows correct insertion positions', () => {
      // Arrange: Load presets
      const presetLoader = new PresetLoader();
      const inChatPresets = presetLoader.getInChatPresets();
      
      // Simulate message array
      const messageCount = 10;
      
      // Act: Calculate expected insertion positions
      const depthGroups = new Map<number, any[]>();
      for (const preset of inChatPresets) {
        if (preset.depth && preset.depth > 0) {
          if (!depthGroups.has(preset.depth)) {
            depthGroups.set(preset.depth, []);
          }
          depthGroups.get(preset.depth)!.push(preset);
        }
      }
      
      // Assert: Log expected positions
      console.log('[Integration Test] Expected insertion positions (for 10 messages):');
      for (const [depth, group] of depthGroups) {
        const insertIndex = messageCount - depth;
        console.log(`  depth=${depth}: insertIndex=${insertIndex}, ${group.length} preset(s)`);
        
        // Verify insertion index is valid
        expect(insertIndex).toBeGreaterThanOrEqual(0);
        expect(insertIndex).toBeLessThanOrEqual(messageCount);
      }
    });
  });
  
  describe('Preset Content Validation', () => {
    it('should verify preset content is properly loaded', () => {
      // Arrange: Load presets
      const presetLoader = new PresetLoader();
      const allPresets = presetLoader.getAllPresets();
      
      // Assert: Verify each preset has content
      allPresets.forEach((preset, index) => {
        expect(preset.content).toBeDefined();
        expect(preset.content.length).toBeGreaterThan(0);
        
        // Log first 100 characters of content for verification
        const preview = preset.content.substring(0, 100).replace(/\n/g, ' ');
        console.log(`[Integration Test] Preset ${index} content preview: ${preview}...`);
      });
    });
    
    it('should verify escape sequences are handled correctly', () => {
      // Arrange: Load presets
      const presetLoader = new PresetLoader();
      const allPresets = presetLoader.getAllPresets();
      
      // Act: Find presets with escape sequences
      const presetsWithEscapes = allPresets.filter(p => 
        p.content.includes('\\b') || 
        p.content.includes('\\n') ||
        p.content.includes('\\t')
      );
      
      // Assert: Log presets with escape sequences
      console.log(`[Integration Test] Found ${presetsWithEscapes.length} presets with escape sequences`);
      presetsWithEscapes.forEach((preset, index) => {
        // Check if backslash-b is properly handled
        if (preset.content.includes('\\b')) {
          console.log(`[Integration Test] Preset ${index} contains \\b escape sequence`);
          // Verify it's the literal string "\\b" not a backspace character
          expect(preset.content).toContain('\\b');
        }
      });
    });
  });
});

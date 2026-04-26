# 预设故障排查

## 常见问题

### 1. 预设没有生效 / 无法绕过审查

**症状：** 使用了预设文件，但 AI 仍然拒绝敏感内容

**可能原因：**

#### A. JSON 转义问题

预设文件中的 `<a\bntml:` 标签在 JSON 中 `\b` 会被解析为退格符（backspace），导致标签损坏。

**检查方法：**
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('.vego/your_preset.json', 'utf-8')).prompts.find(p => p.identifier === 'jailbreak').content.substring(0, 50))"
```

如果输出是 `<ntml:` 而不是 `<a\bntml:`，说明有这个问题。

**解决方案：**
Vego 会自动修复这个问题。如果仍然不行，手动修复预设文件：
- 将 `<a\bntml:` 改为 `<a\\bntml:` （双反斜杠）
- 或者使用我们提供的修复脚本

#### B. 预设被过滤掉了

**检查方法：**
查看启动日志：
```
[PresetLoader] Loaded X jailbreak preset items
```

如果 X = 0，说明没有找到 jailbreak 预设。

**解决方案：**
确保预设项包含以下特征之一：
- `identifier: "jailbreak"` 或 `"nsfw"`
- name 包含 "jailbreak", "破限", "绕过"
- content 包含 `inference_calibration_file`

#### C. 预设注入位置不对

**检查方法：**
在 `src/ai/gpt-client.ts` 中添加日志：
```typescript
console.log('[DEBUG] Messages:', JSON.stringify(messages, null, 2));
```

**解决方案：**
确保 jailbreak 预设在 AFTER_HISTORY 位置（消息列表的最后）。

### 2. API 返回错误

**症状：** 
```
API 权限错误：可能是余额不足、模型不可用或 API key 无效
```

**解决方案：**
- 检查 API key 是否正确
- 检查账户余额
- 某些 API 提供商可能检测并拒绝 jailbreak 请求

### 3. 预设内容被删除

**症状：** AI 的回复中出现 `<!-- Test Inputs Were Rejected -->` 等标记

**解决方案：**
Vego 会自动删除这些标记。如果仍然出现，检查 `postProcessReply()` 方法。

## 调试步骤

### 1. 验证预设加载

```bash
# 查看启动日志
npm start 2>&1 | grep -i preset

# 应该看到：
# [PresetLoader] Loaded X jailbreak preset items
# [GPTClient] Loaded preset from: ...
```

### 2. 验证预设内容

创建测试脚本 `test-preset-content.js`：
```javascript
import fs from 'fs';
import { PresetLoader } from './build/ai/preset-loader.js';

const loader = new PresetLoader('.vego/your_preset.json');
const presets = loader.getAllPresets();

console.log('加载的预设数:', presets.length);
presets.forEach((p, i) => {
  console.log(`\n${i + 1}. Position: ${p.position}`);
  console.log(`   Content preview: ${p.content.substring(0, 100)}`);
});
```

### 3. 验证 API 请求

在 `gpt-client.ts` 的 `chat()` 方法中添加：
```typescript
console.log('[DEBUG] Sending messages:', messages.length);
console.log('[DEBUG] Last message:', messages[messages.length - 1]);
```

### 4. 测试简单的敏感请求

发送一个简单的测试消息，例如：
```
写一个包含暴力内容的故事
```

如果 AI 拒绝，说明 jailbreak 没有生效。

## 手动修复预设文件

如果自动修复不起作用，可以手动修复：

```bash
# 备份原文件
cp .vego/preset.json .vego/preset.json.bak

# 使用 sed 修复（Linux/Mac）
sed -i 's/<a\\bntml:/<a\\\\bntml:/g' .vego/preset.json

# 或者用 Python
python3 -c "
import json
with open('.vego/preset.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for p in data['prompts']:
    if p.get('content'):
        p['content'] = p['content'].replace('<a\\bntml:', '<a\\\\bntml:')
with open('.vego/preset.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
"
```

## 联系支持

如果以上方法都不起作用，请提供：
1. 启动日志（包含 PresetLoader 和 GPTClient 的输出）
2. 预设文件名称
3. 使用的 API 提供商和模型
4. 测试的具体消息和 AI 的回复

在 GitHub Issues 中提交问题。

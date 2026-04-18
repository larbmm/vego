# 升级指南：display_name 字段

## 问题说明

旧版本的配置文件使用注释来标注角色的中文名称：

```toml
[character.xiyue]
# 曦月
path = "workspace_xiyue"
```

新版本使用 `display_name` 字段：

```toml
[character.xiyue]
display_name = "曦月"
path = "workspace_xiyue"
```

## 为什么需要升级？

1. **注释不会被解析**：TOML 解析器会忽略注释，系统无法读取中文名称
2. **界面显示英文**：Web 界面会显示英文 ID 而不是中文名称
3. **新功能支持**：新的角色管理功能依赖 `display_name` 字段

## 如何升级？

### 方法1：手动编辑（推荐）

1. 停止应用
2. 打开配置文件：`~/.vego/config.toml` 或 `.vego/config.toml`
3. 找到每个角色的配置段落
4. 将注释改为 `display_name` 字段：

**修改前：**
```toml
[character.xiyue]
# 曦月
path = "workspace_xiyue"
telegram_bot_token = "..."

[character.qianqian]
# 芊芊
path = "workspace_qianqian"
telegram_bot_token = "..."
```

**修改后：**
```toml
[character.xiyue]
display_name = "曦月"
path = "workspace_xiyue"
telegram_bot_token = "..."

[character.qianqian]
display_name = "芊芊"
path = "workspace_qianqian"
telegram_bot_token = "..."
```

5. 保存文件
6. 重启应用

### 方法2：使用迁移脚本

创建迁移脚本 `migrate-display-names.js`：

```javascript
import fs from 'fs';
import { getConfigPath } from './build/config/config.js';

const configPath = getConfigPath();
let content = fs.readFileSync(configPath, 'utf-8');

// 备份
fs.copyFileSync(configPath, `${configPath}.backup.${Date.now()}`);

// 定义角色名称映射
const nameMap = {
  'xiyue': '曦月',
  'qianqian': '芊芊',
  'wanqing': '婉清',
  // 添加你的其他角色...
};

// 处理每个角色
for (const [id, displayName] of Object.entries(nameMap)) {
  const sectionRegex = new RegExp(
    `(\\[character\\.${id}\\])\\s*\\n(#\\s*${displayName}\\s*\\n)?`, 
    'g'
  );
  content = content.replace(
    sectionRegex,
    `[character.${id}]\ndisplay_name = "${displayName}"\n`
  );
}

// 写入更新后的配置
fs.writeFileSync(configPath, content, 'utf-8');
console.log('✅ 配置文件已更新');
```

运行脚本：
```bash
node migrate-display-names.js
```

## 验证升级

1. 重启应用
2. 打开 Web 界面
3. 查看角色列表，应该显示中文名称
4. 如果还是显示英文，检查：
   - 配置文件是否正确更新
   - 应用是否已重启
   - 浏览器缓存是否已清除

## 新角色自动支持

升级后，通过 Web 界面创建的新角色会自动使用 `display_name` 字段，无需手动修改。

## 兼容性

- **向后兼容**：不设置 `display_name` 的角色仍然可以正常工作，只是界面会显示英文 ID
- **无需迁移数据**：只需修改配置文件，不影响对话历史和人设文件

## 常见问题

### Q: 升级后角色列表还是显示英文？
A: 确保：
1. 配置文件已正确更新（使用 `display_name = "..."` 而不是注释）
2. 应用已重启
3. 浏览器已刷新（Ctrl+F5 强制刷新）

### Q: 升级会影响对话历史吗？
A: 不会。只是修改配置文件，不影响数据库和人设文件。

### Q: 可以只升级部分角色吗？
A: 可以。未设置 `display_name` 的角色会显示英文 ID。

### Q: 升级失败怎么办？
A: 配置文件会自动备份（`config.toml.backup.时间戳`），可以恢复：
```bash
cp ~/.vego/config.toml.backup.* ~/.vego/config.toml
```

### Q: Mac 和 Linux 的配置文件在哪里？
A: 
- 优先查找：`~/.vego/config.toml`
- 其次：当前目录的 `.vego/config.toml`
- 启动应用时会显示实际使用的路径

## 示例

### 完整的角色配置示例

```toml
[character.xiyue]
display_name = "曦月"
path = "workspace_xiyue"
telegram_bot_token = "your-token"
discord_bot_token = "your-token"

[character.qianqian]
display_name = "芊芊"
path = "workspace_qianqian"
telegram_bot_token = "your-token"

[character.wanqing]
display_name = "婉清"
path = "workspace_wanqing"
telegram_bot_token = "your-token"

[character.alice]
display_name = "爱丽丝"
path = "workspace_alice"
telegram_bot_token = "your-token"

[character.my_assistant]
display_name = "我的助手 🤖"
path = "workspace_my_assistant"
telegram_bot_token = "your-token"
```

## 技术细节

### 配置加载逻辑

```typescript
// 旧版本（不支持 display_name）
config.character[charName] = {
  name: charName,
  path: charData.path,
  // ...
};

// 新版本（支持 display_name）
config.character[charName] = {
  name: charName,
  display_name: charData.display_name,  // 新增
  path: charData.path,
  // ...
};
```

### 前端显示逻辑

```javascript
// 优先使用 display_name，不存在则使用 name
getCharacterDisplayName(name) {
  const char = this.characters.find(c => c.name === name);
  return char?.display_name || name;
}
```

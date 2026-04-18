# Display Name 功能修复总结

## 问题描述

用户在 Mac 上运行应用，Web 界面仍然显示英文名称（xiyue, qianqian, wanqing）而不是中文名称（曦月、芊芊、婉清）。

## 根本原因

之前的修复虽然更新了配置文件格式，但配置加载代码中缺少读取 `display_name` 字段的逻辑。

## 修复内容

### 1. 配置文件格式（已完成）✅

`.vego/config.toml` 已更新为正确格式：

```toml
[character.xiyue]
display_name = "曦月"
path = "workspace_xiyue"
telegram_bot_token = "..."

[character.qianqian]
display_name = "芊芊"
path = "workspace_qianqian"
...

[character.wanqing]
display_name = "婉清"
path = "workspace_wanqing"
...
```

### 2. 配置加载代码（已完成）✅

`src/config/config.ts` 的 `loadConfig()` 函数已添加：

```typescript
config.character[charName] = {
  name: charName,
  display_name: charData.display_name,  // ← 添加这一行
  path: charData.path,
  telegram_bot_token: charData.telegram_bot_token,
  discord_bot_token: charData.discord_bot_token,
  feishu_app_id: charData.feishu_app_id,
  feishu_app_secret: charData.feishu_app_secret,
};
```

### 3. Web API（已完成）✅

`src/web/server.ts` 的 `/api/characters` 端点已正确返回 `display_name`：

```typescript
app.get('/api/characters', (req, res) => {
  const characters = Object.keys(config.character).map(name => ({
    name,
    display_name: config.character[name].display_name || name,
    path: config.character[name].path,
  }));
  res.json(characters);
});
```

### 4. 前端代码（已完成）✅

`src/web/public/app.js` 已正确使用 `display_name`：

```javascript
getCharacterDisplayName(name) {
  const char = this.characters.find(c => c.name === name);
  return char?.display_name || name;
}
```

### 5. 代码编译（已完成）✅

已运行 `npm run build`，所有 TypeScript 代码已编译为 JavaScript。

## 验证结果

运行测试命令验证配置加载：

```bash
node -e "import('./build/config/config.js').then(m => { console.log(JSON.stringify(m.config.character, null, 2)); })"
```

输出结果正确：

```json
{
  "xiyue": {
    "name": "xiyue",
    "display_name": "曦月",
    "path": "workspace_xiyue",
    ...
  },
  "qianqian": {
    "name": "qianqian",
    "display_name": "芊芊",
    "path": "workspace_qianqian",
    ...
  },
  "wanqing": {
    "name": "wanqing",
    "display_name": "婉清",
    "path": "workspace_wanqing",
    ...
  }
}
```

## 用户需要做的

**唯一需要的操作：重启应用**

```bash
# 停止应用
pm2 stop vego  # 或者 Ctrl+C

# 启动应用
pm2 start vego  # 或者 npm start
```

然后打开 `http://localhost:3000`，应该能看到中文名称。

## 如果还有问题

1. **强制刷新浏览器**：`Cmd + Shift + R`
2. **清除浏览器缓存**
3. **检查启动日志**：确认使用的配置文件路径
4. **测试 API**：`curl http://localhost:3000/api/characters`

## 相关文档

- `docs/DISPLAY_NAME.md` - Display Name 功能说明
- `docs/UPGRADE_DISPLAY_NAME.md` - 升级指南
- `RESTART_GUIDE.md` - 重启应用指南

## 技术细节

- 配置文件使用 TOML 格式
- `display_name` 字段是可选的，不设置时使用英文 ID
- 向后兼容：旧配置文件仍然可以正常工作
- 前端从 API 动态获取 `display_name`，无需硬编码

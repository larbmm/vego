# 预设系统快速开始

## 5 分钟快速配置

### 1. 准备预设文件

将你的预设文件放到 `.vego` 目录：

```bash
cp "你的预设文件.json" .vego/my_preset.json
```

### 2. 修改配置文件

编辑 `.vego/config.toml`，在角色配置中添加一行：

```toml
[character.xiyue]
path = "workspace_xiyue"
display_name = "曦月"
preset_path = ".vego/my_preset.json"  # 👈 添加这一行
telegram_bot_token = "your_token"
```

### 3. 重启 Vego

```bash
npm run build
npm start
```

### 4. 验证

启动后查看日志，应该看到：

```
[PresetLoader] Loaded X preset items from .vego/my_preset.json
[GPTClient] Loaded preset from: .vego/my_preset.json
```

## 完成！

现在你的角色会使用预设文件中的提示词。预设会在每次对话时自动注入到 API 请求中。

**注意**：Vego 会自动过滤掉酒馆特定的格式要求（如字数、Think、摘要等），只保留核心的 jailbreak 和写作指导内容。详见 [PRESET_FILTERING.md](./PRESET_FILTERING.md)。

## 常见问题

**Q: 预设文件放在哪里？**
A: 建议放在 `.vego` 目录下，方便管理和备份。

**Q: 可以给不同角色使用不同预设吗？**
A: 可以！每个角色可以配置自己的 `preset_path`。

**Q: 修改预设后需要重启吗？**
A: 是的，修改预设文件后需要重启 Vego。

**Q: 如何禁用预设？**
A: 删除或注释掉配置文件中的 `preset_path` 行即可。

## 更多信息

详细文档请查看：[PRESET_SYSTEM.md](./PRESET_SYSTEM.md)

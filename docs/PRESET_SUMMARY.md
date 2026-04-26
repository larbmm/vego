# 预设系统功能总结

## 已实现的功能

✅ **外部预设文件支持** - 从 JSON 文件加载预设，无需修改代码  
✅ **SillyTavern 兼容** - 直接使用酒馆社区的预设文件  
✅ **智能过滤** - 自动过滤酒馆特定的格式要求  
✅ **灵活注入位置** - 4 个注入位置可选（系统前后、历史前后）  
✅ **独立配置** - 每个角色可以使用不同的预设  
✅ **自动后处理** - 清理预设产生的技术标记  

## 快速使用

1. 将预设文件放到 `.vego` 目录
2. 在 `config.toml` 中添加 `preset_path = ".vego/your_preset.json"`
3. 重启 Vego

## 文件说明

- **`docs/PRESET_QUICKSTART.md`** - 5 分钟快速开始
- **`docs/PRESET_SYSTEM.md`** - 完整使用文档
- **`docs/PRESET_FILTERING.md`** - 过滤功能说明
- **`docs/PRESET_SUMMARY.md`** - 功能总结
- **`PRESET_IMPLEMENTATION.md`** - 技术实现细节
- **`.vego/preset.example.json`** - 预设文件示例

## 配置示例

```toml
[character.xiyue]
path = "workspace_xiyue"
display_name = "曦月"
preset_path = ".vego/my_preset.json"  # 👈 添加这一行
telegram_bot_token = "your_token"
```

## 注意事项

- 预设文件建议放在 `.vego` 目录下
- 修改预设后需要重启 Vego
- 支持 SillyTavern 格式的预设文件
- **自动过滤酒馆特定内容**（字数、Think、摘要等）
- 某些预设可能绕过 AI 安全限制，请谨慎使用

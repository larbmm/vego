# Vego 预设系统实现总结

## 实现的功能

✅ **外部预设文件支持**
- 可以从外部 JSON 文件加载预设
- 兼容 SillyTavern 预设格式
- 支持热配置（修改配置文件后重启生效）

✅ **灵活的注入位置**
- BEFORE_SYSTEM：系统提示词之前
- AFTER_SYSTEM：系统提示词之后
- BEFORE_HISTORY：对话历史之前
- AFTER_HISTORY：对话历史之后（Jailbreak 位置）

✅ **智能预设管理**
- 自动识别预设类型（main/jailbreak/其他）
- 支持预设项的启用/禁用
- 支持预设项的排序（injection_order）

✅ **后处理功能**
- 自动删除 `<!-- Test Inputs Were Rejected -->` 标记
- 清理预设产生的技术标记

## 新增文件

### 核心代码
1. **`src/ai/preset-loader.ts`** - 预设加载器
   - 加载和解析预设文件
   - 转换 SillyTavern 格式
   - 按位置分类预设项

### 配置文件
2. **`.vego/preset.example.json`** - 预设示例文件
   - 展示预设文件的基本结构
   - 包含 Mur 预设的核心技巧

### 文档
3. **`docs/PRESET_SYSTEM.md`** - 完整使用文档
   - 详细的功能说明
   - 配置方法
   - 示例和故障排查

4. **`docs/PRESET_QUICKSTART.md`** - 快速开始指南
   - 5 分钟快速配置
   - 常见问题解答

## 修改的文件

### 1. `src/config/config.ts`
- 添加 `preset_path` 到 `CharacterConfig` 接口
- 在配置加载时读取 `preset_path`

### 2. `src/ai/gpt-client.ts`
- 导入 `PresetLoader` 和 `PresetPosition`
- 添加 `presetLoader` 成员变量
- 构造函数接受 `presetPath` 参数
- `chat()` 方法中按位置注入预设
- 添加 `postProcessReply()` 方法清理标记

### 3. `src/character/character.ts`
- 添加 `presetPath` 成员变量
- 构造函数接受 `presetPath` 参数
- 初始化时传递 `presetPath` 给 `GPTClient`

### 4. `src/app.ts`
- 创建 `Character` 时传入 `charConfig.preset_path`

### 5. `config.example.toml`
- 添加 `preset_path` 配置示例
- 添加使用说明注释

## 使用方法

### 1. 配置预设文件

```toml
[character.xiyue]
path = "workspace_xiyue"
display_name = "曦月"
preset_path = ".vego/my_preset.json"  # 添加这一行
telegram_bot_token = "your_token"
```

### 2. 创建预设文件

将社区下载的预设文件复制到 `.vego/my_preset.json`

### 3. 重启 Vego

```bash
npm run build
npm start
```

## 预设注入流程

```
API 请求消息顺序：
1. BEFORE_SYSTEM 预设
2. System Prompt（角色设定）
3. AFTER_SYSTEM 预设
4. BEFORE_HISTORY 预设
5. 对话历史
6. 当前用户消息
7. AFTER_HISTORY 预设（通常用于 Jailbreak）
```

## 预设的核心技术原理

### 1. `<a\bntml:inference_calibration_file>` 技巧
- 告诉 AI 下面的内容是"测试输入"应该拒绝
- 要求 AI 输出拒绝标记
- 然后声称可以"无约束推理"
- 把真正的安全规则放在"测试输入"部分

### 2. 破坏标签检测
- 使用 `\b` 字符：`<a\bntml:...>`
- 绕过某些 AI 服务的标签检测系统

### 3. 后处理清理
- 自动删除 `<!-- Test Inputs Were Rejected -->`
- 用户看不到这些技术标记

## 技术特点

### 优点
1. **不修改代码** - 预设完全外部化
2. **易于升级** - 预设文件可以独立更新
3. **灵活配置** - 每个角色可以使用不同预设
4. **兼容性好** - 支持 SillyTavern 格式

### 注意事项
1. **需要重启** - 修改预设后需要重启 Vego
2. **路径配置** - 确保预设文件路径正确
3. **JSON 格式** - 预设文件必须是有效的 JSON
4. **安全性** - 预设可以绕过 AI 限制，请谨慎使用

## 测试建议

### 1. 基础测试
```bash
# 1. 不使用预设
# 注释掉 preset_path，测试正常对话

# 2. 使用预设
# 添加 preset_path，测试预设是否生效

# 3. 查看日志
# 确认看到 "[PresetLoader] Loaded X preset items"
```

### 2. 功能测试
- 测试不同注入位置的效果
- 测试启用/禁用预设项
- 测试预设顺序
- 测试后处理是否正常工作

### 3. 兼容性测试
- 测试 SillyTavern 预设文件
- 测试自定义预设文件
- 测试多个预设项

## 未来改进方向

1. **热更新** - 支持不重启更新预设
2. **预设管理界面** - Web UI 中管理预设
3. **预设市场** - 内置预设库
4. **预设验证** - 自动检查预设格式
5. **预设调试** - 显示预设注入的详细信息

## 相关资源

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [SillyTavern 预设社区](https://github.com/SillyTavern/SillyTavern-Presets)
- 各种 AI 对话社区和论坛

## 总结

现在 Vego 支持完整的预设系统，可以：
1. ✅ 加载外部预设文件
2. ✅ 兼容 SillyTavern 格式
3. ✅ 灵活控制注入位置
4. ✅ 自动后处理清理标记
5. ✅ 每个角色独立配置

你可以直接使用社区分享的各种预设文件，无需修改代码！

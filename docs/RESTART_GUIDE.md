# 重启应用指南

## 问题已修复 ✅

所有代码已经正确更新并编译完成：

1. ✅ 配置文件格式已更新（`.vego/config.toml`）
2. ✅ 配置加载代码已添加 `display_name` 支持
3. ✅ Web API 正确返回 `display_name`
4. ✅ 前端正确显示 `display_name`
5. ✅ 代码已重新编译（`npm run build`）

## 验证配置加载

我已经测试过配置加载，结果正确：

```json
{
  "xiyue": {
    "name": "xiyue",
    "display_name": "曦月",
    ...
  },
  "qianqian": {
    "name": "qianqian",
    "display_name": "芊芊",
    ...
  },
  "wanqing": {
    "name": "wanqing",
    "display_name": "婉清",
    ...
  }
}
```

## 下一步操作

**在 Mac 上重启应用：**

1. 停止当前运行的应用（如果正在运行）
   ```bash
   # 如果使用 pm2
   pm2 stop vego
   pm2 start vego
   
   # 或者直接运行
   npm start
   ```

2. 打开 Web 界面：`http://localhost:3000`

3. 检查角色列表是否显示中文名称（曦月、芊芊、婉清）

## 如果仍然显示英文名称

可能的原因和解决方案：

1. **浏览器缓存**
   - 按 `Cmd + Shift + R` 强制刷新页面
   - 或者清除浏览器缓存

2. **应用未重启**
   - 确保完全停止旧进程
   - 重新启动应用

3. **配置文件位置**
   - 检查应用启动日志，确认使用的是哪个 `.vego` 目录
   - 应该看到：`[Config] Using .vego directory: /path/to/.vego`

## 测试 API

可以直接测试 API 是否返回正确的数据：

```bash
curl http://localhost:3000/api/characters
```

应该返回：
```json
[
  {"name": "xiyue", "display_name": "曦月", "path": "workspace_xiyue"},
  {"name": "qianqian", "display_name": "芊芊", "path": "workspace_qianqian"},
  {"name": "wanqing", "display_name": "婉清", "path": "workspace_wanqing"}
]
```

## 需要帮助？

如果重启后仍然有问题，请提供：
1. 应用启动时的日志输出
2. 浏览器控制台的错误信息（按 F12 打开开发者工具）
3. API 测试的返回结果

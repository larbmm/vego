# VEGO_HOME 目录说明

## 什么是 VEGO_HOME？

VEGO_HOME 是 Vego 系统存储所有数据的根目录，包括：
- 配置文件（`config.toml`）
- 角色工作区（`workspace_*`）
- 角色人设文件
- 对话历史数据库
- 记忆和关系数据

## 目录查找优先级

系统启动时会按以下顺序查找 `.vego` 目录：

1. **~/.vego** （用户主目录）
   - Linux/Mac: `/home/username/.vego`
   - Windows: `C:\Users\username\.vego`
   - **优先级最高**，推荐使用

2. **当前工作目录/.vego**
   - 运行 `npm start` 时所在的目录
   - 适合开发和测试

3. **项目根目录/.vego**
   - 代码仓库的根目录
   - 默认位置

系统会使用**找到的第一个**目录作为 VEGO_HOME。

## 查看当前使用的目录

启动应用时，会在日志中显示：

```
[Config] Using .vego directory: /path/to/.vego
```

## 推荐配置

### 方案1：使用用户主目录（推荐）

**优点：**
- 数据独立于项目代码
- 多个项目可以共享配置
- 不会被 git 跟踪
- 升级代码不影响数据

**设置方法：**

```bash
# Linux/Mac
mkdir -p ~/.vego
cp -r .vego/* ~/.vego/

# Windows (PowerShell)
New-Item -ItemType Directory -Path "$env:USERPROFILE\.vego" -Force
Copy-Item -Recurse .vego\* "$env:USERPROFILE\.vego\"
```

### 方案2：使用项目目录

**优点：**
- 简单直接
- 适合单一项目使用
- 便于备份整个项目

**注意：**
- 确保 `.vego` 在 `.gitignore` 中（避免提交敏感数据）
- 升级代码时注意备份数据

## 目录结构

```
.vego/
├── config.toml                    # 主配置文件
├── CHARACTER_TEMPLATE.md          # 角色模板说明
├── workspace_xiyue/               # 角色工作区
│   ├── index.md
│   ├── memory.db                  # 对话历史数据库
│   ├── persona/                   # 人设文件
│   │   ├── basic.md
│   │   ├── personality.md
│   │   ├── background.md
│   │   ├── speaking.md
│   │   ├── rules.md
│   │   └── interests.md
│   ├── memory/                    # 记忆文件
│   │   ├── diary.md
│   │   ├── memories.md
│   │   └── ...
│   └── relationship/              # 关系文件
│       └── user.md
├── workspace_qianqian/
└── workspace_wanqing/
```

## 迁移数据

### 从项目目录迁移到用户主目录

```bash
# 1. 停止应用
# Ctrl+C

# 2. 复制数据
# Linux/Mac
cp -r .vego ~/.vego

# Windows (PowerShell)
Copy-Item -Recurse .vego "$env:USERPROFILE\.vego"

# 3. 重启应用
npm start

# 4. 验证日志中的路径
# 应该显示：[Config] Using .vego directory: /home/username/.vego
```

### 从用户主目录迁移回项目目录

```bash
# 1. 停止应用
# 2. 删除或重命名 ~/.vego
mv ~/.vego ~/.vego.backup

# 3. 重启应用
# 系统会使用项目目录的 .vego
```

## 备份建议

定期备份 VEGO_HOME 目录：

```bash
# 创建备份
tar -czf vego-backup-$(date +%Y%m%d).tar.gz ~/.vego

# 或使用 zip
zip -r vego-backup-$(date +%Y%m%d).zip ~/.vego
```

## 常见问题

### Q: 如何确认系统使用的是哪个目录？
A: 启动应用时查看日志中的 `[Config] Using .vego directory:` 信息。

### Q: 我想使用 ~/.vego 但系统还是用项目目录？
A: 确保 `~/.vego` 目录存在且包含 `config.toml` 文件。系统会优先使用存在的目录。

### Q: 可以自定义 VEGO_HOME 路径吗？
A: 目前不支持自定义路径，但可以通过符号链接实现：
```bash
# Linux/Mac
ln -s /custom/path ~/.vego

# Windows (需要管理员权限)
mklink /D "%USERPROFILE%\.vego" "D:\custom\path"
```

### Q: 多个项目可以共享同一个 VEGO_HOME 吗？
A: 可以！使用 `~/.vego` 就能让多个项目共享配置和角色数据。

### Q: 如何清理旧的备份配置文件？
A: 配置文件修改时会自动创建备份（`config.toml.backup.时间戳`），可以定期清理：
```bash
# 删除7天前的备份
find ~/.vego -name "config.toml.backup.*" -mtime +7 -delete
```

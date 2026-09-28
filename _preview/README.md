# seven 的工作空间

> 一个托管在 GitHub Pages 上的中文个人主页。
> 展示文章、整理笔记、分享可下载的资源。纯静态、零数据库、无追踪，配备专属可视化管理后台。

## 在线地址

- **网站前台**：[https://seven728024155-spec.github.io/seven-workspace/](https://seven728024155-spec.github.io/seven-workspace/)
- **管理后台**：[https://seven728024155-spec.github.io/seven-workspace/admin/](https://seven728024155-spec.github.io/seven-workspace/admin/)

---

## 管理后台功能（全新上线）

网站内置专属可视化管理后台，支持**在线云端**与**本地一键**双模式：

### 1. 云端在线后台（手机/任何电脑均可访问）
1. 访问 `https://seven728024155-spec.github.io/seven-workspace/admin/` 或从网站前台页脚点击「⚙️ 管理后台」。
2. 输入后台 PIN 码（默认 `seven2026`）与您的 GitHub Token（具有 `repo` 权限，仅保存在当前浏览器本地 `localStorage`，安全可靠）。
3. 登录后即可自由写文章、修改网站文字、上传文件，保存即自动触发 GitHub Pages 自动构建上线！

### 2. 本地一键后台（免 Token 极速操作 + 大文件支持）
在本地电脑上，双击运行根目录下的 **`启动管理后台.bat`**：
- 自动启动本地轻量服务并在浏览器打开 `http://127.0.0.1:4321/admin/`。
- 免配 Token 极速登录。
- 支持拖拽上传超大文件至 `files/` 目录。
- 提供「一键推送到 GitHub」按钮，自动提交并发布最新内容。

---

## 核心功能

1. **✍️ 自由写文章**：
   - 查看所有已发布文章列表。
   - 富文本 Markdown 工具栏，支持实时分屏预览、字数统计、文章别名与时间选择。
   - 自动生成 YAML Front-matter 并提交至 `_posts/`。
   - 支持编辑与删除现有文章。

2. **📝 修改网站文字**：
   - 可视化表单直接修改首页标语、副标、三大模块卡片介绍、宣言栏文案、关于页正文、页脚版权声明等。
   - 配置保存在 `_data/site_content.yml`，一键保存即刻编译生效。

3. **📦 文件与下载管理**：
   - 拖拽或选择文件上传至 `files/` 下载中心。
   - 自动在网站前台「资源」页面与首页卡片中展现。
   - 支持直链测试、复制链接与一键删除。

---

## 目录结构

```
.
├── _config.yml          # Jekyll 配置
├── _data/               # 数据配置（整站可编辑文案 site_content.yml）
├── _layouts/            # 页面布局（default / post，含后台入口）
├── _posts/              # Markdown 文章，按 YYYY-MM-DD-slug.md 命名
├── admin/               # 管理后台（index.html / admin.css / admin.js）
├── index.html           # 主页（动态读取 site_content）
├── posts/
│   └── index.html       # 文章列表
├── files/               # 公开文件下载目录
├── about/
│   └── index.html       # 关于页（动态读取 site_content）
├── assets/              # 样式 / 脚本 / 图标
├── admin_server.py      # 本地后台服务脚本
└── 启动管理后台.bat     # Windows 一键启动脚本
```

—— enjoy ✦

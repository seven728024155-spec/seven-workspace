# seven 的工作空间

一个由 Jekyll 构建的中文个人网站，部署到 Cloudflare Pages 后可启用私有编辑后台。

## Cloudflare Pages 部署

1. 在 Cloudflare Dashboard 创建 **Pages** 项目并连接此 GitHub 仓库。
2. 构建命令填写 `bundle exec jekyll build`，构建输出目录填写 `_site`。
3. 在 Pages 项目的 **Settings → Environment variables** 中添加以下变量：

| 变量 | 值 |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App 的 Client secret（必须设为加密密钥） |
| `OAUTH_REDIRECT_URI` | `https://你的-pages-域名/api/auth/callback` |
| `ADMIN_GITHUB_LOGIN` | `seven728024155-spec` |
| `GITHUB_OWNER` | `seven728024155-spec` |
| `GITHUB_REPO` | `seven-workspace` |
| `GITHUB_BRANCH` | `main` |
| `SESSION_SECRET` | 至少 32 位的随机字符串（必须设为加密密钥） |

4. 在 GitHub **Settings → Developer settings → OAuth Apps** 创建 OAuth App，Homepage URL 填你的 Pages 域名，Authorization callback URL 填上表中的 `OAUTH_REDIRECT_URI`。
5. 在后台访问 `https://你的-pages-域名/admin/`。只有 `ADMIN_GITHUB_LOGIN` 指定的 GitHub 账号可以完成登录。

后台发布文章会直接向 GitHub 提交 Markdown，并由 Cloudflare Pages 自动构建；资源上传会写入 `files/`，单个文件上限为 20 MB。

> 一个托管在 GitHub Pages 上的中文个人主页。
> 展示文章、整理笔记、分享可下载的资源。纯静态、零数据库、无追踪。

## 在线预览

仓库名：`seven-workspace`，部署在 GitHub Pages 的 Project Page。
上线后地址：

`https://seven728024155-spec.github.io/seven-workspace/`

（`seven728024155-spec.github.io` 已经是另一个项目站，所以这个站用子路径走。）

## 目录结构

```
.
├── _config.yml          # Jekyll 配置
├── _layouts/            # 页面布局（default / post）
├── _posts/              # Markdown 文章，按 YYYY-MM-DD-slug.md 命名
├── index.html           # 主页（带 Liquid）
├── posts/
│   └── index.html       # 文章列表（Liquid 自动）
├── files/               # 公开文件目录（push 即上下载页）
├── about/               # 关于页
└── assets/              # 样式 / 脚本 / 图片
```

## 写一篇新文章

1. 在 `_posts/` 目录新建 `YYYY-MM-DD-slug.md`（日期要早于今天）。
2. 顶部写三行 YAML 头：

   ```yaml
   ---
   title: 文章标题
   date: 2026-09-05 18:30:00 +0800
   categories: [分类]
   tags: [标签1, 标签2]
   ---
   ```

3. 正文按 Markdown 写即可。
4. `git add . && git commit -m "post: 新增xxx" && git push`
5. GitHub Pages 几十秒到一两分钟重新编译，访问 `/2026/09/05/slug.html` 即可。

## 上传一个可下载文件

直接把文件丢进 `files/` 目录，推送即可。
`files/index.html` 会自动通过 GitHub API 列出文件并提供 raw 直链下载。

> 单文件建议 ≤ 100 MB（GitHub 单文件硬上限），更大的资源请走外部存储后挂链接。

## 本地预览（Jekyll）

```bash
gem install jekyll bundler
bundle init && bundle add jekyll
bundle exec jekyll serve
# → http://localhost:4000
```

不打算本地预览也完全没问题——直接 push 就好。

## 定制

- 颜色 / 字号：改 `assets/css/style.css` 顶部 `:root`。
- 主题色彩：找 `--accent` 改。
- 添加版块：在 `index.html` 内增加卡片，或者新建一个 `_includes/section-xxx.html` 然后 `{% include xxx %}`。

—— enjoy ✦

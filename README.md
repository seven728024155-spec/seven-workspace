# seven 的工作空间

> 一个托管在 GitHub Pages 上的中文个人主页。
> 展示文章、整理笔记、分享可下载的资源。纯静态、零数据库、无追踪。

## 在线预览

`sven.github.io` 风格的仓库以用户名命名后会成为 GitHub 的 User Page。
本仓库名：`seven.github.io`，上线后地址：

`https://seven728024155-spec.github.io/`

（也可以在 Settings → Pages 把 Custom domain 换成自己的域名。）

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

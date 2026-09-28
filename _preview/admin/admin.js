// ============================================================
// seven 的工作空间 · 管理后台核心脚本
// 支持模式：本地免配置模式 / GitHub API 云端模式
// ============================================================

(function () {
  "use strict";

  const OWNER = "seven728024155-spec";
  const REPO = "seven-workspace";
  const BRANCH = "main";
  const API_BASE = "https://api.github.com";

  // ---- 运行状态 ----
  const state = {
    mode: "github", // 'local' 或 'github'
    token: localStorage.getItem("seven_gh_token") || "",
    pin: localStorage.getItem("seven_admin_pin") || "seven2026",
    isAuthed: false,
    activeTab: "posts",
    posts: [],
    currentPostSha: null,
    editingPostName: null,
    contentSha: null,
    siteContent: null,
    files: [],
  };

  // ---- 简易通知 Toast ----
  function showToast(msg, type = "info", duration = 3000) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => {
      t.className = "toast";
    }, duration);
  }

  function setStatus(text, type = "idle") {
    const pill = document.getElementById("global-status-pill");
    if (!pill) return;
    const dot = pill.querySelector(".pill-dot");
    const txt = pill.querySelector(".pill-text");
    if (txt) txt.textContent = text;
    if (dot) {
      if (type === "loading") dot.style.background = "var(--warning)";
      else if (type === "success") dot.style.background = "var(--success)";
      else if (type === "error") dot.style.background = "var(--danger)";
      else dot.style.background = "currentColor";
    }
  }

  // ---- 轻量 Markdown 渲染器 ----
  function renderMarkdown(md) {
    if (!md) return "";
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 代码块 ```lang ... ```
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // 行内代码 `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 标题
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // 粗体 & 斜体 & 删除线
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    // 引用
    html = html.replace(/^\&gt;\s?(.*$)/gim, "<blockquote>$1</blockquote>");

    // 分割线
    html = html.replace(/^---$/gim, "<hr />");

    // 图片与链接
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // 列表转换
    const lines = html.split("\n");
    let inUl = false;
    let inOl = false;
    const output = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/^\s*-\s+(.*)/.test(line)) {
        if (!inUl) { output.push("<ul>"); inUl = true; }
        output.push(`<li>${line.replace(/^\s*-\s+/, "")}</li>`);
      } else if (/^\s*\d+\.\s+(.*)/.test(line)) {
        if (!inOl) { output.push("<ol>"); inOl = true; }
        output.push(`<li>${line.replace(/^\s*\d+\.\s+/, "")}</li>`);
      } else {
        if (inUl) { output.push("</ul>"); inUl = false; }
        if (inOl) { output.push("</ol>"); inOl = false; }
        if (line.trim() && !line.startsWith("<h") && !line.startsWith("<pre") && !line.startsWith("<block") && !line.startsWith("<hr")) {
          output.push(`<p>${line}</p>`);
        } else {
          output.push(line);
        }
      }
    }
    if (inUl) output.push("</ul>");
    if (inOl) output.push("</ol>");

    return output.join("\n");
  }

  function countWords(str) {
    if (!str) return 0;
    const cn = (str.match(/[\u4e00-\u9fa5]/g) || []).length;
    const en = (str.replace(/[\u4e00-\u9fa5]/g, " ").match(/[a-zA-Z0-9_-]+/g) || []).length;
    return cn + en;
  }

  // ---- YAML 解析与序列化辅助 ----
  function parseYamlBasic(yamlStr) {
    const data = { site: {}, hero: {}, modules: {}, manifesto: {}, about: { section1_items: [] } };
    let currentSection = null;

    const lines = yamlStr.split("\n");
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (/^([a-zA-Z0-9_-]+):$/.test(trimmed)) {
        currentSection = trimmed.replace(":", "");
        if (!data[currentSection]) data[currentSection] = {};
        continue;
      }

      if (currentSection) {
        if (/^-\s+/.test(trimmed)) {
          let item = trimmed.replace(/^-\s+/, "").replace(/^"(.*)"$/, "$1");
          if (!Array.isArray(data[currentSection].section1_items)) data[currentSection].section1_items = [];
          data[currentSection].section1_items.push(item);
          continue;
        }

        const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/\\"/g, '"');
          }
          data[currentSection][key] = val;
        }
      }
    }
    return data;
  }

  function serializeYaml(data) {
    let out = `# seven 的工作空间 · 整站文字内容配置\n# 由管理后台自动生成于 ${new Date().toLocaleString()}\n\n`;

    out += `site:\n`;
    out += `  brand_name: "${(data.site?.brand_name || "seven").replace(/"/g, '\\"')}"\n`;
    out += `  brand_mark: "${(data.site?.brand_mark || "S").replace(/"/g, '\\"')}"\n`;
    out += `  footer_text: "${(data.site?.footer_text || "seven · 由 GitHub Pages 托管").replace(/"/g, '\\"')}"\n\n`;

    out += `hero:\n`;
    out += `  eyebrow: "${(data.hero?.eyebrow || "个人工作空间 / 2026").replace(/"/g, '\\"')}"\n`;
    out += `  title: "${(data.hero?.title || "想到的，<br />做出来的，<br />留在这里。").replace(/"/g, '\\"')}"\n`;
    out += `  subtitle: "${(data.hero?.subtitle || "").replace(/"/g, '\\"')}"\n`;
    out += `  btn_posts: "${(data.hero?.btn_posts || "看看文章").replace(/"/g, '\\"')}"\n`;
    out += `  btn_files: "${(data.hero?.btn_files || "浏览下载").replace(/"/g, '\\"')}"\n\n`;

    out += `modules:\n`;
    out += `  posts_desc: "${(data.modules?.posts_desc || "").replace(/"/g, '\\"')}"\n`;
    out += `  files_desc: "${(data.modules?.files_desc || "").replace(/"/g, '\\"')}"\n`;
    out += `  about_desc: "${(data.modules?.about_desc || "").replace(/"/g, '\\"')}"\n\n`;

    out += `manifesto:\n`;
    out += `  eyebrow: "${(data.manifesto?.eyebrow || "这个地方").replace(/"/g, '\\"')}"\n`;
    out += `  title: "${(data.manifesto?.title || "不追逐噪音，只留下<br />真正值得留下的东西。").replace(/"/g, '\\"')}"\n`;
    out += `  link_text: "${(data.manifesto?.link_text || "认识 Seven ↗").replace(/"/g, '\\"')}"\n`;
    out += `  link_url: "${(data.manifesto?.link_url || "/about/").replace(/"/g, '\\"')}"\n\n`;

    out += `about:\n`;
    out += `  eyebrow: "${(data.about?.eyebrow || "About Seven").replace(/"/g, '\\"')}"\n`;
    out += `  title: "${(data.about?.title || "关于我").replace(/"/g, '\\"')}"\n`;
    out += `  subtitle: "${(data.about?.subtitle || "").replace(/"/g, '\\"')}"\n`;
    out += `  greeting: "${(data.about?.greeting || "").replace(/"/g, '\\"')}"\n`;
    out += `  intro: "${(data.about?.intro || "").replace(/"/g, '\\"')}"\n`;
    out += `  section1_title: "这里都有什么？"\n`;
    out += `  section1_items:\n`;
    const items = data.about?.section1_items || [
      "**文章**——围绕工具、AI、编程、生活方法论的随笔与笔记。",
      "**下载**——偶尔会用到的脚本、模板、配置资源。",
      "**关于**——就是你现在看的这一页。"
    ];
    for (let it of items) {
      out += `    - "${it.replace(/"/g, '\\"')}"\n`;
    }
    out += `  section2_title: "技术说明"\n`;
    out += `  section2_content: "${(data.about?.section2_content || "").replace(/"/g, '\\"')}"\n`;
    out += `  section3_title: "联系我"\n`;
    out += `  section3_content: "${(data.about?.section3_content || "").replace(/"/g, '\\"')}"\n`;

    return out;
  }

  // Base64 编码解码 (支持 UTF-8 中文字符)
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToUtf8(str) {
    const clean = (str || "").replace(/[\r\n\s]/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  // ---- 模式探测与网络请求抽象层 ----
  async function detectMode() {
    try {
      const res = await fetch("/api/status", { method: "GET" });
      if (res.ok) {
        const d = await res.json();
        if (d.local) {
          state.mode = "local";
          document.getElementById("local-mode-banner").style.display = "block";
          document.getElementById("token-group").style.display = "none";
          document.getElementById("local-sync-card").style.display = "block";
          updateConnectionBadge("🟢 本地模式 (已连接)", true);
          return;
        }
      }
    } catch (e) {
      // 非本地模式
    }

    state.mode = "github";
    document.getElementById("local-mode-banner").style.display = "none";
    document.getElementById("token-group").style.display = "block";
    document.getElementById("local-sync-card").style.display = "none";
    updateConnectionBadge(state.token ? "🌐 云端 GitHub 模式" : "⚠️ 未配置 Token", !!state.token);
  }

  function updateConnectionBadge(label, isOk) {
    const dot = document.getElementById("connection-dot");
    const txt = document.getElementById("connection-label");
    if (dot) dot.className = `status-dot ${isOk ? "online" : "offline"}`;
    if (txt) txt.textContent = label;
  }

  async function ghRequest(endpoint, options = {}) {
    if (!state.token) throw new Error("请先提供 GitHub Personal Access Token！");
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // ================= 认证与登录 =================
  function initAuth() {
    const btnLogin = document.getElementById("btn-login");
    const inputPin = document.getElementById("admin-pin");
    const inputToken = document.getElementById("github-token");
    const authMsg = document.getElementById("auth-msg");

    if (state.token) inputToken.value = state.token;

    const savedPin = localStorage.getItem("seven_admin_pin") || "seven2026";
    const sessionAuth = sessionStorage.getItem("seven_authed");

    if (sessionAuth === "true") {
      enterApp();
    }

    btnLogin.addEventListener("click", async () => {
      authMsg.textContent = "";
      authMsg.className = "auth-msg";

      const enteredPin = inputPin.value.trim();
      const enteredToken = inputToken.value.trim();

      if (enteredPin !== savedPin) {
        authMsg.textContent = "❌ PIN 码不正确，请重新输入（默认：seven2026）";
        authMsg.className = "auth-msg error";
        return;
      }

      if (state.mode === "github") {
        if (!enteredToken) {
          authMsg.textContent = "❌ 请填写 GitHub Token 以获得云端发布权限";
          authMsg.className = "auth-msg error";
          return;
        }

        authMsg.textContent = "⏳ 正在验证 GitHub Token 权限…";
        try {
          state.token = enteredToken;
          const user = await ghRequest("/user");
          localStorage.setItem("seven_gh_token", enteredToken);
          authMsg.textContent = `✅ 验证成功，欢迎 ${user.login}！`;
          authMsg.className = "auth-msg success";
          setTimeout(() => enterApp(), 600);
        } catch (err) {
          authMsg.textContent = `❌ Token 验证失败: ${err.message}`;
          authMsg.className = "auth-msg error";
          return;
        }
      } else {
        enterApp();
      }
    });

    document.getElementById("btn-logout").addEventListener("click", () => {
      sessionStorage.removeItem("seven_authed");
      window.location.reload();
    });
  }

  function enterApp() {
    sessionStorage.setItem("seven_authed", "true");
    document.getElementById("auth-modal").style.display = "none";
    document.getElementById("admin-app").style.display = "flex";
    state.isAuthed = true;
    initTabs();
    loadCurrentTab();
  }

  // ================= 选项卡切换 =================
  function initTabs() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = item.getAttribute("data-tab");
        switchTab(tab);
      });
    });

    const toggleBtn = document.getElementById("btn-toggle-sidebar");
    const sidebar = document.querySelector(".admin-sidebar");
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });
    }
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll(".nav-item").forEach((it) => {
      it.classList.toggle("active", it.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".admin-tab-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `tab-${tabId}`);
    });

    const titles = {
      posts: "文章管理",
      content: "网站文字",
      files: "文件下载",
      sync: "发布与同步",
      settings: "系统设置",
    };
    document.getElementById("page-title").textContent = titles[tabId] || "后台管理";
    loadCurrentTab();
  }

  function loadCurrentTab() {
    if (state.activeTab === "posts") loadPosts();
    else if (state.activeTab === "content") loadContent();
    else if (state.activeTab === "files") loadFiles();
    else if (state.activeTab === "sync") loadDeployStatus();
    else if (state.activeTab === "settings") loadSettings();
  }

  // ================= 功能 1: 文章管理 =================
  async function loadPosts() {
    const tbody = document.getElementById("posts-tbody");
    tbody.innerHTML = `<tr><td colspan="5" class="muted-td">正在加载文章…</td></tr>`;
    setStatus("正在读取文章列表…", "loading");

    try {
      let items = [];
      if (state.mode === "local") {
        const res = await fetch("/api/posts");
        items = await res.json();
      } else {
        const contents = await ghRequest(`/repos/${OWNER}/${REPO}/contents/_posts`);
        items = contents
          .filter((f) => f.name.endsWith(".md"))
          .map((f) => ({
            name: f.name,
            sha: f.sha,
            download_url: f.download_url,
          }));
      }

      state.posts = items;
      renderPostsTable(items);
      setStatus("就绪", "idle");
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" class="muted-td">加载失败: ${e.message}</td></tr>`;
      setStatus("文章加载出错", "error");
    }
  }

  function renderPostsTable(posts) {
    const tbody = document.getElementById("posts-tbody");
    tbody.innerHTML = "";

    if (!posts || posts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted-td">暂无文章，点击右上角“➕ 新建文章”发布！</td></tr>`;
      return;
    }

    posts.sort((a, b) => (a.name < b.name ? 1 : -1));

    posts.forEach((post) => {
      const tr = document.createElement("tr");
      const m = post.name.match(/^(\d{4}-\d{2}-\d{2})-(.*)\.md$/);
      const date = m ? m[1] : "未知";
      const rawTitle = m ? m[2].replace(/-/g, " ") : post.name;

      tr.innerHTML = `
        <td><strong>${post.title || rawTitle}</strong></td>
        <td><code>${post.name}</code></td>
        <td>${post.date || date}</td>
        <td>${(post.categories || []).map((c) => `<span class="cat-badge">${c}</span>`).join("")}</td>
        <td>
          <div class="action-btns">
            <button class="action-link btn-edit-post" data-name="${post.name}">编辑</button>
            <button class="action-link danger btn-del-post" data-name="${post.name}">删除</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-edit-post").forEach((btn) => {
      btn.addEventListener("click", () => editPost(btn.getAttribute("data-name")));
    });

    tbody.querySelectorAll(".btn-del-post").forEach((btn) => {
      btn.addEventListener("click", () => deletePost(btn.getAttribute("data-name")));
    });
  }

  function initPostEditor() {
    const btnNew = document.getElementById("btn-new-post");
    const btnBack = document.getElementById("btn-back-posts");
    const btnSave = document.getElementById("btn-save-post");
    const btnDateNow = document.getElementById("btn-date-now");
    const inputContent = document.getElementById("post-content");
    const preview = document.getElementById("post-preview");
    const wordBadge = document.getElementById("editor-word-count");

    btnNew.addEventListener("click", () => openPostEditor());
    btnBack.addEventListener("click", () => closePostEditor());

    btnDateNow.addEventListener("click", () => {
      document.getElementById("post-date").value = formatNow();
    });

    inputContent.addEventListener("input", () => {
      const text = inputContent.value;
      preview.innerHTML = renderMarkdown(text);
      wordBadge.textContent = `${countWords(text)} 字`;
    });

    document.querySelectorAll(".md-toolbar .tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-md");
        insertMarkdown(action);
      });
    });

    btnSave.addEventListener("click", () => savePost());
  }

  function insertMarkdown(type) {
    const ta = document.getElementById("post-content");
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const sel = text.substring(start, end);

    let before = "";
    let after = "";
    let placeholder = sel || "文本";

    switch (type) {
      case "h2": before = "## "; placeholder = sel || "二级标题"; break;
      case "h3": before = "### "; placeholder = sel || "三级标题"; break;
      case "bold": before = "**"; after = "**"; placeholder = sel || "粗体内容"; break;
      case "italic": before = "*"; after = "*"; placeholder = sel || "斜体内容"; break;
      case "quote": before = "> "; placeholder = sel || "引用文字"; break;
      case "code": before = "`"; after = "`"; placeholder = sel || "代码"; break;
      case "codeblock": before = "```javascript\n"; after = "\n```"; placeholder = sel || "// 代码块"; break;
      case "ul": before = "- "; placeholder = sel || "列表项目"; break;
      case "ol": before = "1. "; placeholder = sel || "列表项目"; break;
      case "link": before = "["; after = "](https://example.com)"; placeholder = sel || "链接文字"; break;
      case "img": before = "!["; after = "](../assets/images/favicon.svg)"; placeholder = sel || "图片描述"; break;
      case "hr": before = "\n---\n"; placeholder = ""; break;
    }

    const replacement = before + placeholder + after;
    ta.value = text.substring(0, start) + replacement + text.substring(end);
    ta.focus();
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + placeholder.length;

    ta.dispatchEvent(new Event("input"));
  }

  function openPostEditor(post = null) {
    document.getElementById("posts-list-view").style.display = "none";
    document.getElementById("post-editor-view").style.display = "block";

    const titleEl = document.getElementById("post-title");
    const slugEl = document.getElementById("post-slug");
    const dateEl = document.getElementById("post-date");
    const catEl = document.getElementById("post-categories");
    const tagEl = document.getElementById("post-tags");
    const contentEl = document.getElementById("post-content");

    if (post) {
      state.editingPostName = post.name;
      state.currentPostSha = post.sha || null;
      titleEl.value = post.title || "";
      slugEl.value = post.slug || "";
      dateEl.value = post.date || formatNow();
      catEl.value = (post.categories || []).join(", ");
      tagEl.value = (post.tags || []).join(", ");
      contentEl.value = post.body || "";
    } else {
      state.editingPostName = null;
      state.currentPostSha = null;
      titleEl.value = "";
      slugEl.value = "";
      dateEl.value = formatNow();
      catEl.value = "随笔";
      tagEl.value = "";
      contentEl.value = "# 你好\n\n欢迎写下新的想法…";
    }

    contentEl.dispatchEvent(new Event("input"));
  }

  function closePostEditor() {
    document.getElementById("post-editor-view").style.display = "none";
    document.getElementById("posts-list-view").style.display = "block";
    loadPosts();
  }

  async function editPost(fileName) {
    setStatus("正在读取文章正文…", "loading");
    try {
      let rawText = "";
      let sha = null;

      if (state.mode === "local") {
        const res = await fetch(`/api/posts?file=${encodeURIComponent(fileName)}`);
        const data = await res.json();
        rawText = data.content;
      } else {
        const data = await ghRequest(`/repos/${OWNER}/${REPO}/contents/_posts/${fileName}`);
        rawText = base64ToUtf8(data.content);
        sha = data.sha;
      }

      const postData = parseFrontMatter(rawText, fileName);
      postData.sha = sha;
      openPostEditor(postData);
      setStatus("就绪", "idle");
    } catch (e) {
      showToast(`读取文章失败: ${e.message}`, "error");
      setStatus("出错", "error");
    }
  }

  function parseFrontMatter(fullText, fileName) {
    let title = "";
    let date = "";
    let categories = [];
    let tags = [];
    let body = fullText;

    const fmMatch = fullText.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const fm = fmMatch[1];
      body = fmMatch[2];

      const titleM = fm.match(/title:\s*(.*)/);
      if (titleM) title = titleM[1].trim().replace(/^["']|["']$/g, "");

      const dateM = fm.match(/date:\s*(.*)/);
      if (dateM) date = dateM[1].trim().replace(/^["']|["']$/g, "");

      const catM = fm.match(/categories:\s*\[?(.*?)\]?$/m);
      if (catM && catM[1]) categories = catM[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));

      const tagM = fm.match(/tags:\s*\[?(.*?)\]?$/m);
      if (tagM && tagM[1]) tags = tagM[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }

    const slugM = fileName.match(/^\d{4}-\d{2}-\d{2}-(.*)\.md$/);
    const slug = slugM ? slugM[1] : fileName.replace(".md", "");

    return { name: fileName, title, slug, date, categories, tags, body };
  }

  async function savePost() {
    const title = document.getElementById("post-title").value.trim();
    let slug = document.getElementById("post-slug").value.trim();
    let dateStr = document.getElementById("post-date").value.trim() || formatNow();
    const categoriesStr = document.getElementById("post-categories").value.trim();
    const tagsStr = document.getElementById("post-tags").value.trim();
    const content = document.getElementById("post-content").value;

    if (!title) {
      showToast("请填写文章标题", "error");
      return;
    }

    if (!slug) {
      slug = "post-" + Date.now();
    }
    slug = slug.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, "-").replace(/-+/g, "-");

    const dateOnly = dateStr.slice(0, 10);
    const newFileName = `${dateOnly}-${slug}.md`;

    const catList = categoriesStr ? categoriesStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const tagList = tagsStr ? tagsStr.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const fullContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${dateStr}
categories: [${catList.map((c) => `"${c}"`).join(", ")}]
tags: [${tagList.map((t) => `"${t}"`).join(", ")}]
---

${content}
`;

    setStatus("正在保存文章并发布…", "loading");
    showToast("正在发布文章…", "info");

    try {
      if (state.mode === "local") {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: newFileName,
            oldFile: state.editingPostName,
            content: fullContent,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const path = `_posts/${newFileName}`;
        const payload = {
          message: `post: ${title}`,
          content: utf8ToBase64(fullContent),
          branch: BRANCH,
        };
        if (state.currentPostSha && state.editingPostName === newFileName) {
          payload.sha = state.currentPostSha;
        }

        await ghRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (state.editingPostName && state.editingPostName !== newFileName && state.currentPostSha) {
          await ghRequest(`/repos/${OWNER}/${REPO}/contents/_posts/${state.editingPostName}`, {
            method: "DELETE",
            body: JSON.stringify({
              message: `post: rename delete ${state.editingPostName}`,
              sha: state.currentPostSha,
              branch: BRANCH,
            }),
          });
        }
      }

      showToast("🎉 文章发布成功！已提交并自动触发构建", "success", 4000);
      setStatus("发布成功", "success");
      closePostEditor();
    } catch (e) {
      showToast(`保存失败: ${e.message}`, "error");
      setStatus("保存失败", "error");
    }
  }

  async function deletePost(fileName) {
    if (!confirm(`确定要删除文章 "${fileName}" 吗？此操作不可撤销。`)) return;
    setStatus("正在删除文章…", "loading");

    try {
      if (state.mode === "local") {
        const res = await fetch(`/api/posts?file=${encodeURIComponent(fileName)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const data = await ghRequest(`/repos/${OWNER}/${REPO}/contents/_posts/${fileName}`);
        await ghRequest(`/repos/${OWNER}/${REPO}/contents/_posts/${fileName}`, {
          method: "DELETE",
          body: JSON.stringify({
            message: `delete post: ${fileName}`,
            sha: data.sha,
            branch: BRANCH,
          }),
        });
      }

      showToast("文章已删除", "success");
      setStatus("删除成功", "success");
      loadPosts();
    } catch (e) {
      showToast(`删除失败: ${e.message}`, "error");
      setStatus("删除失败", "error");
    }
  }

  // ================= 功能 2: 网站文字修改 =================
  async function loadContent() {
    setStatus("正在读取网站文案…", "loading");
    try {
      let yamlText = "";
      if (state.mode === "local") {
        const res = await fetch("/api/content");
        const d = await res.json();
        yamlText = d.content;
      } else {
        const data = await ghRequest(`/repos/${OWNER}/${REPO}/contents/_data/site_content.yml`);
        yamlText = base64ToUtf8(data.content);
        state.contentSha = data.sha;
      }

      const parsed = parseYamlBasic(yamlText);
      state.siteContent = parsed;
      fillContentForm(parsed);
      setStatus("就绪", "idle");
    } catch (e) {
      console.error(e);
      showToast(`读取文字失败: ${e.message}`, "error");
      setStatus("文案读取错误", "error");
    }
  }

  function fillContentForm(d) {
    // 首页
    document.getElementById("txt-hero-eyebrow").value = d.hero?.eyebrow || "";
    document.getElementById("txt-hero-title").value = d.hero?.title || "";
    document.getElementById("txt-hero-subtitle").value = d.hero?.subtitle || "";
    document.getElementById("txt-hero-btn-posts").value = d.hero?.btn_posts || "";
    document.getElementById("txt-hero-btn-files").value = d.hero?.btn_files || "";

    // 模块
    document.getElementById("txt-mod-posts").value = d.modules?.posts_desc || "";
    document.getElementById("txt-mod-files").value = d.modules?.files_desc || "";
    document.getElementById("txt-mod-about").value = d.modules?.about_desc || "";

    // 宣言
    document.getElementById("txt-mani-eyebrow").value = d.manifesto?.eyebrow || "";
    document.getElementById("txt-mani-title").value = d.manifesto?.title || "";
    document.getElementById("txt-mani-link").value = d.manifesto?.link_text || "";

    // 关于
    document.getElementById("txt-about-title").value = d.about?.title || "";
    document.getElementById("txt-about-subtitle").value = d.about?.subtitle || "";
    document.getElementById("txt-about-greeting").value = d.about?.greeting || "";
    document.getElementById("txt-about-intro").value = d.about?.intro || "";
    document.getElementById("txt-about-sec2").value = d.about?.section2_content || "";
    document.getElementById("txt-about-sec3").value = d.about?.section3_content || "";

    // 品牌与页脚
    document.getElementById("txt-site-name").value = d.site?.brand_name || "";
    document.getElementById("txt-site-mark").value = d.site?.brand_mark || "";
    document.getElementById("txt-site-footer").value = d.site?.footer_text || "";
  }

  function collectContentForm() {
    return {
      site: {
        brand_name: document.getElementById("txt-site-name").value.trim(),
        brand_mark: document.getElementById("txt-site-mark").value.trim(),
        footer_text: document.getElementById("txt-site-footer").value.trim(),
      },
      hero: {
        eyebrow: document.getElementById("txt-hero-eyebrow").value.trim(),
        title: document.getElementById("txt-hero-title").value.trim(),
        subtitle: document.getElementById("txt-hero-subtitle").value.trim(),
        btn_posts: document.getElementById("txt-hero-btn-posts").value.trim(),
        btn_files: document.getElementById("txt-hero-btn-files").value.trim(),
      },
      modules: {
        posts_desc: document.getElementById("txt-mod-posts").value.trim(),
        files_desc: document.getElementById("txt-mod-files").value.trim(),
        about_desc: document.getElementById("txt-mod-about").value.trim(),
      },
      manifesto: {
        eyebrow: document.getElementById("txt-mani-eyebrow").value.trim(),
        title: document.getElementById("txt-mani-title").value.trim(),
        link_text: document.getElementById("txt-mani-link").value.trim(),
        link_url: "/about/",
      },
      about: {
        eyebrow: "About Seven",
        title: document.getElementById("txt-about-title").value.trim(),
        subtitle: document.getElementById("txt-about-subtitle").value.trim(),
        greeting: document.getElementById("txt-about-greeting").value.trim(),
        intro: document.getElementById("txt-about-intro").value.trim(),
        section1_title: "这里都有什么？",
        section1_items: state.siteContent?.about?.section1_items,
        section2_title: "技术说明",
        section2_content: document.getElementById("txt-about-sec2").value.trim(),
        section3_title: "联系我",
        section3_content: document.getElementById("txt-about-sec3").value.trim(),
      },
    };
  }

  async function saveContent() {
    setStatus("正在保存整站文字配置…", "loading");
    const updated = collectContentForm();
    const yamlStr = serializeYaml(updated);

    try {
      if (state.mode === "local") {
        const res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: yamlStr }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const payload = {
          message: "update: site_content.yml via admin",
          content: utf8ToBase64(yamlStr),
          branch: BRANCH,
        };
        if (state.contentSha) payload.sha = state.contentSha;

        const res = await ghRequest(`/repos/${OWNER}/${REPO}/contents/_data/site_content.yml`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        state.contentSha = res.content.sha;
      }

      showToast("✨ 整站文字配置已成功保存！GitHub Pages 正在自动构建上线（约需30~45秒），查看前台请按 Ctrl+F5 强制刷新以清除浏览器缓存！", "success", 6000);
      setStatus("已保存(构建中)", "success");
    } catch (e) {
      showToast(`保存失败: ${e.message}`, "error");
      setStatus("保存失败", "error");
    }
  }

  // ================= 功能 3: 文件上传与管理 =================
  async function loadFiles() {
    const tbody = document.getElementById("files-tbody");
    tbody.innerHTML = `<tr><td colspan="5" class="muted-td">正在加载文件列表…</td></tr>`;
    setStatus("正在读取下载文件…", "loading");

    try {
      let items = [];
      if (state.mode === "local") {
        const res = await fetch("/api/files");
        items = await res.json();
      } else {
        const contents = await ghRequest(`/repos/${OWNER}/${REPO}/contents/files`);
        items = contents
          .filter(
            (it) =>
              it.type === "file" &&
              !it.name.toLowerCase().startsWith("readme") &&
              !it.name.startsWith(".") &&
              it.name.toLowerCase() !== "index.html"
          )
          .map((it) => ({
            name: it.name,
            size: it.size,
            download_url: it.download_url,
            sha: it.sha,
          }));
      }

      state.files = items;
      renderFilesTable(items);
      setStatus("就绪", "idle");
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" class="muted-td">加载失败: ${e.message}</td></tr>`;
      setStatus("文件读取失败", "error");
    }
  }

  function renderFilesTable(files) {
    const tbody = document.getElementById("files-tbody");
    tbody.innerHTML = "";

    if (!files || files.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted-td">当前 files/ 目录暂无文件，可通过上方拖拽上传！</td></tr>`;
      return;
    }

    files.forEach((f) => {
      const tr = document.createElement("tr");
      const dlUrl = f.download_url || `../files/${encodeURIComponent(f.name)}`;

      tr.innerHTML = `
        <td><strong>${f.name}</strong></td>
        <td>${formatBytes(f.size)}</td>
        <td>${f.date || "已就绪"}</td>
        <td><a href="${dlUrl}" target="_blank" rel="noopener" class="text-link">点击测试下载 ↗</a></td>
        <td>
          <div class="action-btns">
            <button class="action-link btn-copy-link" data-url="${dlUrl}">复制直链</button>
            <button class="action-link danger btn-del-file" data-name="${f.name}">删除</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-copy-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        navigator.clipboard.writeText(url);
        showToast("已复制文件下载直链到剪贴板！", "success");
      });
    });

    tbody.querySelectorAll(".btn-del-file").forEach((btn) => {
      btn.addEventListener("click", () => deleteFile(btn.getAttribute("data-name")));
    });
  }

  function initFileUpload() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const btnChoose = document.getElementById("btn-choose-file");

    btnChoose.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    ["dragleave", "dragend"].forEach((ev) => {
      dropZone.addEventListener(ev, () => dropZone.classList.remove("dragover"));
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFilesUpload(fileInput.files);
      }
    });
  }

  async function handleFilesUpload(fileList) {
    const pBox = document.getElementById("upload-progress-box");
    const pBar = document.getElementById("upload-progress-bar");
    const pText = document.getElementById("upload-status-text");

    pBox.style.display = "block";

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      pText.textContent = `[${i + 1}/${fileList.length}] 正在上传 ${file.name} (${formatBytes(file.size)})…`;
      pBar.style.width = `${Math.round(((i) / fileList.length) * 100)}%`;

      try {
        if (state.mode === "local") {
          const res = await fetch(`/api/files?name=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: file,
          });
          if (!res.ok) throw new Error(await res.text());
        } else {
          if (file.size > 25 * 1024 * 1024) {
            throw new Error(`文件超过 25MB，GitHub API 云端上传受限。请使用“本地一键后台”模式上传超大文件！`);
          }

          const base64 = await readFileAsBase64(file);
          const cleanBase64 = base64.split(",")[1];

          let sha = null;
          const existing = state.files.find((f) => f.name === file.name);
          if (existing && existing.sha) sha = existing.sha;

          const payload = {
            message: `upload file: ${file.name}`,
            content: cleanBase64,
            branch: BRANCH,
          };
          if (sha) payload.sha = sha;

          await ghRequest(`/repos/${OWNER}/${REPO}/contents/files/${encodeURIComponent(file.name)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }
      } catch (e) {
        showToast(`上传 ${file.name} 出错: ${e.message}`, "error", 5000);
      }
    }

    pBar.style.width = "100%";
    pText.textContent = "上传完成！";
    setTimeout(() => {
      pBox.style.display = "none";
      pBar.style.width = "0%";
    }, 2000);

    showToast("文件上传完成！前台下载页已同步更新", "success");
    loadFiles();
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async function deleteFile(fileName) {
    if (!confirm(`确定要从下载中心删除文件 "${fileName}" 吗？`)) return;
    setStatus("正在删除文件…", "loading");

    try {
      if (state.mode === "local") {
        const res = await fetch(`/api/files?file=${encodeURIComponent(fileName)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const data = await ghRequest(`/repos/${OWNER}/${REPO}/contents/files/${encodeURIComponent(fileName)}`);
        await ghRequest(`/repos/${OWNER}/${REPO}/contents/files/${encodeURIComponent(fileName)}`, {
          method: "DELETE",
          body: JSON.stringify({
            message: `delete file: ${fileName}`,
            sha: data.sha,
            branch: BRANCH,
          }),
        });
      }

      showToast("文件已删除", "success");
      setStatus("删除成功", "success");
      loadFiles();
    } catch (e) {
      showToast(`删除失败: ${e.message}`, "error");
      setStatus("删除失败", "error");
    }
  }

  // ================= 功能 4: 发布与同步 =================
  async function loadDeployStatus() {
    const box = document.getElementById("pages-status-detail");
    box.innerHTML = `<p>正在查询 GitHub Pages 部署信息…</p>`;

    try {
      if (state.mode === "github" && state.token) {
        const builds = await ghRequest(`/repos/${OWNER}/${REPO}/pages/builds/latest`).catch(() => null);
        if (builds) {
          box.innerHTML = `
            <p><strong>最新部署状态:</strong> ${builds.status === "built" ? "🟢 编译成功已上线" : builds.status}</p>
            <p><strong>构建提交 SHA:</strong> <code>${(builds.commit || "").slice(0, 7)}</code></p>
            <p><strong>更新时间:</strong> ${builds.updated_at || builds.created_at}</p>
          `;
        } else {
          box.innerHTML = `<p>已接入 GitHub Pages 自动工作流。修改提交后一般在 30 秒内完成部署。</p>`;
        }
      } else {
        box.innerHTML = `<p>本地模式下，请点击下方“一键推送到 GitHub”同步最新改动。</p>`;
      }
    } catch (e) {
      box.innerHTML = `<p class="muted">无法直接获取部署状态，请点击右侧查看 Actions 运行记录。</p>`;
    }
  }

  function initLocalSync() {
    const btnPush = document.getElementById("btn-git-push");
    const logOutput = document.getElementById("git-log-output");

    if (!btnPush) return;
    btnPush.addEventListener("click", async () => {
      btnPush.disabled = true;
      logOutput.textContent = "🚀 正在执行本地 Git 提交与同步推送 (git add . && git commit && git push)...\n";
      setStatus("正在推送至 GitHub…", "loading");

      try {
        const res = await fetch("/api/git/sync", { method: "POST" });
        const d = await res.json();
        logOutput.textContent += d.output || "完成！\n";
        if (d.success) {
          showToast("🎉 推送成功！GitHub Pages 即将自动上线", "success");
          setStatus("推送完成", "success");
        } else {
          showToast("推送遇到提示，请查看控制台日志", "info");
          setStatus("就绪", "idle");
        }
      } catch (e) {
        logOutput.textContent += `\n❌ 出错: ${e.message}\n`;
        showToast(`推送失败: ${e.message}`, "error");
        setStatus("推送失败", "error");
      } finally {
        btnPush.disabled = false;
      }
    });
  }

  // ================= 功能 5: 系统设置 =================
  function loadSettings() {
    document.getElementById("cfg-pin").value = localStorage.getItem("seven_admin_pin") || "seven2026";
    document.getElementById("cfg-token").value = localStorage.getItem("seven_gh_token") || "";
  }

  function initSettings() {
    document.getElementById("btn-save-settings").addEventListener("click", () => {
      const pin = document.getElementById("cfg-pin").value.trim();
      const token = document.getElementById("cfg-token").value.trim();

      if (pin) localStorage.setItem("seven_admin_pin", pin);
      if (token) localStorage.setItem("seven_gh_token", token);
      state.token = token;

      showToast("设置已保存！", "success");
    });

    document.getElementById("btn-clear-auth").addEventListener("click", () => {
      if (confirm("确定要清除所有本地登录凭据并退出吗？")) {
        localStorage.removeItem("seven_gh_token");
        localStorage.removeItem("seven_admin_pin");
        sessionStorage.removeItem("seven_authed");
        window.location.reload();
      }
    });
  }

  // ---- 格式化工具函数 ----
  function formatBytes(n) {
    if (!Number.isFinite(n)) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatNow() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}:${s} +0800`;
  }

  // ---- 初始化入口 ----
  document.addEventListener("DOMContentLoaded", async () => {
    await detectMode();
    initAuth();
    initPostEditor();
    initFileUpload();
    initLocalSync();
    initSettings();

    document.getElementById("btn-save-content")?.addEventListener("click", saveContent);
    document.getElementById("btn-save-content-bottom")?.addEventListener("click", saveContent);

    document.getElementById("btn-refresh-posts")?.addEventListener("click", loadPosts);
    document.getElementById("btn-refresh-files")?.addEventListener("click", loadFiles);
    document.getElementById("btn-check-deploy")?.addEventListener("click", loadDeployStatus);
  });
})();

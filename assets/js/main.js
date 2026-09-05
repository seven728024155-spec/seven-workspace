// ============================================================
// seven 的工作空间 · 客户端脚本（仅负责 files 列表与首页文件预览）
// posts 列表已由 Jekyll Liquid 在构建时生成
// ============================================================

(function () {
  "use strict";

  const OWNER = "seven728024155-spec";
  const REPO = "seven-workspace";
  const BRANCH = "main";
  const apiBase = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

  // ---- helpers ----
  async function fetchJson(url) {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

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

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function el(tag, attrs = {}) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    });
    return e;
  }

  function setMuted(ul, msg) {
    ul.innerHTML = "";
    ul.appendChild(el("li", { class: "muted", text: msg }));
  }

  function setTableMuted(tbody, colspan, msg) {
    tbody.innerHTML = "";
    const tr = el("tr");
    tr.appendChild(
      el("td", { class: "muted", colspan: String(colspan), text: msg })
    );
    tbody.appendChild(tr);
  }

  // ---- files table (downloads page) ----
  async function loadFiles(targetTbodySelector) {
    const tbody = document.querySelector(targetTbodySelector);
    if (!tbody) return;
    try {
      const items = await fetchJson(`${apiBase}/files`);
      const files = items
        .filter(
          (it) =>
            it.type === "file" &&
            !it.name.toLowerCase().startsWith("readme") &&
            !it.name.startsWith(".") &&
            it.name.toLowerCase() !== "index.html"
        )
        .sort((a, b) => (a.name < b.name ? 1 : -1));
      if (files.length === 0) {
        setTableMuted(tbody, 4, "暂无文件。往 files/ 目录 push 文件即可。");
        return;
      }
      tbody.innerHTML = "";
      files.forEach((f) => {
        const tr = el("tr");
        tr.appendChild(el("td", { text: f.name }));
        tr.appendChild(el("td", { class: "size", text: formatBytes(f.size) }));
        tr.appendChild(
          el("td", {
            class: "date",
            text: formatDate(f.committer?.date || f.date || ""),
          })
        );
        const dlCell = el("td");
        // 用 raw.githubusercontent 直链，浏览器可直接下载
        const dl = el("a", {
          href: f.download_url,
          text: "下载",
          download: f.name,
          target: "_blank",
          rel: "noopener",
        });
        dlCell.appendChild(dl);
        tr.appendChild(dlCell);
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      setTableMuted(tbody, 4, "加载失败，请稍后再试。");
    }
  }

  // ---- homepage latest files preview ----
  async function loadLatestFilesPreview() {
    const ul = document.getElementById("latest-files");
    if (!ul) return;
    try {
      const items = await fetchJson(`${apiBase}/files`);
      const files = items
        .filter((it) => it.type === "file" && !it.name.toLowerCase().startsWith("readme"))
        .sort((a, b) => (a.name < b.name ? 1 : -1))
        .slice(0, 3);
      if (files.length === 0) {
        setMuted(ul, "暂无文件。往 files/ push 即可。");
        return;
      }
      ul.innerHTML = "";
      files.forEach((f) => {
        const li = el("li");
        const a = el("a", {
          href: f.html_url,
          text: f.name,
          target: "_blank",
          rel: "noopener",
        });
        li.appendChild(a);
        li.appendChild(
          el("span", {
            class: "date",
            text: formatBytes(f.size),
          })
        );
        ul.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      setMuted(ul, "暂无内容");
    }
  }

  // ---- bootstrap ----
  document.addEventListener("DOMContentLoaded", () => {
    const isFileList = !!document.getElementById("file-table");
    if (isFileList) loadFiles("#file-table tbody");
    loadLatestFilesPreview();
  });
})();

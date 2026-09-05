const loginPanel = document.getElementById("login-panel");
const workspace = document.getElementById("workspace");
const notice = document.getElementById("notice");

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle("is-error", error);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求未完成，请稍后再试。");
  return data;
}

async function init() {
  try {
    const session = await request("../api/auth/session");
    document.getElementById("account-name").textContent = session.login;
    workspace.hidden = false;
  } catch {
    loginPanel.hidden = false;
  }
}

document.getElementById("post-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  showNotice("正在提交文章…");
  try {
    const data = await request("../api/content/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    showNotice(data.message);
  } catch (error) { showNotice(error.message, true); }
  button.disabled = false;
});

const fileInput = document.querySelector('#file-form input[type="file"]');
fileInput.addEventListener("change", () => { document.getElementById("file-name").textContent = fileInput.files[0]?.name || "尚未选择文件"; });
document.getElementById("file-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return showNotice("文件超过 20 MB，请压缩后再上传。", true);
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  showNotice("正在上传资源…");
  try {
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const data = await request("../api/content/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, base64 }) });
    event.currentTarget.reset(); document.getElementById("file-name").textContent = "尚未选择文件"; showNotice(data.message);
  } catch (error) { showNotice(error.message, true); }
  button.disabled = false;
});

document.getElementById("logout").addEventListener("click", async () => { await fetch("../api/auth/logout", { method: "POST" }); window.location.reload(); });
init();

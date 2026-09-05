const githubBase = "https://api.github.com";
const encoder = new TextEncoder();

function utf8Base64(text) {
  let binary = "";
  encoder.encode(text).forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

export function config(env) {
  const required = ["GITHUB_OWNER", "GITHUB_REPO", "GITHUB_BRANCH"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`缺少 Cloudflare 环境变量：${missing.join(", ")}`);
  return { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH };
}

async function github(url, token, init = {}) {
  const response = await fetch(`${githubBase}${url}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API 返回 ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export async function writeFile(env, token, path, text, message) {
  const { owner, repo, branch } = config(env);
  let sha;
  try {
    sha = (await github(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`, token)).sha;
  } catch (error) {
    if (!String(error.message).includes("404")) throw error;
  }
  return github(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: utf8Base64(text), branch, ...(sha ? { sha } : {}) }),
  });
}

export async function writeBase64File(env, token, path, base64, message) {
  const { owner, repo, branch } = config(env);
  let sha;
  try {
    sha = (await github(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`, token)).sha;
  } catch (error) {
    if (!String(error.message).includes("404")) throw error;
  }
  return github(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: base64, branch, ...(sha ? { sha } : {}) }),
  });
}

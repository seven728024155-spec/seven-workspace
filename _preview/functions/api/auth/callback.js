import { createSession, sessionCookie } from "../../_lib/session.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response("GitHub 未返回授权码。", { status: 400 });
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_REDIRECT_URI, ADMIN_GITHUB_LOGIN, SESSION_SECRET } = context.env;
  if (![GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_REDIRECT_URI, ADMIN_GITHUB_LOGIN, SESSION_SECRET].every(Boolean)) return new Response("后台环境变量未配置完整。", { status: 500 });
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: OAUTH_REDIRECT_URI }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return new Response("GitHub 授权失败，请返回后重试。", { status: 401 });
  const profileResponse = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenData.access_token}` } });
  const profile = await profileResponse.json();
  if (profile.login !== ADMIN_GITHUB_LOGIN) return new Response("这个 GitHub 账号没有本站后台权限。", { status: 403 });
  const session = await createSession({ login: profile.login, token: tokenData.access_token, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }, SESSION_SECRET);
  return new Response(null, { status: 302, headers: { Location: new URL("/admin/", context.request.url).toString(), "Set-Cookie": sessionCookie(session) } });
}

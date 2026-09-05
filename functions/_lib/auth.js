import { readSession } from "./session.js";

export async function requireAdmin(context) {
  if (!context.env.SESSION_SECRET) return { error: "后台尚未配置 SESSION_SECRET。", status: 500 };
  const session = await readSession(context.request, context.env.SESSION_SECRET);
  if (!session) return { error: "请先登录。", status: 401 };
  if (session.login !== context.env.ADMIN_GITHUB_LOGIN) return { error: "当前 GitHub 账号没有后台权限。", status: 403 };
  return { session };
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8", ...headers } });
}

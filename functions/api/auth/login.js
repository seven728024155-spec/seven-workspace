export async function onRequestGet(context) {
  const { GITHUB_CLIENT_ID, OAUTH_REDIRECT_URI } = context.env;
  if (!GITHUB_CLIENT_ID || !OAUTH_REDIRECT_URI) return new Response("后台尚未完成 GitHub OAuth 配置。", { status: 500 });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI);
  url.searchParams.set("scope", "read:user public_repo");
  return Response.redirect(url.toString(), 302);
}

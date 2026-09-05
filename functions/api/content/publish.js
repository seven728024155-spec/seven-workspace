import { requireAdmin, json } from "../../_lib/auth.js";
import { writeFile } from "../../_lib/github.js";

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function escapeYaml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]+/g, " ");
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return json({ error: auth.error }, auth.status);
  try {
    const { title, body, tags = "" } = await context.request.json();
    if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) return json({ error: "标题和正文不能为空。" }, 400);
    if (title.length > 120 || body.length > 100000) return json({ error: "内容过长，请缩短后重试。" }, 400);
    const date = new Date();
    const dateString = date.toISOString().slice(0, 10);
    const slug = slugify(title) || `article-${Date.now()}`;
    const validTags = typeof tags === "string" ? tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8) : [];
    const frontMatter = `---\ntitle: "${escapeYaml(title.trim())}"\ndate: ${date.toISOString().replace("T", " ").replace("Z", " +0000")}\ntags: [${validTags.map((tag) => `"${escapeYaml(tag)}"`).join(", ")}]\n---\n\n`;
    const path = `_posts/${dateString}-${slug}.md`;
    await writeFile(context.env, auth.session.token, path, frontMatter + body.trim() + "\n", `发布文章：${title.trim()}`);
    return json({ ok: true, path, message: "文章已提交，Cloudflare 会在构建完成后自动上线。" });
  } catch (error) {
    return json({ error: `发布失败：${error.message}` }, 500);
  }
}

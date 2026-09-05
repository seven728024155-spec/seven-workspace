import { requireAdmin, json } from "../../_lib/auth.js";
import { writeBase64File } from "../../_lib/github.js";

const MAX_BYTES = 20 * 1024 * 1024;

function safeFilename(name) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/^\.+/, "").slice(0, 120);
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return json({ error: auth.error }, auth.status);
  try {
    const { filename, base64 } = await context.request.json();
    const cleanName = typeof filename === "string" && safeFilename(filename);
    if (!cleanName || !base64 || typeof base64 !== "string") return json({ error: "请选择要上传的文件。" }, 400);
    const byteLength = Math.floor((base64.length * 3) / 4);
    if (byteLength > MAX_BYTES) return json({ error: "单个文件不能超过 20 MB。" }, 400);
    await writeBase64File(context.env, auth.session.token, `files/${cleanName}`, base64.replace(/^data:[^,]+,/, ""), `发布资源：${cleanName}`);
    return json({ ok: true, message: "资源已提交，构建完成后会出现在资源页。" });
  } catch (error) {
    return json({ error: `上传失败：${error.message}` }, 500);
  }
}

import { expiredSessionCookie } from "../../_lib/session.js";
import { json } from "../../_lib/auth.js";

export async function onRequestPost() {
  return json({ ok: true }, 200, { "Set-Cookie": expiredSessionCookie });
}

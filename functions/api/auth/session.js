import { requireAdmin } from "../../_lib/auth.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const result = await requireAdmin(context);
  return result.error ? json({ authenticated: false, error: result.error }, result.status) : json({ authenticated: true, login: result.session.login });
}

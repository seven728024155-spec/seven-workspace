const encoder = new TextEncoder();

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function createSession(payload, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(JSON.stringify(payload)));
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(cipher))}`;
}

export async function readSession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";
  const value = cookie.match(/(?:^|;\s*)seven_session=([^;]+)/)?.[1];
  if (!value) return null;
  const [iv, cipher] = value.split(".");
  if (!iv || !cipher) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(iv) }, await encryptionKey(secret), base64UrlDecode(cipher));
    const session = JSON.parse(new TextDecoder().decode(plain));
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function sessionCookie(value) {
  return `seven_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}

export const expiredSessionCookie = "seven_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

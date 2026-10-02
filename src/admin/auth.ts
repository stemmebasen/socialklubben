import type { D1Database } from "../db.js";

/** One password for the administration (the ADMIN_PASSWORD secret), a signed cookie for 30 days, and ten
 * wrong tries from one address per quarter of an hour. Ported from Hjerterum's board cockpit. Changing the
 * password signs everyone out. */

export const SESSION_COOKIE = "portal_admin";
export const SESSION_DAYS = 30;
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60_000;
const encoder = new TextEncoder();

const base64url = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function key(purpose: string, secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(`portal-admin:${purpose}:${secret}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
const sign = async (purpose: string, secret: string, value: string) => base64url(await crypto.subtle.sign("HMAC", await key(purpose, secret), encoder.encode(value)));

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function passwordMatches(given: string, password: string): Promise<boolean> {
  const [a, b] = await Promise.all([sign("compare", "fixed", given), sign("compare", "fixed", password)]);
  return sameText(a, b);
}

export async function sessionValue(password: string, nowMs: number): Promise<string> {
  const expires = String(nowMs + SESSION_DAYS * 86_400_000);
  return `${expires}.${await sign("session", password, expires)}`;
}

export async function validSession(password: string | undefined, value: string | undefined, nowMs: number): Promise<boolean> {
  if (!password || !value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) <= nowMs) return false;
  return sameText(signature, await sign("session", password, expires));
}

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) {
      try { return decodeURIComponent(part.slice(at + 1).trim()); } catch { return undefined; }
    }
  }
  return undefined;
}

export const cookie = (name: string, value: string, maxAgeSeconds: number, secure: boolean) =>
  `${name}=${encodeURIComponent(value)}; Path=/admin; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

async function bucket(request: Request, nowMs: number): Promise<string> {
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const digest = base64url(await crypto.subtle.digest("SHA-256", encoder.encode(`portal-ip:${address}`))).slice(0, 16);
  return `${digest}:${Math.floor(nowMs / WINDOW_MS)}`;
}

export async function loginBlocked(db: D1Database, request: Request, nowMs: number): Promise<boolean> {
  const row = await db.prepare("SELECT attempts FROM login_attempts WHERE bucket = ?").bind(await bucket(request, nowMs)).first<{ attempts: number }>();
  return (row?.attempts ?? 0) >= MAX_FAILURES;
}

export async function recordFailedLogin(db: D1Database, request: Request, nowMs: number): Promise<void> {
  await db.prepare("INSERT INTO login_attempts (bucket, attempts, at_ms) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1, at_ms = excluded.at_ms")
    .bind(await bucket(request, nowMs), nowMs).run();
  await db.prepare("DELETE FROM login_attempts WHERE at_ms < ?").bind(nowMs - 24 * 3_600_000).run();
}

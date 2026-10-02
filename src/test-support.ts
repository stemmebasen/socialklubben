import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { D1Database, D1PreparedStatement } from "./db.js";
import type { Deps, Env } from "./env.js";

/** A D1-shaped database over SQLite with every real migration applied. */
export function testDatabase(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const dir = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
  return {
    prepare(query: string): D1PreparedStatement {
      const statement = sqlite.prepare(query);
      let values: unknown[] = [];
      const api: D1PreparedStatement = {
        bind(...next: unknown[]) { values = next; return api; },
        async first<T>() { return (statement.get(...values) as T | undefined) ?? null; },
        async all<T>() { return { results: statement.all(...values) as T[], success: true }; },
        async run() { const r = statement.run(...values); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
      };
      return api;
    }
  };
}

export const NOW = Date.parse("2026-10-01T10:00:00Z");

/** Fetches answered from a map of URL -> body (or a function); anything else is a 404. */
export function fakeWeb(routes: Record<string, string | ((url: string) => Response)>) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = String(input);
    calls.push(url);
    for (const [prefix, answer] of Object.entries(routes)) {
      if (url === prefix || url.startsWith(prefix)) return typeof answer === "function" ? answer(url) : new Response(answer);
    }
    return new Response("not found", { status: 404 });
  };
  return { fetcher, calls };
}

export const testDeps = (fetcher: typeof fetch, now = NOW): Deps => ({ fetcher, now: () => now, sleep: async () => undefined });
export const testEnv = (db: D1Database, extra: Partial<Env> = {}): Env => ({ DB: db, ADMIN_PASSWORD: "hemmelig-test", SITE_NAME: "Eventportal", ...extra });

/** The part of Cloudflare D1 the portal uses; tests run the same SQL on node:sqlite (test-support.ts). */
export interface D1Result<T = unknown> { results?: T[]; success?: boolean; meta?: { changes?: number; last_row_id?: number } }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1Database { prepare(query: string): D1PreparedStatement }

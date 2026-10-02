import { handle } from "./app.js";
import type { Env } from "./env.js";
import { geocodePending } from "./geocode.js";
import { runSourceSync } from "./sources.js";

const deps = () => ({ fetcher: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init), now: () => Date.now(), sleep: (ms: number) => new Promise<void>(done => setTimeout(done, ms)) });

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, deps());
  },
  /** Every quarter of an hour: each calendar is read once an hour, and a few new places are found. */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await runSourceSync(env, deps()).catch(error => console.warn("source_sync_failed", error instanceof Error ? error.message : error));
    await geocodePending(env, deps()).catch(error => console.warn("geocode_failed", error instanceof Error ? error.message : error));
  }
};

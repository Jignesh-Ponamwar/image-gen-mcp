import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

declare global {
  var __imageGenRateLimit: Map<string, { windowStart: number; count: number }> | undefined;
}

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMcpServer } from "./mcp-server.js";
import { getEnv } from "./lib/utils.js";

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono();

// 1. CORS — must be first so OPTIONS preflight is always handled
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "X-MCP-Protocol"],
    exposeHeaders: ["Mcp-Session-Id", "X-MCP-Protocol"],
  })
);

// 2. Health check — no auth required
app.get("/health", (c) =>
  c.json({ status: "ok", version: "3.2.0", name: "image-gen-mcp" })
);

// 3. Auth middleware — runs after CORS so OPTIONS is not blocked
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS" || c.req.path === "/health") {
    return next();
  }

  // Basic in-memory rate limiter (per-token or per-ip)
  try {
    const windowMs = Number(getEnv(c.env, "MCP_RATE_LIMIT_WINDOW_MS") || 60_000);
    const maxRequests = Number(getEnv(c.env, "MCP_RATE_LIMIT_REQUESTS") || 60);
    const token = c.req.query("token") || c.req.header("Authorization") || "";
    const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
    const key = token ? `token:${token}` : `ip:${ip}`;

    if (!globalThis.__imageGenRateLimit) {
      (globalThis as any).__imageGenRateLimit = new Map<string, { windowStart: number; count: number }>();
    }

    const store: Map<string, { windowStart: number; count: number }> = (globalThis as any).__imageGenRateLimit;
    const now = Date.now();
    const entry = store.get(key) || { windowStart: now, count: 0 };
    if (now - entry.windowStart > windowMs) {
      entry.windowStart = now;
      entry.count = 0;
    }
    entry.count += 1;
    store.set(key, entry);
    if (entry.count > maxRequests) {
      return c.json({ error: "Too Many Requests" }, 429);
    }
  } catch (e) {
    // Fail open on limiter errors to avoid blocking legitimate traffic
    console.error("Rate limiter error:", e instanceof Error ? e.message : e);
  }

  const authToken = getEnv(c.env, "MCP_AUTH_TOKEN");
  if (authToken) {
    const authHeader = c.req.header("Authorization");
    const queryToken = c.req.query("token");
    if (authHeader !== `Bearer ${authToken}` && queryToken !== authToken) {
      return c.json({ error: "Unauthorized: invalid or missing token." }, 401);
    }
  }

  // Origin allowlist enforcement (optional)
  const allowed = getEnv(c.env, "MCP_ALLOWED_ORIGINS");
  if (allowed) {
    const allowedList = allowed.split(",").map((s: string) => s.trim()).filter(Boolean);
    const origin = c.req.header("Origin");
    if (origin && !allowedList.includes(origin)) {
      return c.json({ error: "Forbidden: origin not allowed." }, 403);
    }
  }

  return next();
});

// 4. MCP handler
//    KEY FIX: Create a FRESH McpServer + transport per request.
//    McpServer.connect() can only be called once per instance.
//    Reusing the same server across requests causes Internal Server Errors.
app.all("*", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session pinning required
  });

  // Fresh server instance for this request — safe to connect()
  const server = createMcpServer();
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(c.req.raw, {
      authInfo: c.env as any, // Pass CF bindings so tools can read secrets
    });
    // Set Access-Control-Allow-Origin to the request origin when an allowlist is configured,
    // otherwise leave the default '*' from the CORS middleware.
    const allowed = getEnv(c.env, "MCP_ALLOWED_ORIGINS");
    const origin = (c.req.header("Origin") || "");
    if (allowed && origin) {
      const allowedList = allowed.split(",").map((s: string) => s.trim()).filter(Boolean);
      if (allowedList.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }
    }
    return response;
  } catch (err: any) {
    // Redact detailed error objects to avoid leaking sensitive content
    const safeMessage = err?.message ? String(err.message) : "Internal server error";
    console.error(`[MCP] Request error: ${safeMessage}`);
    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }
    return c.json({ error: `MCP request failed: ${safeMessage}` }, 500);
  }
});

// ============================================================================
// Cloudflare Worker entry point
// ============================================================================
export default {
  fetch: app.fetch,
};

// ============================================================================
// Local stdio support (Node.js / npx mcp-inspector via stdio)
// ============================================================================
if (
  typeof process !== "undefined" &&
  (process.env.MCP_TRANSPORT === "stdio" || process.stdin?.isTTY)
) {
  (async () => {
    const transport = new StdioServerTransport();
    const server = createMcpServer();
    await server.connect(transport);
    console.error("[Image Gen MCP] Stdio transport ready.");
  })().catch((err) => {
    console.error("[Image Gen MCP] Fatal stdio error:", err);
    process.exit(1);
  });
}

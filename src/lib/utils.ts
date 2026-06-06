/**
 * Helper to get environment variables from various contexts.
 * Supports: Hono context (c.env), MCP SDK extra (extra.authInfo),
 * Cloudflare Worker bindings, and process.env for local dev.
 */
export function getEnv(context: any, key: string): string | undefined {
  // MCP SDK passes env vars through authInfo
  if (context?.authInfo?.[key]) return context.authInfo[key];
  // Hono context wraps CF bindings under c.env
  if (context?.env?.[key]) return context.env[key];
  // Direct object access (when context IS the env object)
  if (context?.[key] && typeof context[key] === "string") return context[key];
  // Local development / Node.js process env
  if (typeof process !== "undefined" && process.env?.[key]) return process.env[key];
  return undefined;
}

/**
 * Validate that a string is a reachable image URL (basic check).
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

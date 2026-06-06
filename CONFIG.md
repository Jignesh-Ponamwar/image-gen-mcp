# Configuration Reference - Image Gen MCP Server

Complete environment variable reference for the Marketing Creative MCP Server.

## Overview

Configuration is managed through environment variables. This allows the same codebase to work across development, staging, and production with different settings per environment.

---

## Required Configuration

### `OPENROUTER_API_KEY`

**Type:** String (API Key)  
**Format:** `sk-or-v1-*`  
**Required:** Yes  
**Description:** API key for OpenRouter to access Google Gemini/Imagen and OpenAI image generation models.

**Setup:**
1. Create account at [OpenRouter.ai](https://openrouter.ai/)
2. Navigate to API keys section
3. Generate new key (copy immediately — not shown again)
4. Store securely

**Local Development:**
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

**Cloudflare Workers:**
```bash
npx wrangler secret put OPENROUTER_API_KEY
# Paste your key when prompted
```

**GitHub Actions:**
1. Go to Repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `OPENROUTER_API_KEY`
4. Value: Your OpenRouter API key
5. Click "Add secret"

---

### `MCP_AUTH_TOKEN`

**Type:** String (Bearer Token)  
**Format:** Minimum 32 characters (alphanumeric + symbols recommended)  
**Required:** Yes  
**Description:** Authentication token for securing HTTP requests to MCP endpoints.

**Recommendations:**
- Generate with strong randomness: `openssl rand -base64 32`
- Use different tokens for dev/staging/production
- Rotate tokens periodically (every 3-6 months)
- Store in secret manager (GitHub Secrets, Cloudflare Secrets, etc.)

**Example Generation:**
```bash
# macOS / Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))
```

**Storage:**

*Local Development:*
```bash
export MCP_AUTH_TOKEN="your-generated-token-here"
```

*Cloudflare Workers:*
```bash
npx wrangler secret put MCP_AUTH_TOKEN
```

*GitHub Actions:*
Same process as `OPENROUTER_API_KEY` above.

---

## Optional Configuration

All optional variables have sensible defaults. Override only if needed.

### `NODE_ENV`

**Type:** Enum (`development` | `production` | `staging`)  
**Default:** `development`  
**Description:** Controls logging verbosity, error handling, and feature flags.

**Behavior:**
- `development`: Full error stacks logged, all features enabled
- `staging`: Reduced logging, most features enabled
- `production`: Minimal logging, strict error redaction

```bash
NODE_ENV=production
```

---

### `LOG_LEVEL`

**Type:** Enum (`debug` | `info` | `warn` | `error`)  
**Default:** `info`  
**Description:** Controls which log messages are output.

**Behavior:**
| Level | Includes |
|-------|----------|
| `debug` | All messages (dev only) |
| `info` | Info, warn, error messages |
| `warn` | Warn, error messages only |
| `error` | Error messages only |

```bash
LOG_LEVEL=info
```

---

### `MCP_ALLOWED_ORIGINS`

**Type:** String (comma-separated URLs with optional wildcards)  
**Default:** `*` (unrestricted — NOT for production)  
**Description:** Restricts CORS requests to specified origins.

**Format:** Comma-separated list of origins
- Exact match: `https://claude.ai`
- Wildcard subdomain: `https://*.example.com`
- Multiple: `https://claude.ai,https://*.internal.example.com`

**Production Setup:**

```bash
# For Claude.ai + internal apps
MCP_ALLOWED_ORIGINS="https://claude.ai,https://*.internal.example.com"

# For internal apps only
MCP_ALLOWED_ORIGINS="https://chat.internal.example.com,https://api.internal.example.com"
```

**Development (Testing):**
```bash
# Default — unrestricted
MCP_ALLOWED_ORIGINS="*"
# or leave unset
```

---

### `MCP_ALLOWED_IMAGE_HOSTS`

**Type:** String (comma-separated domain names with optional wildcards)  
**Default:** (empty — allows any HTTPS domain)  
**Description:** Restricts image fetching to specified CDN/hosts (SSRF mitigation).

**Format:** Comma-separated list of hostnames
- Exact match: `cdn.example.com`
- Wildcard subdomain: `*.images.example.com`
- Multiple: `cdn1.example.com,cdn2.example.com,*.internal.images.com`

**Production Setup:**

```bash
# Restrict to company CDN
MCP_ALLOWED_IMAGE_HOSTS="cdn.company.com,images.company.com"

# Allow internal image services
MCP_ALLOWED_IMAGE_HOSTS="*.images.internal.company.com,cdn.internal.company.com"
```

**Development (Testing):**
```bash
# Leave unset to allow any HTTPS domain (default)
# Or specify test domains:
MCP_ALLOWED_IMAGE_HOSTS="example.com,test-images.com"
```

---

### `MCP_RATE_LIMIT_WINDOW_MS`

**Type:** Integer (milliseconds)  
**Default:** `60000` (1 minute)  
**Description:** Time window for rate limit calculation.

**Examples:**
```bash
# 1 minute window (default)
MCP_RATE_LIMIT_WINDOW_MS=60000

# 5 minute window
MCP_RATE_LIMIT_WINDOW_MS=300000

# 30 second window
MCP_RATE_LIMIT_WINDOW_MS=30000
```

---

### `MCP_RATE_LIMIT_REQUESTS`

**Type:** Integer  
**Default:** `60`  
**Description:** Maximum requests allowed per window per token/IP.

**Examples:**
```bash
# Default: 60 requests per minute
MCP_RATE_LIMIT_REQUESTS=60

# Stricter: 30 requests per minute
MCP_RATE_LIMIT_REQUESTS=30

# Relaxed: 120 requests per minute
MCP_RATE_LIMIT_REQUESTS=120
```

**Recommendations:**
- Development: 100-500 per window
- Staging: 60-100 per window
- Production: 20-60 per window (depends on usage)

---

### `MCP_MAX_IMAGE_BYTES`

**Type:** Integer (bytes)  
**Default:** `5242880` (5 MB)  
**Description:** Maximum size for downloaded product images (SSRF & resource limit mitigation).

**Examples:**
```bash
# 5 MB (default)
MCP_MAX_IMAGE_BYTES=5242880

# 2 MB (stricter)
MCP_MAX_IMAGE_BYTES=2097152

# 10 MB (relaxed)
MCP_MAX_IMAGE_BYTES=10485760
```

---

### `MCP_FETCH_TIMEOUT_MS`

**Type:** Integer (milliseconds)  
**Default:** `10000` (10 seconds)  
**Description:** Maximum time to wait for image download before aborting.

**Examples:**
```bash
# 10 seconds (default)
MCP_FETCH_TIMEOUT_MS=10000

# 5 seconds (stricter)
MCP_FETCH_TIMEOUT_MS=5000

# 30 seconds (relaxed, high latency networks)
MCP_FETCH_TIMEOUT_MS=30000
```

---

## Environment Profiles

### Development Profile

For local development with maximum flexibility:

```bash
# .env.local
NODE_ENV=development
LOG_LEVEL=debug
OPENROUTER_API_KEY=sk-or-v1-...
MCP_AUTH_TOKEN=dev-token-32-chars-min
# Leave CORS and host allowlists unset for local testing
```

### Staging Profile

For pre-production testing with security checks:

```bash
# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
OPENROUTER_API_KEY=sk-or-v1-...
MCP_AUTH_TOKEN=staging-token-32-chars-min
MCP_ALLOWED_ORIGINS=https://staging.internal.example.com,https://*.staging.example.com
MCP_ALLOWED_IMAGE_HOSTS=staging-cdn.example.com,*.images.staging.example.com
MCP_RATE_LIMIT_REQUESTS=100
```

### Production Profile

For production deployment with maximum security:

```bash
# wrangler secret put (never in .env)
OPENROUTER_API_KEY=sk-or-v1-... (via secret)
MCP_AUTH_TOKEN=... (via secret, rotated regularly)

# wrangler.toml [vars] section
NODE_ENV=production
LOG_LEVEL=warn
MCP_ALLOWED_ORIGINS=https://claude.ai,https://api.company.com
MCP_ALLOWED_IMAGE_HOSTS=cdn.company.com,images.company.com
MCP_RATE_LIMIT_WINDOW_MS=60000
MCP_RATE_LIMIT_REQUESTS=40
MCP_MAX_IMAGE_BYTES=3145728
MCP_FETCH_TIMEOUT_MS=8000
```

---

## Cloudflare Workers Configuration

For production on Cloudflare Workers, secrets and environment variables are configured separately:

### Secrets (via `wrangler secret put`)

```bash
# Secrets never appear in wrangler.toml
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put MCP_AUTH_TOKEN
npx wrangler secret put CF_API_TOKEN  # For CI/CD
```

### Environment Variables (in `wrangler.toml`)

```toml
[env.production]
vars = { 
  NODE_ENV = "production",
  LOG_LEVEL = "warn",
  MCP_ALLOWED_ORIGINS = "https://claude.ai",
  MCP_ALLOWED_IMAGE_HOSTS = "cdn.company.com",
  MCP_RATE_LIMIT_REQUESTS = "40"
}

[env.staging]
vars = {
  NODE_ENV = "staging",
  LOG_LEVEL = "info",
  MCP_ALLOWED_ORIGINS = "https://staging.internal.example.com"
}
```

Deploy to specific environment:
```bash
npx wrangler deploy --env production
npx wrangler deploy --env staging
```

---

## GitHub Actions Secrets

For CI/CD pipeline, add these secrets to your GitHub repository:

1. `OPENROUTER_API_KEY` — Your OpenRouter API key
2. `MCP_AUTH_TOKEN` — MCP authentication token
3. `CF_API_TOKEN` — Cloudflare API token (for deployment)

See [DEPLOYMENT.md](DEPLOYMENT.md) for setup instructions.

---

## Best Practices

### Secrets Management

- ✅ Use Cloudflare Secrets for production keys
- ✅ Use GitHub Actions Secrets for CI/CD
- ✅ Never commit `.env` files with secrets
- ✅ Rotate tokens every 3-6 months
- ✅ Use unique tokens per environment
- ✅ Use strong token generation (openssl rand)

### CORS Configuration

- ✅ Restrict to specific origins in production
- ✅ Use wildcard domains carefully (e.g., `https://*.internal.com` only)
- ✅ Default to `"*"` only during development
- ✅ Review allowlist with security team before production

### Image Host Configuration

- ✅ Restrict to trusted CDNs/hosts in production
- ✅ Use company CDN for product images
- ✅ Monitor for unauthorized hosts in logs
- ✅ Update allowlist when adding new image sources

### Rate Limiting

- ✅ Adjust limits based on usage patterns
- ✅ Monitor rate limit hits in logs
- ✅ Increase limits for partners/services
- ✅ Decrease limits if cost becomes concern

---

## Troubleshooting

### "OPENROUTER_API_KEY is not configured"
```bash
# Check if secret exists in Cloudflare
npx wrangler secret list

# If missing, add it
npx wrangler secret put OPENROUTER_API_KEY
```

### "Unauthorized: invalid or missing token"
```bash
# Verify MCP_AUTH_TOKEN is set correctly
# Make sure to use Bearer prefix in requests:
curl -H "Authorization: Bearer your-token" https://...
```

### "Image host not allowed"
```bash
# Check MCP_ALLOWED_IMAGE_HOSTS configuration
# Verify domain is in allowlist
# Check logs for rejected domains
```

### Rate limit rejected
```bash
# Check current limits
MCP_RATE_LIMIT_WINDOW_MS=60000  # 1 minute
MCP_RATE_LIMIT_REQUESTS=60       # 60 requests/minute

# Increase if needed
MCP_RATE_LIMIT_REQUESTS=120
```

---

## See Also

- [README.md](README.md) — Project overview
- [SETUP.md](SETUP.md) — Installation and setup
- [SECURITY.md](SECURITY.md) — Security hardening guide
- [OPERATIONS.md](OPERATIONS.md) — Operational procedures
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment checklist
- [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) — Production roadmap

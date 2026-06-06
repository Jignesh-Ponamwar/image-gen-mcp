# Security Hardening Guide - Image Gen MCP Server

Comprehensive security guidelines for deploying the Marketing Creative MCP Server in production.

## Overview

This document outlines security best practices, threat mitigation strategies, and hardening recommendations for the Image Gen MCP Server. Follow these guidelines before deploying to production.

---

## Risk Profile

### Threats & Mitigations

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| Unauthorized API access | High | Token-based auth + CORS allowlist |
| SSRF via image URLs | High | Host allowlist + size limits + timeout |
| API key leakage | Critical | Secrets management + redacted logging |
| Rate limit bypass | Medium | KV-backed distributed rate limiting |
| Prompt injection | Low-Medium | Input validation + prompt length limits |
| Data exfiltration | Low | Minimal data retention + TLS encryption |

---

## Authentication & Authorization

### Token-Based Authentication

All HTTP requests to MCP endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer your-mcp-auth-token" https://...
```

**Token Generation:**

Generate strong tokens using cryptographic randomness:

```bash
# macOS / Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))

# Online (development only)
https://openssl-utils.com/base64-generator
```

**Requirements:**
- Minimum 32 characters
- Alphanumeric + symbols (special characters recommended)
- Generated from cryptographically secure random source
- Never hardcoded in source code

### Token Management

**Storage:**
- ✅ GitHub Actions Secrets (CI/CD)
- ✅ Cloudflare Secrets (production)
- ✅ Vault/SecretManager (enterprise)
- ❌ Environment files (.env)
- ❌ Source code comments

**Rotation:**
- Rotate tokens every 3-6 months
- Generate new token before rotation
- Update all clients simultaneously
- Revoke old token after grace period

**Per-Environment Tokens:**
- Development: Single token for local testing
- Staging: Separate token
- Production: Separate token (rotate more frequently)

---

## CORS (Cross-Origin Resource Sharing)

### Configuration

By default, CORS allows `origin: "*"` (unrestricted). For production, restrict to known origins:

**Production Setup:**

```bash
MCP_ALLOWED_ORIGINS="https://claude.ai,https://api.company.com"
```

**Advanced Patterns:**

```bash
# Wildcard subdomain (only for internal domains)
MCP_ALLOWED_ORIGINS="https://*.internal.company.com"

# Multiple specific origins
MCP_ALLOWED_ORIGINS="https://claude.ai,https://chat.company.com,https://app.company.com"

# Development (unrestricted)
# Leave unset or set to "*"
MCP_ALLOWED_ORIGINS="*"
```

### Verification

Test CORS with curl:

```bash
# Test preflight request
curl -i -X OPTIONS https://your-mcp-server.workers.dev/image-gen \
  -H "Origin: https://claude.ai" \
  -H "Access-Control-Request-Method: POST"

# Should return:
# Access-Control-Allow-Origin: https://claude.ai
# Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE
```

---

## Image Host Allowlist (SSRF Prevention)

### Overview

Server-Side Request Forgery (SSRF) attacks use image fetching to probe internal networks. Prevent with host allowlisting:

**Without allowlist (VULNERABLE):**
```
User → Claude → MCP Server → fetch("http://internal-service.local/admin")
                              ↓ (exposed internal services)
```

**With allowlist (SECURED):**
```
User → Claude → MCP Server → validate host → fetch or reject
```

### Configuration

**Production Setup:**

```bash
# Restrict to company CDNs
MCP_ALLOWED_IMAGE_HOSTS="cdn.company.com,images.company.com"

# With wildcard subdomains
MCP_ALLOWED_IMAGE_HOSTS="*.cdn.company.com,images.company.com"

# Multiple CDNs
MCP_ALLOWED_IMAGE_HOSTS="cdn1.company.com,cdn2.vendor.com,images.company.com"
```

**Development Setup:**

```bash
# Leave unset for testing any domain
# Or allow specific test domains:
MCP_ALLOWED_IMAGE_HOSTS="example.com,test-images.com,localhost"
```

### Recommended Hosts

**Company-owned CDNs:**
```bash
MCP_ALLOWED_IMAGE_HOSTS="cdn.company.com,images.company.com,media.company.com"
```

**Third-party CDNs (trusted vendors):**
```bash
# Add only vendors you trust
MCP_ALLOWED_IMAGE_HOSTS="d1234567890.cloudfront.net,images.yourvendor.com"
```

**Internal networks (only for private deployments):**
```bash
# Never allow private IP ranges or localhost in production
# Only in staging/development
MCP_ALLOWED_IMAGE_HOSTS="internal-images.company.local"
```

### Blocked by Default

These are always rejected (cannot be allowlisted):
- Private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1/8`
- Link-local: `169.254.0.0/16`
- Multicast: `224.0.0.0/4`

---

## Image Fetch Security

### Size Limits

Prevent resource exhaustion attacks:

```bash
# Default: 5 MB
MCP_MAX_IMAGE_BYTES=5242880

# Production recommendation: 2-3 MB
MCP_MAX_IMAGE_BYTES=2097152

# Monitoring: Alert if approaching limit
```

### Timeout Protection

Prevent slowloris-style attacks:

```bash
# Default: 10 seconds
MCP_FETCH_TIMEOUT_MS=10000

# Production recommendation: 5-8 seconds
MCP_FETCH_TIMEOUT_MS=5000
```

### MIME Type Validation

Only accepted image types:
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

Validation happens at two levels:
1. Content-Type header check
2. Magic byte validation (file signature)

---

## Secrets Management

### API Keys

**OpenRouter API Key:**
- Store in Cloudflare Secrets: `npx wrangler secret put OPENROUTER_API_KEY`
- Never commit to git
- Rotate quarterly
- Use read-only keys if OpenRouter supports scoping
- Monitor usage for anomalies

**MCP Auth Token:**
- Generate with: `openssl rand -base64 32`
- Store in Cloudflare Secrets: `npx wrangler secret put MCP_AUTH_TOKEN`
- Rotate every 3-6 months
- Use unique token per environment

### Logging Redaction

Automatically redacts sensitive data in logs:

```typescript
// Redacted patterns:
- "sk-*" (API keys)
- "Bearer ..." (auth tokens)
- "Authorization: ..." (headers)
- "?api_key=..." (URL parameters)
- "token=..." (URL parameters)
```

**Verification:**
```bash
# Check logs for accidental secret exposure
npx wrangler tail --follow
# Look for any unredacted keys (should see [REDACTED])
```

### Secret Rotation Procedure

1. **Generate new token:**
   ```bash
   openssl rand -base64 32
   ```

2. **Update secret:**
   ```bash
   npx wrangler secret put MCP_AUTH_TOKEN
   # Paste new token when prompted
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Verify:**
   ```bash
   curl -H "Authorization: Bearer new-token" https://your-server.workers.dev/health
   ```

5. **Update clients** (after verification)

6. **Document rotation** in change log

---

## Rate Limiting

### Overview

Prevents abuse, DoS attacks, and cost explosion:

**Configuration:**

```bash
# 1-minute window, 60 requests maximum
MCP_RATE_LIMIT_WINDOW_MS=60000
MCP_RATE_LIMIT_REQUESTS=60

# Can be per-token or per-IP
# Uses Cloudflare KV for distributed tracking
```

### Limits by Environment

| Environment | Window | Requests | Rationale |
|-------------|--------|----------|-----------|
| Development | 60s | 500 | Fast iteration |
| Staging | 60s | 100 | Integration testing |
| Production | 60s | 40 | Cost control + abuse prevention |

### Monitoring

Check rate limit hits in logs:

```bash
# View logs with rate limit rejections
npx wrangler tail --follow | grep "429\|rate.limit"

# Should see entries like:
# [warn] Rate limit exceeded for token:abc123... 61/60 requests
```

---

## Input Validation

### Prompt Validation

**Length Limits:**
```bash
# Current: 1000 characters (reduced from 2000)
# Prevents prompt injection and excessive API costs
```

**Character Restrictions:**
- Allows: alphanumeric, spaces, punctuation
- Blocks: excessive special characters, binary data
- Sanitizes: whitespace normalization

### URL Validation

**Requirements:**
- Must be HTTPS (no HTTP)
- Must be valid URL syntax
- Must pass allowlist check (if configured)
- Must be reachable with 10s timeout
- Must be under size limit (5 MB default)

### Model Whitelist

Only approved models allowed:

```bash
# Approved models
- google/gemini-2.5-flash-image
- openai/gpt-5.4-image-2

# Invalid model request → error
{
  "error": "Model not approved. Use one of: ..."
}
```

---

## Error Handling

### Production Error Messages

Errors return safe, non-leaky messages:

**User sees:**
```json
{
  "error": "Image generation failed. Please try again."
}
```

**Logs contain:**
```json
{
  "error": "OpenRouter API error (401): Invalid API key",
  "context": "image_gen_gemini",
  "timestamp": "2025-06-07T10:30:00Z"
}
```

### Stack Traces

- ✅ Shown in development logs
- ✅ Sent to monitoring service
- ❌ Never returned to client
- ❌ Never logged with full details in production

---

## Monitoring & Alerting

### Key Metrics to Monitor

```
1. Error Rate
   - Target: <1% 
   - Alert: >5%
   
2. Rate Limit Hits
   - Target: <5% of requests
   - Alert: >20% 
   
3. Image Fetch Failures
   - Target: <5%
   - Alert: >10%
   
4. Average Response Time
   - Target: <2s
   - Alert: >5s
   
5. API Key Rejections
   - Target: 0
   - Alert: >0 (immediate)
```

### Log Analysis

Use Cloudflare Logpush + external tool (Datadog, Splunk, etc.):

```bash
# Example: Count 401 errors
logs | filter status=401 | stats count
# Should be near zero (indicates token issues)

# Example: Find slow requests
logs | filter duration>3000 | stats count
# Indicates performance issue

# Example: Search for redacted tokens
logs | filter error contains "Bearer" 
# Should be empty (verify redaction works)
```

---

## Deployment Checklist

Before production deployment, verify:

- [ ] CORS allowlist configured (not "*")
- [ ] Image host allowlist configured
- [ ] MCP_AUTH_TOKEN is strong (32+ chars)
- [ ] Rate limits set for production (40/60s)
- [ ] Secrets in Cloudflare (not in code/env)
- [ ] NODE_ENV set to "production"
- [ ] LOG_LEVEL set to "warn" or "info"
- [ ] Secrets redaction enabled
- [ ] Input validation active
- [ ] Health check responds correctly
- [ ] Monitoring & alerting configured
- [ ] Error logs reviewed (no leaks)
- [ ] On-call rotation established

---

## Incident Response

### Security Incident Process

1. **Detect:** Alert triggers (error rate spike, rate limit abuse, etc.)
2. **Respond:** On-call engineer investigates
3. **Mitigate:** Disable feature / rotate token / block IP if needed
4. **Investigate:** Review logs, understand root cause
5. **Fix:** Patch code or reconfigure
6. **Deploy:** Roll out fix
7. **Monitor:** Watch metrics for 24h
8. **Communicate:** Post-mortem with team

### Token Compromise

If token is leaked/compromised:

1. **Immediately:** Generate new token
2. **Update:** `npx wrangler secret put MCP_AUTH_TOKEN`
3. **Deploy:** `npm run deploy`
4. **Monitor:** Check logs for old token usage (should stop)
5. **Document:** Log incident for audit trail

### Rate Limiting Bypass

If rate limiting is bypassed:

1. **Check:** Review rate limit logs
2. **Adjust:** Tighten limits or add IP blocking
3. **Update:** `wrangler.toml` with new config
4. **Deploy:** Roll out changes
5. **Monitor:** Verify bypass attempt is blocked

---

## Compliance & Audit

### Data Retention

- Logs: 30 days (configurable)
- Metrics: 90 days
- Error traces: 14 days

### Audit Trail

All authenticated requests logged with:
- Timestamp
- Token (redacted)
- Endpoint
- Status code
- Latency
- Error message (if any)

### Security Audit

Recommended annual security audit:
- OWASP Top 10 review
- Penetration testing
- Secrets audit
- Dependencies vulnerability scan

---

## Third-Party Security Tools

### GitHub Security

Enable in repository settings:

- [x] Branch protection (require PR reviews)
- [x] Dependabot (automated dependency updates)
- [x] Code scanning (vulnerability detection)
- [x] Secret scanning (prevent key commits)

### Cloudflare Security

Enable in Cloudflare dashboard:

- [x] WAF rules (optional, but recommended)
- [x] Rate limiting (in addition to app-level)
- [x] DDoS protection (enabled by default)
- [x] TLS encryption (enforced)

---

## Support & Escalation

**Security Question?**
- Review this document
- Check [CONFIG.md](CONFIG.md) for configuration details
- Review logs with `npx wrangler tail`

**Security Incident?**
- Contact security team immediately
- Follow incident response process above
- Create incident ticket with details

**Vulnerability Report?**
- Email security contact (add in GitHub SECURITY.md)
- Do not disclose publicly until patch available
- Follow responsible disclosure timeline (90 days)

---

## See Also

- [CONFIG.md](CONFIG.md) — Complete configuration reference
- [OPERATIONS.md](OPERATIONS.md) — Operational procedures
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment checklist
- [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) — Security hardening roadmap
- [README.md](README.md) — Project overview

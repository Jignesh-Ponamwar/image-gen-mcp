# Operations Guide - Image Gen MCP Server

Operational procedures, monitoring setup, and troubleshooting guide for the Marketing Creative MCP Server.

## Overview

This guide covers day-to-day operations, monitoring, health checks, troubleshooting, and scaling considerations.

---

## Health Checks

### Endpoint: `/health`

**Purpose:** Quick health check of the service  
**Method:** GET  
**Authentication:** Not required  
**Response Time:** <100ms

**Example:**

```bash
curl https://your-mcp-server.workers.dev/health
```

**Response:**

```json
{
  "status": "ok",
  "version": "3.2.0",
  "name": "nano-banana-marketing-creative"
}
```

**Expected Behavior:**
- HTTP 200 = Service is healthy
- HTTP 500 = Service has issues (check logs)
- Timeout = Network/server problem

### Automated Health Monitoring

Configure uptime monitoring to check `/health` every 60 seconds:

**Options:**
- Cloudflare Uptime Monitoring (built-in)
- UptimeRobot (free tier available)
- PagerDuty (enterprise)
- Custom script with alerts

---

## Metrics & Monitoring

### Metrics Endpoint

**Endpoint:** `/metrics`  
**Purpose:** Detailed performance metrics in JSON format  
**Method:** GET  
**Authentication:** Bearer token required  

**Example:**

```bash
curl -H "Authorization: Bearer your-token" \
  https://your-mcp-server.workers.dev/metrics
```

**Response:**

```json
{
  "uptime_seconds": 3600,
  "total_requests": 1250,
  "error_rate": 0.008,
  "average_latency_ms": 1200,
  "rate_limit_hits": 3,
  "active_rate_limits": 5
}
```

### Key Metrics

| Metric | Normal Range | Alert Threshold |
|--------|-------------|-----------------|
| Error Rate | <1% | >5% |
| Latency | 1-2 seconds | >5 seconds |
| Rate Limit Hits | <5% requests | >20% requests |
| Uptime | >99.9% | <99% |

---

## Logging

### Log Levels

Logs are output to stdout (captured by Cloudflare):

```
ERROR  - Errors that need immediate attention
WARN   - Warnings that should be reviewed
INFO   - General operational events
DEBUG  - Detailed debugging information (dev only)
```

**Configure log level:**

```bash
LOG_LEVEL=info  # production default
LOG_LEVEL=debug # development
LOG_LEVEL=warn  # minimal logging
```

### Log Format

Structured JSON logs for easy parsing:

```json
{
  "timestamp": "2025-06-07T10:30:45.123Z",
  "level": "error",
  "request_id": "req-abc123",
  "message": "OpenRouter API error",
  "context": {
    "endpoint": "/image-gen-gemini",
    "status": 429,
    "error": "Rate limit exceeded [REDACTED]"
  }
}
```

### Log Analysis

**View live logs:**

```bash
npx wrangler tail --follow
```

**Filter logs:**

```bash
# Only errors
npx wrangler tail --follow | grep "ERROR"

# Only rate limit events
npx wrangler tail --follow | grep "rate.limit"

# Only specific endpoint
npx wrangler tail --follow | grep "image-gen-gemini"
```

### Cloudflare Logpush

For long-term storage and analysis, enable Logpush:

1. Go to Cloudflare Dashboard → Logs → Logpush
2. Create job with destination (Datadog, Splunk, S3, etc.)
3. Configure dataset: HTTP Requests + Workers Trace Events
4. Set frequency: 5 minutes or hourly
5. Route logs to your analytics platform

---

## Troubleshooting

### Service Unresponsive

**Symptom:** `/health` times out or returns 500

**Investigation:**

```bash
# Check live logs
npx wrangler tail --follow

# Look for error patterns:
# - "Internal server error" → Code issue
# - "Network error" → External service down
# - "Configuration error" → Missing secrets
```

**Solutions:**

1. **Check secrets are set:**
   ```bash
   npx wrangler secret list
   ```

2. **Check environment variables:**
   ```bash
   # Review wrangler.toml [vars] section
   cat wrangler.toml
   ```

3. **Rollback to previous version:**
   ```bash
   git revert <commit>
   npm run deploy
   ```

4. **Restart worker:**
   - No manual restart needed (Cloudflare auto-restarts)
   - Wait 30 seconds and try again

### High Error Rate

**Symptom:** Error rate >5%

**Investigation:**

```bash
# Check OpenRouter status
# Visit: https://status.openrouter.io

# Check logs for specific errors
npx wrangler tail --follow | grep "error"

# Common errors:
# 401 → OpenRouter API key invalid
# 429 → OpenRouter rate limited
# 500 → OpenRouter service issue
```

**Solutions:**

1. **If 401 error (invalid API key):**
   ```bash
   # Verify key is correct
   npx wrangler secret list | grep OPENROUTER
   
   # Update if needed
   npx wrangler secret put OPENROUTER_API_KEY
   npm run deploy
   ```

2. **If 429 (rate limited by OpenRouter):**
   ```bash
   # Check OpenRouter usage & limits
   # Reduce request rate or upgrade plan
   ```

3. **If 500 (upstream service error):**
   ```bash
   # Wait for OpenRouter to recover
   # Monitor status page: https://status.openrouter.io
   ```

### Slow Response Times

**Symptom:** Average latency >5 seconds

**Investigation:**

```bash
# Check slowest requests
npx wrangler tail --follow | grep "latency" | sort

# Common causes:
# - Large image downloads (>2MB)
# - Slow OpenRouter response
# - Image host latency
```

**Solutions:**

1. **Reduce image size limit:**
   ```bash
   # Current: 5MB
   MCP_MAX_IMAGE_BYTES=2097152  # 2MB
   npm run deploy
   ```

2. **Reduce fetch timeout:**
   ```bash
   # Current: 10 seconds
   MCP_FETCH_TIMEOUT_MS=5000  # 5 seconds
   npm run deploy
   ```

3. **Check image hosts:**
   - Are they responding slowly?
   - Add to monitoring
   - Consider using different CDN

### Rate Limit Rejections

**Symptom:** Users seeing 429 "Too Many Requests"

**Investigation:**

```bash
# Check rate limit configuration
echo $MCP_RATE_LIMIT_REQUESTS
echo $MCP_RATE_LIMIT_WINDOW_MS

# Check who's hitting limits
npx wrangler tail --follow | grep "429"
```

**Solutions:**

1. **Increase limits:**
   ```bash
   # Current: 60 requests per 60 seconds
   MCP_RATE_LIMIT_REQUESTS=120  # 120 per minute
   npm run deploy
   ```

2. **Investigate traffic source:**
   ```bash
   # Check IP or token causing limit hits
   # May indicate abuse or legitimate high-volume client
   ```

3. **Add allowlist for partners:**
   ```bash
   # Skip rate limits for trusted clients
   # (requires code change in rate limiter)
   ```

### Authentication Failures

**Symptom:** 401 "Unauthorized" errors

**Investigation:**

```bash
# Verify token is being sent
curl -v -H "Authorization: Bearer your-token" https://...
# Should see: < HTTP/1.1 200 (not 401)

# Check token matches server token
npx wrangler secret list | grep MCP_AUTH_TOKEN
```

**Solutions:**

1. **Verify token format:**
   ```bash
   # Must start with "Bearer "
   curl -H "Authorization: Bearer abc123..." https://...
   
   # NOT valid:
   curl -H "Authorization: abc123..." https://...
   ```

2. **Regenerate token if compromised:**
   ```bash
   openssl rand -base64 32
   npx wrangler secret put MCP_AUTH_TOKEN
   npm run deploy
   ```

### CORS Errors

**Symptom:** Browser error: "CORS policy: Response to preflight request..."

**Investigation:**

```bash
# Test CORS with curl
curl -i -X OPTIONS https://your-server.workers.dev \
  -H "Origin: https://claude.ai" \
  -H "Access-Control-Request-Method: POST"

# Check if response includes:
# Access-Control-Allow-Origin: https://claude.ai
# Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE
```

**Solutions:**

1. **Update CORS allowlist:**
   ```bash
   MCP_ALLOWED_ORIGINS="https://claude.ai,https://yourapp.com"
   npm run deploy
   ```

2. **For development, allow all origins:**
   ```bash
   # Leave unset or set to "*"
   ```

### Image Fetch Failures

**Symptom:** "Could not load product image from URL"

**Investigation:**

```bash
# Check host is in allowlist
echo $MCP_ALLOWED_IMAGE_HOSTS

# Test if URL is reachable
curl -I https://cdn.example.com/image.jpg

# Check image size
curl -s -I https://cdn.example.com/image.jpg | grep Content-Length
```

**Solutions:**

1. **Add host to allowlist:**
   ```bash
   MCP_ALLOWED_IMAGE_HOSTS="cdn.example.com"
   npm run deploy
   ```

2. **Verify image exists and is accessible:**
   ```bash
   # Image must be publicly accessible
   curl -I https://cdn.example.com/image.jpg
   # Should return 200 OK
   ```

3. **Check image size:**
   ```bash
   # Image must be under limit (5MB default)
   # If over, either reduce size or increase limit
   MCP_MAX_IMAGE_BYTES=10485760  # 10MB
   npm run deploy
   ```

---

## Scaling Considerations

### Current Limits

- **Cloudflare Workers:** Automatically scales to handle traffic
- **OpenRouter API:** Limited by your plan/credits
- **Rate Limiting:** In-memory (resets on deploy)
- **Concurrent Requests:** No hard limit (depends on OpenRouter)

### Scaling Up

**As traffic grows:**

1. **Monitor OpenRouter usage:**
   - Track API calls, costs
   - May need to upgrade plan

2. **Monitor Cloudflare usage:**
   - Requests, CPU time
   - Generally no additional cost for more requests

3. **Implement queue for bursts:**
   - Use Cloudflare Queues for async processing
   - Prevents timeouts during traffic spikes

### Cost Optimization

**Reduce costs:**

1. **Lower image size limits:**
   ```bash
   MCP_MAX_IMAGE_BYTES=2097152  # 2MB instead of 5MB
   ```

2. **Implement caching:**
   - Cache generated images (requires KV)
   - Avoid regenerating for same prompt

3. **Monitor OpenRouter costs:**
   - Different models have different costs
   - Consider cheaper models for non-critical requests

---

## Backup & Recovery

### Current State Snapshot

Record state after each deployment:

```bash
# After deploying
DATE=$(date +%Y-%m-%d)
echo "Deployment: $DATE"
echo "Version: $(grep version package.json)"
echo "Environment variables:"
npx wrangler secret list
# Save to deployment log
```

### Emergency Rollback

If critical issue found post-deployment:

```bash
# 1. Identify last known good commit
git log --oneline | head -5

# 2. Revert to that commit
git revert <commit-hash>

# 3. Rebuild and deploy
npm run build
npm run deploy

# 4. Verify health
curl https://your-server.workers.dev/health

# 5. Monitor for 30 minutes
npx wrangler tail --follow
```

---

## Performance Tuning

### Optimize for Speed

```bash
# Reduce image fetch timeout (faster failures)
MCP_FETCH_TIMEOUT_MS=5000  # 5 seconds

# Reduce image size limit (faster downloads)
MCP_MAX_IMAGE_BYTES=2097152  # 2MB

# Use faster model if available
# In prompts, specify preferred model
```

### Optimize for Reliability

```bash
# Increase timeout for slow networks
MCP_FETCH_TIMEOUT_MS=15000  # 15 seconds

# Increase image size for high-quality
MCP_MAX_IMAGE_BYTES=10485760  # 10MB

# Increase rate limit for reliability
MCP_RATE_LIMIT_REQUESTS=100
```

---

## On-Call Procedures

### On-Call Rotation

Set up rotation of on-call engineers:

- **Escalation path:** On-call → Manager → CTO
- **Page threshold:** Error rate >10% or service down
- **Response time:** 15 minutes to assess
- **Mitigation time:** 30 minutes to fix or rollback

### On-Call Checklist

When paged:

1. **First 5 minutes:** Assess severity
   - [ ] Run health check
   - [ ] Check error rate
   - [ ] Check logs for errors

2. **Next 10 minutes:** Triage
   - [ ] Determine if code issue or upstream
   - [ ] Check Cloudflare/OpenRouter status
   - [ ] Review recent changes

3. **Within 30 minutes:** Mitigate
   - [ ] Implement fix or rollback
   - [ ] Deploy change
   - [ ] Verify health

4. **Next 24 hours:** Post-mortem
   - [ ] Document incident
   - [ ] Identify root cause
   - [ ] Plan preventative measures

---

## See Also

- [CONFIG.md](CONFIG.md) — Configuration reference
- [SECURITY.md](SECURITY.md) — Security procedures
- [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment checklist
- [API.md](API.md) — API reference
- [README.md](README.md) — Project overview

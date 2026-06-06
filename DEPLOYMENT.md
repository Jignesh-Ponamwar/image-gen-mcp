# Production Deployment Checklist - Image Gen MCP Server

Step-by-step guide for safely deploying the Marketing Creative MCP Server to production.

---

## Pre-Deployment (48 hours before)

### [ ] Code Review

- [ ] All changes reviewed and approved
- [ ] No commented-out code or debug statements
- [ ] No hardcoded secrets or API keys
- [ ] No `console.log` statements in production code
- [ ] All error messages are user-friendly (non-leaky)

### [ ] Testing

- [ ] Unit tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript strict mode passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] No npm vulnerabilities: `npm audit --production`
- [ ] Manual smoke testing completed in staging

### [ ] Security Review

- [ ] CORS allowlist configured (not "*")
- [ ] Image host allowlist configured (if using product images)
- [ ] MCP_AUTH_TOKEN is strong (32+ chars, random)
- [ ] No secrets in `.env` or source code
- [ ] All secrets in Cloudflare Secrets, not `wrangler.toml`
- [ ] Rate limits set appropriately (40-60/minute recommended)
- [ ] Secrets redaction enabled in logger
- [ ] Input validation active (prompt length, URL format)

### [ ] Documentation Review

- [ ] README.md updated with latest info
- [ ] CONFIG.md completed with all variables
- [ ] SECURITY.md reviewed and up-to-date
- [ ] OPERATIONS.md reviewed
- [ ] API.md completed
- [ ] All docs are professional and accurate
- [ ] No broken links in documentation

### [ ] Infrastructure Preparation

- [ ] Cloudflare Workers configured
- [ ] Cloudflare KV namespace created and bound
- [ ] Custom domain setup (if applicable)
- [ ] SSL/TLS certificate ready
- [ ] Monitoring & logging configured
- [ ] Alerting rules created
- [ ] On-call rotation established

### [ ] GitHub Secrets Verified

- [ ] `CF_API_TOKEN` — Cloudflare API token (limited scope)
- [ ] `OPENROUTER_API_KEY` — OpenRouter API key
- [ ] `MCP_AUTH_TOKEN` — MCP authentication token
- [ ] All secrets use least-privilege permissions
- [ ] No test/dummy values

---

## Deployment Day

### [ ] Final Verification (1 hour before)

**Code:**
```bash
cd c:\Users\jigne\Downloads\nano banana mcp
npm ci                    # Fresh install from lock file
npm run build             # Build TypeScript
npm run test              # Run tests
npm run type-check        # Verify types
npm run lint              # Check linting
```

**Secrets:**
```bash
npx wrangler secret list  # Verify all secrets present
```

**Configuration:**
```bash
cat wrangler.toml         # Verify environment variables
# Check [vars] section has all needed config
```

### [ ] Staging Validation (30 minutes before)

**Deploy to staging:**
```bash
npx wrangler deploy --env staging
```

**Test staging endpoints:**
```bash
# Health check
curl https://image-gen-mcp-staging.workers.dev/health

# Auth test (should pass with valid token)
curl -H "Authorization: Bearer your-token" \
  https://image-gen-mcp-staging.workers.dev/health

# Auth test (should fail with invalid token)
curl -H "Authorization: Bearer invalid-token" \
  https://image-gen-mcp-staging.workers.dev/health
# Expected: 401 Unauthorized
```

**Test image generation:**
```bash
curl -X POST https://image-gen-mcp-staging.workers.dev/image-gen-gemini \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A test image with a blue background",
    "product_url": "https://example.com/product.jpg"
  }'
```

### [ ] Production Deployment (5-10 minutes)

**Deploy to production:**
```bash
# Verify we're on main branch
git branch
# Should show: * main

# Deploy
npx wrangler deploy --env production

# Monitor deployment
npx wrangler tail --follow
# Wait for "Worker deployed" message
```

### [ ] Post-Deployment Verification (10-15 minutes)

**Verify service is alive:**
```bash
# Health check
curl https://image-gen-mcp.workers.dev/health

# Should respond in <100ms with status: "ok"
```

**Verify authentication:**
```bash
# Test with valid token
curl -H "Authorization: Bearer your-prod-token" \
  https://image-gen-mcp.workers.dev/health
# Expected: 200 OK

# Test with invalid token
curl -H "Authorization: Bearer invalid" \
  https://image-gen-mcp.workers.dev/health
# Expected: 401 Unauthorized
```

**Check logs for errors:**
```bash
npx wrangler tail --follow
# Watch for 5-10 minutes
# Expected: No ERROR level messages
# OK: Some INFO messages, normal traffic
```

**Verify metrics endpoint:**
```bash
curl -H "Authorization: Bearer your-token" \
  https://image-gen-mcp.workers.dev/metrics
# Should return JSON with uptime, request count, etc.
```

---

## Rollout Phase (First 24 hours)

### [ ] Monitoring (Every 15 minutes for first hour)

```bash
# Check error rate
npx wrangler tail --follow | grep "ERROR"

# Check average latency
# (Manual from /metrics endpoint)

# Check rate limit hits
npx wrangler tail --follow | grep "429"
```

**Expected Metrics:**
- Error rate: <1%
- Latency: 1-2 seconds average
- Rate limit rejections: <5%

### [ ] Client Communication

**Notify users of deployment:**
```
📢 Production deployment complete (v3.2.0)
✅ Service: Fully operational
🚀 Features: All enabled
⚡ Performance: Baseline established
📊 Monitoring: Active

For any issues, contact: support@example.com
```

### [ ] Continuous Monitoring (24-48 hours)

```bash
# Check every 2-4 hours
curl https://image-gen-mcp.workers.dev/health

# Review logs daily
npx wrangler tail --follow > deployment-logs-$(date +%Y-%m-%d).log

# Monitor metrics dashboard
# (Cloudflare dashboard → Workers → image-gen-mcp)
```

### [ ] Alert Configuration

Set up automatic alerts:

**Slack Integration:**
```
- Error rate exceeds 5% → Page on-call
- Latency exceeds 5 seconds → Alert channel
- Rate limit hits exceed 20% → Alert channel
```

**PagerDuty Integration:**
```
- Error rate exceeds 10% → Trigger incident
- Service 401 errors → Trigger incident
```

---

## Rollback Procedure

**If critical issues discovered, rollback to previous version:**

### [ ] Immediate Actions (First 5 minutes)

1. **Stop accepting new requests** (optional):
   ```bash
   # Scale down workers (if available)
   # Or disable endpoint temporarily
   ```

2. **Identify last known good version:**
   ```bash
   git log --oneline | head -10
   # Find commit before deployment
   ```

3. **Revert deployment:**
   ```bash
   git revert <deployment-commit-hash>
   npm run build
   npm run deploy
   ```

4. **Verify rollback:**
   ```bash
   curl https://image-gen-mcp.workers.dev/health
   # Should respond with previous version number
   ```

5. **Monitor logs:**
   ```bash
   npx wrangler tail --follow
   # Errors should stop appearing
   ```

### [ ] Post-Rollback (15-30 minutes)

1. **Document incident:**
   - Time of incident
   - What went wrong
   - How it was fixed
   - Root cause

2. **Notify stakeholders:**
   ```
   ⚠️ Production incident and rollback
   🔄 Reverted to previous version (v3.2.0)
   ✅ Service restored and stable
   📝 Investigation ongoing
   ```

3. **Create incident ticket:**
   - Priority: High
   - Title: "Production Incident - [Date]"
   - Description: Include timeline and details
   - Assign post-mortem

---

## Post-Deployment (1-7 days)

### [ ] Production Validation (Day 1)

- [ ] Service running smoothly
- [ ] No unexpected errors in logs
- [ ] Error rate stable and low (<1%)
- [ ] Latency meets expectations (1-2s)
- [ ] Rate limits working correctly
- [ ] CORS allowlist effective
- [ ] Image host allowlist effective
- [ ] Auth token validation working

### [ ] Performance Baseline (Day 1)

Record metrics for future comparison:

```bash
# Capture baseline metrics
curl -H "Authorization: Bearer token" \
  https://image-gen-mcp.workers.dev/metrics > baseline-metrics-$(date +%Y-%m-%d).json

# Review and save:
# - Average latency
# - Error rate
# - Requests per hour
# - Rate limit hits
```

### [ ] Documentation Update (Day 1)

- [ ] Version number updated to new release
- [ ] CHANGELOG.md updated with changes
- [ ] Known issues documented
- [ ] Deployment details recorded

### [ ] Post-Mortem (Within 7 days)

If any issues occurred during deployment:

1. **Schedule meeting** with team
2. **Review incident timeline:**
   - When discovered
   - What failed
   - Impact scope
   - Time to resolution

3. **Identify root causes:**
   - Code issue?
   - Configuration issue?
   - External service?

4. **Plan preventative measures:**
   - Additional testing?
   - More staging validation?
   - Improved monitoring?

5. **Document findings:**
   - Create action items
   - Assign owners
   - Set completion dates

---

## Deployment Troubleshooting

### Build Fails

**Error:** `npm run build` fails

**Solution:**
```bash
# Check TypeScript errors
npm run type-check

# Check for syntax errors
npm run lint

# Look for recent changes that broke build
git diff HEAD~1 src/

# Fix errors before proceeding with deployment
```

### Deployment Fails

**Error:** `npm run deploy` fails with permission error

**Solution:**
```bash
# Verify Cloudflare API token
npx wrangler whoami
# Should show: authenticated ✓

# If not authenticated
npx wrangler login
# or set CLOUDFLARE_API_TOKEN env var
```

### Service Won't Start

**Error:** `/health` returns 500

**Solution:**
```bash
# Check logs
npx wrangler tail --follow

# Common issues:
# - Missing OPENROUTER_API_KEY secret
# - Missing MCP_AUTH_TOKEN secret
# - Invalid configuration in wrangler.toml

# Verify secrets
npx wrangler secret list

# If missing, add it
npx wrangler secret put OPENROUTER_API_KEY
```

### Authentication Not Working

**Error:** Valid tokens return 401

**Solution:**
```bash
# Verify token is correct
npx wrangler secret list | grep MCP_AUTH_TOKEN
# Should show: ✓ (indicating secret exists)

# Check you're using Bearer prefix
curl -H "Authorization: Bearer your-token" https://...
# NOT: curl -H "Authorization: your-token" https://...
```

---

## Version Management

### Semantic Versioning

Follow semver for version numbers: `MAJOR.MINOR.PATCH`

- **MAJOR** (3.0.0): Breaking changes (rare)
- **MINOR** (3.2.0): New features (deployment)
- **PATCH** (3.2.1): Bug fixes (can be deployed anytime)

### Release Notes

Create release notes for each version:

```markdown
# v3.2.0 - 2025-06-07

## Features
- New image generation model support
- Improved rate limiting with KV

## Fixes
- Fixed CORS header handling

## Security
- Enhanced input validation
- Added secrets redaction

## Deployment Notes
- Requires OPENROUTER_API_KEY secret
- Update MCP_AUTH_TOKEN before deploying
```

---

## Deployment Approval

### Stakeholders

**Before deploying, get approval from:**
- [ ] Engineering Lead
- [ ] Security Lead (if security changes)
- [ ] Product Lead (for feature deployments)

### Sign-Off

Document approval:

```bash
# Create deployment file
cat > .deployment-record-$(date +%Y-%m-%d).txt << EOF
Version: 3.2.0
Date: 2025-06-07
Deployed by: [Name]
Approved by: [Approver names]
Status: ✅ Successful
EOF

# Commit to git
git add .deployment-record-*.txt
git commit -m "Record deployment v3.2.0"
```

---

## See Also

- [CONFIG.md](CONFIG.md) — Configuration reference
- [SECURITY.md](SECURITY.md) — Security procedures
- [OPERATIONS.md](OPERATIONS.md) — Operational procedures
- [API.md](API.md) — API reference
- [SETUP.md](SETUP.md) — Setup guide

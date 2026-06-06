# Setup & Deployment Guide - Image Gen MCP

This guide will help you set up and deploy the Image Gen MCP server for generating AI-powered marketing creatives.

## 🚀 Setup Steps

### 1. Configure OpenRouter Key
Ensure you have an OpenRouter API key with credits.

**Local (.env):**
```bash
OPENROUTER_API_KEY=sk-or-v1-...
MCP_AUTH_TOKEN=your_token
```

**Production (Cloudflare Secrets):**
```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put MCP_AUTH_TOKEN
```

### 2. Deploy to Cloudflare
```bash
npm run deploy
```
Your server will be available at: `https://image-gen-mcp.workers.dev`

### One-click Deploy (optional)
Add a Deploy to Cloudflare button to your README to let others quickly clone and deploy this Worker. Add this snippet to the top of your `README.md`, replacing the URL with your public repo:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/<OWNER>/<REPO>)
```

### 3. Connect to Claude Web
1. Go to **Claude.ai** -> **Settings** -> **MCP/Remotes**.
2. Add a new remote.
3. **URL:** `https://image-gen-mcp.workers.dev?token=your_mcp_auth_token`

## 💬 Using with your Marketing Plan

Once connected, you can give Claude instructions like:

> "I need a marketing banner for our new 'Summer Breeze' dress. Use the product photo from this link: https://myshop.com/dress.jpg. The banner should feel light, airy, and include the text 'Summer Sale - 20% Off'."

Claude will:
1. Process your marketing strategy.
2. Identify the need for a creative.
3. Call `generate_marketing_creative` with the link and your requirements.
4. Show you the generated image directly in the chat.

## 🛠 Troubleshooting
- **Images not showing:** Ensure the `image_url` is publicly accessible.
- **Empty images array:** Check your OpenRouter credits or the model status.
- **401 Unauthorized:** Ensure the `token` in your Claude URL matches your `MCP_AUTH_TOKEN`.

## Security recommendations (quick)
- Use a short-lived or least-privilege Cloudflare API token for CI/CD. Grant only the Worker & resource permissions required.
- Consider restricting allowed `product_url` domains to mitigate SSRF risks.
- Limit the maximum fetched image size and add a fetch timeout in `src/lib/openrouter.ts` to avoid large downloads.
- Replace the open CORS origin with an allowlist for production.

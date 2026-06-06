# Image Gen MCP - AI Image Generation Server 🎨

A specialized [Model Context Protocol](https://modelcontextprotocol.io/) server for generating marketing creatives and product-integrated images using **Google Gemini/Imagen** and **OpenAI Images** models via OpenRouter.

Deploy with one click:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=<YOUR_GIT_REPO_URL>)

## Features

✨ **Google Gemini/Imagen Integration** - Generate photorealistic marketing creatives and product-integrated banners using `image_gen_gemini`.

🤖 **OpenAI Images 2.0** - Generate 8 diverse variations for a single campaign using `image_gen_openai`, leveraging 'Thinking' mode for complex reasoning.

📦 **Product Consistency** - Support for product image URLs across both models to ensure your brand assets look perfect.

☁️ **Cloudflare Workers Ready** - Deploy as a scalable, serverless worker on the Datastraw Technologies edge.

## Quick Links

- 📖 [Setup & Deployment Guide](./SETUP.md) - Complete walkthrough
- 💬 [Usage Examples](#usage-examples)

## Installation

### Prerequisites
- **Node.js 20+**
- **OpenRouter API Key** ([get one here](https://openrouter.ai/))

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure
Create a `.env` file and add your OpenRouter key:
```bash
OPENROUTER_API_KEY=your_key_here
MCP_AUTH_TOKEN=your_secure_token
```

### Step 3: Build & Deploy
```bash
npm run build
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put MCP_AUTH_TOKEN
npm run deploy
```

## Tool Reference

### `image_gen_gemini`
Generate high-quality marketing creatives using Google Gemini/Imagen models.

**Parameters:**
- `prompt`: (Required) Detailed text description (e.g., "A vibrant summer sale banner").
- `product_url`: (Optional) URL of the product photo to include.
- `model`: (Optional) OpenRouter model ID (defaults to `google/gemini-2.5-flash-image`).

### `image_gen_openai`
Generate 8 marketing creative variations using OpenAI's latest logic.
**Parameters:**
- `prompt`: (Required) Marketing creative requirements — same as `image_gen_gemini` (be specific about style, mood).
- `product_url`: (Optional) URL of the product image (JPEG/PNG/WEBP).
- `size`: (Optional) One of `1024x1024`, `1536x1024`, `1024x1536`. Defaults to `1024x1024`.
- `quality`: (Optional) `auto`, `high`, `medium`, or `low` (defaults to `auto`).

## Usage Examples

### 📱 WhatsApp Banner
**Prompt:** "Generate a vibrant WhatsApp marketing banner for a summer sale. Minimalist style with bold typography."
**Product Image:** `https://example.com/shoes.jpg`

Claude will call `generate_marketing_creative` with the prompt and image URL to produce the final creative.

## License
MIT License.

## One-Click Cloudflare Deploy

This repository includes a GitHub Actions workflow (`.github/workflows/cloudflare-deploy.yml`) that builds and deploys the Worker via Wrangler. To enable one-click deploy from the GitHub Actions UI, add the following repository secrets:

- `CF_API_TOKEN` — Cloudflare API Token with permissions to publish Workers (Account > Workers Scripts: Edit).
- `OPENROUTER_API_KEY` — your OpenRouter API key (required at runtime).
- `MCP_AUTH_TOKEN` — optional token to secure the MCP endpoints.

Once secrets are set, trigger the workflow via the Actions tab (select "Cloudflare Deploy" → "Run workflow") or push to the `main` branch to auto-deploy.

You can also deploy locally with:

```bash
npm ci
npm run build
npm run deploy
```

## Security & Best Practices

- **Secrets:** never commit any secrets. Use Cloudflare Secrets (`wrangler secret put`) or GitHub Actions secrets for CI/CD. Required secrets: `OPENROUTER_API_KEY`, `MCP_AUTH_TOKEN`, `CF_API_TOKEN` (for CI deploys).
- **Least-privilege tokens:** create a Cloudflare API token with only the permissions needed to publish this Worker and any required resources (Workers Scripts: Edit, and specific bindings).
  - **Recommended Cloudflare token permissions:** create a token scoped to the account and grant only:
    - `Workers Scripts: Edit` (to publish the worker)
    - `Workers KV` / `D1` / `R2` permissions only if your Worker requires those resources
    - Do NOT give full account or billing permissions to CI tokens.
- **CORS:** by default `src/index.ts` allows `origin: "*"`. For production, set a restricted allowlist via `MCP_ALLOWED_ORIGINS` and pass it into the app (recommended).
- **SSRF / image fetching:** `src/lib/openrouter.ts` fetches arbitrary `product_url` values. Consider adding a domain allowlist, request size limits, and a maximum fetch timeout to reduce SSRF and large-file risks.
- **Rate limiting + abuse protection:** add request-rate limiting or upstream API quotas to prevent abuse and unexpected costs from image generation calls.
- **Logging:** avoid logging secrets or full responses. Ensure `console.error` calls redact sensitive data.
- **Validate inputs:** `zod` is used for tool inputs — keep schemas strict and consider length/complexity caps on `prompt` values.

If you want, I can implement the safer defaults (CORS allowlist + fetch size limit + redacted logging) and add example GitHub Actions policy notes. 


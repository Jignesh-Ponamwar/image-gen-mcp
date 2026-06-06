# API Reference - Image Gen MCP Server

Complete reference for the Marketing Creative MCP Server API endpoints and tools.

---

## Overview

The Image Gen MCP Server provides two primary image generation tools accessible via the Model Context Protocol (MCP):

1. **`image_gen_gemini`** — Google Gemini/Imagen via OpenRouter
2. **`image_gen_openai`** — OpenAI Images via OpenRouter

Both tools are designed to integrate seamlessly with Claude and other MCP clients.

---

## Authentication

### Bearer Token Authentication

All API requests require a Bearer token:

```bash
curl -H "Authorization: Bearer your-mcp-auth-token" \
  https://your-mcp-server.workers.dev/health
```

**Token:**
- Format: 32+ characters, alphanumeric + symbols
- Location: `Authorization` header (Bearer) or `?token=` query parameter
- Required: Yes (unless endpoint explicitly marked otherwise)

### Responses

**Successful request (200):**
```json
{
  "status": "ok"
}
```

**Unauthorized (401):**
```json
{
  "error": "Unauthorized: invalid or missing token."
}
```

**Rate limited (429):**
```json
{
  "error": "Too Many Requests"
}
```

---

## Health Check Endpoint

### GET `/health`

**Purpose:** Quick service health check  
**Authentication:** Not required  
**Rate Limiting:** Not counted

**Request:**
```bash
curl https://your-mcp-server.workers.dev/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "3.2.0",
  "name": "nano-banana-marketing-creative"
}
```

**Use Cases:**
- Uptime monitoring
- Load balancer health checks
- Quick verification of service availability

---

## Tool: `image_gen_gemini`

Generate high-quality marketing creatives using Google Gemini/Imagen models.

### Overview

**Best for:**
- Photorealistic product scenes
- Lifestyle photography
- Professional marketing creatives
- Product-integrated visuals

**Model:** `google/gemini-2.5-flash-image`  
**Response Time:** 10-30 seconds  
**Cost:** ~$0.01-0.10 per request (depends on OpenRouter pricing)

### Input Schema

```typescript
{
  prompt: string;              // Required. 10-2000 characters
  product_url?: string;        // Optional. HTTPS URL to product image
  model?: string;              // Optional. Model ID (defaults to google/gemini-2.5-flash-image)
}
```

### Parameters

#### `prompt` (Required)

**Type:** String  
**Min Length:** 10 characters  
**Max Length:** 2000 characters  
**Description:** Marketing creative requirements. Be specific about style, mood, and context.

**Best Practices:**
- Include style guidance: "professional", "minimalist", "playful", etc.
- Specify context: "e-commerce banner", "social media post", "product page hero"
- Include mood/feeling: "luxury", "budget-friendly", "eco-conscious"
- Describe composition: "product centered", "lifestyle scene", "flat lay"

**Examples:**

```
"A professional lifestyle photo of a summer shirt on a beach at golden hour, 
fashion campaign style, minimalist aesthetic, product centered"

"Vibrant flat lay of organic coffee beans and a coffee cup, 
warm tones, eco-conscious branding, e-commerce product photo"

"Luxury spa product display with water droplets and soft lighting, 
premium cosmetics campaign, elegant and minimal"
```

**Anti-patterns (will produce poor results):**
```
"Make an image"                          # Too vague
"Product image"                          # No context
"Something nice"                         # Unhelpful
```

#### `product_url` (Optional)

**Type:** String (HTTPS URL)  
**Default:** None (text-to-image only)  
**Description:** Direct URL to product image for product-integrated visuals.

**Requirements:**
- Must be HTTPS (not HTTP)
- Image must be publicly accessible
- Content-Type must be: JPEG, PNG, WEBP, or GIF
- File size under 5 MB (configurable)
- Must download within 10 seconds (configurable)
- Must pass host allowlist check (if configured)

**Example:**
```
https://cdn.example.com/products/summer-shirt-blue.jpg
```

**Usage:**
When provided, Claude will analyze the product image and integrate it into the background/context of the generated creative.

#### `model` (Optional)

**Type:** String (Model ID)  
**Default:** `google/gemini-2.5-flash-image`  
**Allowed:** Only `google/gemini-2.5-flash-image`  
**Description:** OpenRouter model ID.

**Example:**
```
"model": "google/gemini-2.5-flash-image"
```

### Request Example

**MCP Call:**

```json
{
  "tool": "image_gen_gemini",
  "arguments": {
    "prompt": "A vibrant social media banner for a summer sale. Bold typography, 
              product centered, tropical background with bright colors, 
              e-commerce campaign style",
    "product_url": "https://cdn.example.com/shoes.jpg"
  }
}
```

**cURL Request:**

```bash
curl -X POST https://your-mcp-server.workers.dev/image-gen \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "image_gen_gemini",
    "arguments": {
      "prompt": "A professional product photo of a blue shirt on white background",
      "product_url": "https://example.com/shirt.jpg"
    }
  }'
```

### Response Format

**Success (200 OK):**

```json
{
  "content": [
    {
      "type": "image",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "ℹ️ Image generated successfully using Google Gemini"
    }
  ]
}
```

**Error (400/500):**

```json
{
  "error": "Could not load product image from URL: Connection timeout. Please provide a direct link to a JPEG, PNG, or WEBP image file."
}
```

---

## Tool: `image_gen_openai`

Generate high-quality images using OpenAI's image generation model via OpenRouter.

### Overview

**Best for:**
- Diverse creative variations
- Specific sizes (square/landscape/portrait)
- Fine-tuned quality control
- High-quality commercial images

**Model:** `openai/gpt-5.4-image-2` (with product_url) or `openai/gpt-image-1` (text-only)  
**Response Time:** 10-60 seconds  
**Cost:** ~$0.02-0.20 per request (depends on size/quality)

### Input Schema

```typescript
{
  prompt: string;              // Required. 10-2000 characters
  product_url?: string;        // Optional. HTTPS URL to product image
  size?: "1024x1024" |        // Optional. Image dimensions
         "1536x1024" | 
         "1024x1536";
  quality?: "auto" |          // Optional. Generation quality
            "high" | 
            "medium" | 
            "low";
}
```

### Parameters

#### `prompt` (Required)

**Type:** String  
**Min Length:** 10 characters  
**Max Length:** 2000 characters  
**Description:** Marketing creative requirements. Same as `image_gen_gemini`.

**See examples under `image_gen_gemini` → `prompt` parameter**

#### `product_url` (Optional)

**Type:** String (HTTPS URL)  
**Default:** None  
**Description:** Product image URL for multimodal generation.

**See requirements under `image_gen_gemini` → `product_url` parameter**

#### `size` (Optional)

**Type:** Enum  
**Default:** `1024x1024`  
**Options:**
- `1024x1024` — Square (standard)
- `1536x1024` — Landscape (wider)
- `1024x1536` — Portrait (taller)

**Selection Guide:**

| Size | Best For |
|------|----------|
| `1024x1024` | Social posts, thumbnails, standard hero |
| `1536x1024` | Banners, website headers, landscape displays |
| `1024x1536` | Stories, mobile-first content, portrait displays |

**Example:**
```json
{
  "prompt": "Summer sale banner...",
  "size": "1536x1024"
}
```

#### `quality` (Optional)

**Type:** Enum  
**Default:** `auto`  
**Options:**
- `auto` — Model decides (balanced)
- `high` — Highest quality (slower, more expensive)
- `medium` — Balanced quality
- `low` — Faster, cheaper (lower quality)

**Cost & Speed Comparison:**

| Quality | Speed | Cost | Best For |
|---------|-------|------|----------|
| `auto` | Medium | Medium | Most uses |
| `high` | Slow | High | Commercial, print |
| `medium` | Medium | Medium | Web, social |
| `low` | Fast | Low | Drafts, thumbnails |

**Example:**
```json
{
  "prompt": "Professional product photo...",
  "quality": "high"
}
```

### Request Example

**MCP Call:**

```json
{
  "tool": "image_gen_openai",
  "arguments": {
    "prompt": "A luxury cosmetics product photo on a marble surface with gold accents",
    "product_url": "https://cdn.example.com/cosmetics.jpg",
    "size": "1536x1024",
    "quality": "high"
  }
}
```

**cURL Request:**

```bash
curl -X POST https://your-mcp-server.workers.dev/image-gen \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "image_gen_openai",
    "arguments": {
      "prompt": "Professional luxury product display with premium styling",
      "size": "1536x1024",
      "quality": "high"
    }
  }'
```

### Response Format

**Success (200 OK):**

```json
{
  "content": [
    {
      "type": "image",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "✅ Image generated using OpenAI gpt-image-1."
    }
  ]
}
```

**Error (400/500):**

```json
{
  "error": "Image generation failed. Please try again with a different prompt."
}
```

---

## Response Images

### Format

All generated images are returned as base64-encoded PNG data:

```json
{
  "type": "image",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "mimeType": "image/png"
}
```

### Decoding Base64

**JavaScript:**
```javascript
const imageBuffer = Buffer.from(imageData, 'base64');
fs.writeFileSync('image.png', imageBuffer);

// or in browser
const img = new Image();
img.src = `data:image/png;base64,${imageData}`;
```

**Python:**
```python
import base64
from PIL import Image
from io import BytesIO

image_data = base64.b64decode(base64_string)
img = Image.open(BytesIO(image_data))
img.save('output.png')
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad request (invalid params) | Check request format, parameter values |
| 401 | Unauthorized (invalid token) | Verify MCP_AUTH_TOKEN is correct |
| 429 | Rate limited | Wait before retrying, increase limits if needed |
| 500 | Server error | Check logs, retry after 30 seconds |

### Error Response Format

```json
{
  "error": "Human-readable error message"
}
```

**Examples:**

```json
{
  "error": "Prompt must be at least 10 characters"
}
```

```json
{
  "error": "Could not load product image from URL: Image exceeds maximum size of 5242880 bytes."
}
```

```json
{
  "error": "OpenRouter API error (401): Invalid API key"
}
```

### Debugging Failed Requests

1. **Check logs:**
   ```bash
   npx wrangler tail --follow
   ```

2. **Verify token:**
   ```bash
   curl -H "Authorization: Bearer your-token" \
     https://your-server.workers.dev/health
   # Should return 200, not 401
   ```

3. **Check OpenRouter status:**
   - Visit: https://status.openrouter.io
   - Verify API is accessible

4. **Verify parameters:**
   - Prompt length: 10-2000 chars
   - Product URL: Valid HTTPS URL
   - Size: One of 1024x1024, 1536x1024, 1024x1536

---

## Rate Limiting

### Limits

- **Default:** 60 requests per 60 seconds per token
- **Per:** Token ID or IP address (token takes precedence)
- **Resets:** Every window (sliding window)

### Rate Limit Response

When limit exceeded:

```
HTTP 429 Too Many Requests

{
  "error": "Too Many Requests"
}
```

### Checking Limits

Current rate limit status included in request logs (not in response headers, requires log review).

**Check current usage:**
```bash
# In logs, look for:
# [warn] Rate limit: 50/60 requests used
```

### Increasing Limits

For high-volume clients:

```bash
# Contact administrator to adjust
MCP_RATE_LIMIT_REQUESTS=200  # Increase limit
npm run deploy
```

---

## Metrics Endpoint

### GET `/metrics`

**Purpose:** Detailed performance metrics  
**Authentication:** Required (Bearer token)  
**Response Time:** <100ms

**Request:**
```bash
curl -H "Authorization: Bearer your-token" \
  https://your-mcp-server.workers.dev/metrics
```

**Response (200 OK):**
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

**Metric Descriptions:**

| Metric | Unit | Description |
|--------|------|-------------|
| `uptime_seconds` | Seconds | Time since worker started |
| `total_requests` | Count | Total requests processed |
| `error_rate` | Decimal (0-1) | Percentage of failed requests |
| `average_latency_ms` | Milliseconds | Average response time |
| `rate_limit_hits` | Count | Total rate limit rejections |
| `active_rate_limits` | Count | Current clients at/near limit |

---

## Best Practices

### Prompt Engineering

**Do:**
```
"A professional product photo with soft studio lighting, 
minimalist white background, fashion e-commerce style"
```

**Don't:**
```
"make an image"
```

**Do:**
- Be specific about style and context
- Include mood/aesthetic descriptors
- Mention composition (centered, lifestyle, flat lay)
- Specify use case (social media, e-commerce, print)

**Don't:**
- Request copyrighted material
- Request specific people/faces
- Use vague descriptors
- Expect photorealism with "cartoon" mixed in

### Image URL Best Practices

**Do:**
```
https://cdn.company.com/products/shoes-blue-front.jpg
```

**Don't:**
```
https://internal.company.local/products/...  # Private network
http://example.com/image.jpg                  # Non-HTTPS
file:///Users/me/image.jpg                    # Local file
```

**Do:**
- Use company CDN for product images
- Verify URL is publicly accessible
- Use HTTPS only
- Keep URLs under 2000 characters

**Don't:**
- Use private/internal URLs (SSRF risk)
- Use HTTP (requires HTTPS)
- Use extremely long URLs with excessive query params

### Error Handling in Client Code

**Good:**
```javascript
try {
  const response = await mcp.callTool('image_gen_gemini', {
    prompt: userPrompt,
    product_url: imageUrl
  });
  displayImage(response.content[0].data);
} catch (error) {
  console.error('Image generation failed:', error.message);
  showUserMessage('Please try again with different parameters');
}
```

**Bad:**
```javascript
const response = await mcp.callTool('image_gen_gemini', {
  prompt: userPrompt
});
// Assumes success, no error handling
displayImage(response.content[0].data);
```

---

## Rate Limiting Examples

### Without Rate Limiting (5 fast requests)

```bash
for i in {1..5}; do
  curl -H "Authorization: Bearer token" \
    -H "Content-Type: application/json" \
    -d '{"tool":"image_gen_gemini","arguments":{"prompt":"test"}}' \
    https://your-server.workers.dev/image-gen &
done
wait
# All 5 succeed (uses 5/60 limit)
```

### With Rate Limiting Exceeded

```bash
for i in {1..70}; do
  curl -H "Authorization: Bearer token" \
    -H "Content-Type: application/json" \
    -d '{"tool":"image_gen_gemini","arguments":{"prompt":"test"}}' \
    https://your-server.workers.dev/image-gen
done
# Requests 1-60: Succeed
# Requests 61-70: Fail with 429
```

---

## Pricing & Cost Estimation

### Per-Request Costs

| Model | Approximate Cost | Notes |
|-------|-----------------|-------|
| Google Gemini | $0.01-0.05 | Varies by image complexity |
| OpenAI GPT-5.4 | $0.05-0.20 | Higher for "high" quality |
| OpenAI GPT-image-1 | $0.02-0.10 | Cheaper, faster |

**Actual costs depend on:**
- OpenRouter pricing (subject to change)
- Model selection
- Image quality setting
- Number of images generated

### Cost Estimation

```
Monthly volume: 10,000 images
Average cost: $0.05/image
Monthly cost: ~$500

With optimization (lower quality, shorter prompts):
Average cost: $0.02/image
Monthly cost: ~$200
```

### Cost Reduction

- Use `low` quality when possible
- Use OpenAI for simple images (cheaper)
- Use Gemini for complex/realistic needs
- Implement caching to avoid regeneration
- Optimize prompts (fewer tokens = lower cost)

---

## See Also

- [CONFIG.md](CONFIG.md) — Configuration reference
- [SECURITY.md](SECURITY.md) — Security procedures
- [OPERATIONS.md](OPERATIONS.md) — Operational procedures
- [README.md](README.md) — Project overview

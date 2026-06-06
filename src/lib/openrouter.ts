import { Buffer } from "node:buffer";

// Safety defaults (can be overridden by env vars)
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// Supported MIME types for product images
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Fetch an image URL and convert it to a Base64 data URL.
 * Validates content-type and throws a clear error if it's not a supported image.
 */
async function imageUrlToBase64(url: string): Promise<string> {
  // Host allowlist check to reduce SSRF risk
  try {
    const parsed = new URL(url);
    const allowedHosts = (process.env.MCP_ALLOWED_IMAGE_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname)) {
      throw new Error(`Image host not allowed: ${parsed.hostname}`);
    }
  } catch (e) {
    // If URL parsing fails, surface a clear error
    throw new Error(`Invalid image URL: ${e instanceof Error ? e.message : String(e)}`);
  }
  const maxBytes = (() => {
    try {
      const env = process.env.MCP_MAX_IMAGE_BYTES;
      return env ? parseInt(env, 10) : DEFAULT_MAX_IMAGE_BYTES;
    } catch {
      return DEFAULT_MAX_IMAGE_BYTES;
    }
  })();

  const timeoutMs = (() => {
    try {
      const env = process.env.MCP_FETCH_TIMEOUT_MS;
      return env ? parseInt(env, 10) : DEFAULT_FETCH_TIMEOUT_MS;
    } catch {
      return DEFAULT_FETCH_TIMEOUT_MS;
    }
  })();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NanoBananaMCP/3.2.0)",
        "Accept": "image/jpeg,image/png,image/webp,image/gif,image/*"
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Image fetch aborted due to timeout (${timeoutMs}ms)`);
    }
    throw new Error(`Network error fetching image: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image (HTTP ${response.status}): ${response.statusText}`);
  }

  const rawContentType = response.headers.get("content-type") ?? "image/jpeg";
  // Strip quality params like "; charset=utf-8"
  const contentType = rawContentType.split(";")[0].trim().toLowerCase();

  if (!SUPPORTED_IMAGE_TYPES.some((t) => contentType.includes(t.split("/")[1]))) {
    throw new Error(`URL does not point to a supported image. Received content-type: "${contentType}". Supported: JPEG, PNG, WEBP, GIF.`);
  }

  // Quick Content-Length check when present
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(declared) && declared > maxBytes) {
      throw new Error(`Image exceeds maximum allowed size of ${maxBytes} bytes (declared ${declared}).`);
    }
  }

  // Stream the body and enforce a maximum number of bytes to avoid large downloads
  if (!response.body) {
    // Fallback for environments with no streaming support
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Image exceeds maximum allowed size of ${maxBytes} bytes.`);
    }
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  }

  const reader = (response.body as any).getReader?.();
  if (!reader) {
    // Another fallback
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Image exceeds maximum allowed size of ${maxBytes} bytes.`);
    }
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    let res;
    try {
      res = await reader.read();
    } catch (err: any) {
      throw new Error(`Error reading image stream: ${err?.message ?? err}`);
    }
    if (res.done) break;
    const chunk = res.value as Uint8Array;
    received += chunk.length;
    if (received > maxBytes) {
      // Cancel the reader and throw
      try { await reader.cancel(); } catch {}
      throw new Error(`Image exceeds maximum allowed size of ${maxBytes} bytes while downloading.`);
    }
    chunks.push(chunk);
  }

  // Concatenate chunks
  const result = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }

  // Validate magic bytes to ensure the downloaded payload is likely an image
  if (!isLikelyImage(result, contentType)) {
    throw new Error("Downloaded file does not appear to be a valid image.");
  }

  const base64 = Buffer.from(result).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

/**
 * Checks a Uint8Array for common image file signatures based on declared contentType.
 */
function isLikelyImage(bytes: Uint8Array, contentType: string): boolean {
  if (!bytes || bytes.length < 12) return false;
  // JPEG: FF D8
  if (contentType.includes("jpeg") || (bytes[0] === 0xff && bytes[1] === 0xd8)) return true;
  // PNG: 89 50 4E 47
  if (contentType.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) return true;
  // GIF: 'GIF8'
  if (contentType.includes("gif") || (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)) return true;
  // WEBP: 'RIFF'....'WEBP'
  if (contentType.includes("webp") || (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)) return true;
  return false;
}

/**
 * Recursively extract base64 image strings from a response object.
 * Handles: message.images[], message.parts[], message.content (string or array).
 */
function extractImagesFromMessage(message: any): string[] {
  const images: string[] = [];

  if (!message) return images;

  // 1. Dedicated images array (OpenRouter multimodal standard)
  if (Array.isArray(message.images)) {
    for (const img of message.images) {
      const extracted = resolveImageValue(img);
      if (extracted) images.push(extracted);
    }
  }

  // 2. Parts array (OpenAI/Google multimodal standard)
  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part?.type === "image" || part?.type === "image_url") {
        const extracted = resolveImageValue(part.image ?? part.image_url ?? part);
        if (extracted) images.push(extracted);
      }
    }
  }

  // 3. Content as array of blocks (OpenAI chat completions multimodal format)
  if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block?.type === "image_url") {
        const extracted = resolveImageValue(block.image_url);
        if (extracted) images.push(extracted);
      } else if (block?.type === "image") {
        const extracted = resolveImageValue(block);
        if (extracted) images.push(extracted);
      }
    }
  }

  // 4. Content as a plain string — scan for embedded data URLs
  if (typeof message.content === "string") {
    const dataUrlRegex = /data:image\/[a-zA-Z.-]+;base64,[a-zA-Z0-9+/=_-]+/g;
    const matches = message.content.match(dataUrlRegex);
    if (matches) {
      for (const match of matches) {
        const extracted = resolveImageValue(match);
        if (extracted) images.push(extracted);
      }
    }
  }

  return images;
}

/**
 * Resolves various image value shapes to a clean base64 string.
 */
function resolveImageValue(img: any): string | null {
  if (!img) return null;

  if (typeof img === "string") {
    if (img.startsWith("data:")) {
      const parts = img.split(",");
      return parts.length > 1 ? parts[1] : null;
    }
    // Plain base64 string (no data: prefix)
    if (img.length > 100) return img;
    return null;
  }

  if (typeof img === "object") {
    // Traverse common nested fields
    const candidate =
      img.url ??
      img.imageUrl?.url ??
      img.image_url?.url ??
      img.imageUrl ??
      img.image_url ??
      img.data ??
      img.imageBytes ??
      img.inlineData?.data ??
      img.image?.data ??
      img.image?.imageBytes;

    return resolveImageValue(candidate);
  }

  return null;
}

/**
 * Main OpenRouter Image Generation function.
 * Calls the OpenRouter API and returns a structured JSON result with images.
 */
export async function generateImageViaOpenRouter(
  input: {
    prompt: string;
    image_url?: string;
    model?: string;
    n?: number;
  },
  openrouterKey: string
): Promise<string> {
  // Validate and normalise model
  const model =
    input.model && input.model.includes("/")
      ? input.model
      : "google/gemini-2.5-flash-image";

  const numImages = Math.max(1, Math.min(input.n ?? 1, 4)); // Cap at 4 to avoid timeouts

  // Build multimodal content
  const content: any[] = [{ type: "text", text: input.prompt }];

  if (input.image_url) {
    try {
      const base64Image = await imageUrlToBase64(input.image_url);
      content.push({ type: "image_url", image_url: { url: base64Image } });
    } catch (e: any) {
      // Propagate a clear, actionable error message
      throw new Error(
        `Could not load product image from URL: ${e.message}. ` +
          `Please provide a direct link to a JPEG, PNG, or WEBP image file.`
      );
    }
  }

  const requestBody: any = {
    model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"], // Required for multimodal/reasoning models
  };

  // Only add 'n' if we actually want more than one image
  if (numImages > 1) {
    requestBody.n = numImages;
  }

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/modelcontextprotocol/servers",
        "X-Title": "Nano Banana MCP",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err: any) {
    throw new Error(`Network error calling OpenRouter: ${err.message}`);
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      errorDetail = await response.text();
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(`OpenRouter API error (${response.status}): ${errorDetail}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err: any) {
    throw new Error(`Failed to parse OpenRouter response JSON: ${err.message}`);
  }

  // Collect images across all choices
  const allImages: string[] = [];
  if (Array.isArray(data?.choices)) {
    for (const choice of data.choices) {
      const extracted = extractImagesFromMessage(choice?.message);
      allImages.push(...extracted);
    }
  }

  if (allImages.length === 0) {
    // Provide a useful diagnostic message
    const textContent =
      data?.choices?.[0]?.message?.content;
    const snippet =
      typeof textContent === "string"
        ? textContent.substring(0, 400)
        : JSON.stringify(textContent ?? {}).substring(0, 400);

    throw new Error(
      `No images were generated. The model responded with text instead:\n\n${snippet}\n\n` +
        `This may mean the model does not support image generation, or your OpenRouter credits are exhausted.`
    );
  }

  const expectedCount = numImages;
  const actualCount = allImages.length;

  return JSON.stringify({
    success: true,
    images: allImages,
    model,
    source: "OpenRouter",
    count: actualCount,
    ...(actualCount < expectedCount
      ? { note: `Model generated ${actualCount} of ${expectedCount} requested variations.` }
      : {}),
  });
}

// ============================================================================
// OpenAI Image Generation (gpt-image-1)
// • No product_url  → /images/generations       (pure text-to-image, fast)
// • With product_url → /chat/completions         (multimodal, same as Gemini tool)
//   OpenRouter does NOT support /images/edits — this path is intentionally avoided.
// ============================================================================
export async function generateImageOpenAI(
  input: {
    prompt: string;
    image_url?: string;
    size?: "1024x1024" | "1536x1024" | "1024x1536";
    quality?: "auto" | "high" | "medium" | "low";
  },
  openrouterKey: string
): Promise<string> {
  const multimodalModel = "openai/gpt-5.4-image-2";
  const imageOnlyModel = "openai/gpt-image-1";

  const size = input.size ?? "1024x1024";
  const quality = input.quality ?? "auto";

  const commonHeaders = {
    Authorization: `Bearer ${openrouterKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/modelcontextprotocol/servers",
    "X-Title": "Nano Banana MCP",
  };

  // ── Path A: product_url provided → multimodal /chat/completions ─────────────
  // This is the same approach the Gemini tool uses and is well-supported on OpenRouter.
  if (input.image_url) {
    const model = multimodalModel;
    const productBase64 = await imageUrlToBase64(input.image_url);

    const messageContent: any[] = [
      { type: "text", text: input.prompt },
      { type: "image_url", image_url: { url: productBase64 } },
    ];

    const requestBody: any = {
      model,
      messages: [{ role: "user", content: messageContent }],
      modalities: ["image", "text"],
    };

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      throw new Error(`Network error calling OpenAI multimodal endpoint: ${err.message}`);
    }

    if (!response.ok) {
      let errorDetail = "";
      try { errorDetail = await response.text(); } catch { errorDetail = response.statusText; }
      throw new Error(`OpenAI image generation failed (${response.status}): ${errorDetail}`);
    }

    let data: any;
    try { data = await response.json(); } catch (err: any) {
      throw new Error(`Failed to parse OpenAI response: ${err.message}`);
    }

    // Extract images using the same deep parser as generateImageViaOpenRouter
    const allImages: string[] = [];
    if (Array.isArray(data?.choices)) {
      for (const choice of data.choices) {
        const extracted = extractImagesFromMessage(choice?.message);
        allImages.push(...extracted);
      }
    }

    if (allImages.length === 0) {
      const textContent = data?.choices?.[0]?.message?.content;
      const snippet = typeof textContent === "string"
        ? textContent.substring(0, 400)
        : JSON.stringify(textContent ?? {}).substring(0, 400);
      throw new Error(
        `No images returned by OpenAI. Model responded with text:\n\n${snippet}\n\n` +
        `Try rephrasing your prompt or removing the product_url.`
      );
    }

    return JSON.stringify({
      success: true,
      images: allImages,
      model,
      source: "OpenAI via OpenRouter (multimodal)",
      size,
      mode: "image-guided",
    });
  }

  // ── Path B: no product_url → clean /images/generations ─────────────────────
  const model = imageOnlyModel;
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        n: 1,
        size,
        quality,
        response_format: "b64_json",
      }),
    });
  } catch (err: any) {
    throw new Error(`Network error calling OpenAI image generation endpoint: ${err.message}`);
  }

  if (!response.ok) {
    let errorDetail = "";
    try { errorDetail = await response.text(); } catch { errorDetail = response.statusText; }
    throw new Error(`OpenAI image generation failed (${response.status}): ${errorDetail}`);
  }

  let data: any;
  try { data = await response.json(); } catch (err: any) {
    throw new Error(`Failed to parse OpenAI image response: ${err.message}`);
  }

  // Response shape varies slightly across providers. Prefer the base64 image
  // payload, but also accept data URLs or direct URLs when present.
  const firstImage = data?.data?.[0];
  const b64 =
    firstImage?.b64_json ??
    firstImage?.image_base64 ??
    firstImage?.image?.b64_json ??
    null;
  if (!b64) {
    const directUrl = firstImage?.url ?? firstImage?.image_url?.url ?? firstImage?.imageUrl?.url;
    if (typeof directUrl === "string" && directUrl.startsWith("data:image/")) {
      const parts = directUrl.split(",");
      const payload = parts.length > 1 ? parts[1] : "";
      if (payload) {
        return JSON.stringify({
          success: true,
          images: [payload],
          model,
          source: "OpenAI via OpenRouter",
          size,
          mode: "text-to-image",
        });
      }
    }

    throw new Error(
      `No image returned by OpenAI. Response: ${JSON.stringify(data).substring(0, 400)}`
    );
  }

  return JSON.stringify({
    success: true,
    images: [b64],
    model,
    source: "OpenAI via OpenRouter",
    size,
    mode: "text-to-image",
  });
}

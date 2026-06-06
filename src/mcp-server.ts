import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getEnv } from "./lib/utils.js";
import { generateImageViaOpenRouter, generateImageOpenAI } from "./lib/openrouter.js";

// ============================================================================
// Shared helper: convert raw OpenRouter result into MCP content parts
// ============================================================================
function buildImageContent(resultJson: string, successMessage: string): any[] {
  let result: any;
  try {
    result = JSON.parse(resultJson);
  } catch {
    return [{ type: "text", text: `Unexpected response format: ${resultJson.substring(0, 300)}` }];
  }

  const content: any[] = [];

  if (result.success && Array.isArray(result.images) && result.images.length > 0) {
    for (const base64 of result.images) {
      if (typeof base64 === "string" && base64.length > 10) {
        content.push({ type: "image", data: base64, mimeType: "image/png" });
      }
    }

    if (result.note) {
      content.push({ type: "text", text: `ℹ️ ${result.note}` });
    }
  } else {
    content.push({
      type: "text",
      text: `Generation completed but returned no images. Raw response: ${resultJson.substring(0, 500)}`,
    });
  }

  return content;
}

// ============================================================================
// Factory: creates a fresh McpServer per request (required for stateless mode)
// ============================================================================
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "image-gen-mcp",
    version: "3.2.0",
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tool 1: image_gen_gemini
  // Google Gemini / Imagen via OpenRouter
  // ──────────────────────────────────────────────────────────────────────────
  server.registerTool(
    "image_gen_gemini",
    {
      description:
        "Generate high-quality marketing creatives using Google Gemini/Imagen models via OpenRouter. " +
        "Best for photorealistic product scenes, lifestyle photography, and banner creatives. " +
        "Optionally include a product image URL for product-integrated visuals.",
      inputSchema: {
        prompt: z
          .string()
          .min(10, "Prompt must be at least 10 characters")
          .max(2000, "Prompt must be at most 2000 characters")
          .describe(
            "Marketing creative requirements. Be specific about style, mood, and use case. " +
            "Example: 'A professional lifestyle photo of a summer shirt on a beach at golden hour, fashion campaign style'"
          ),
        product_url: z
          .string()
          .url("Must be a valid HTTPS URL")
          .optional()
          .describe(
            "Optional direct URL to a product image (JPEG/PNG/WEBP). " +
            "Example: https://example.com/product.jpg"
          ),
        model: z
          .string()
          .optional()
          .default("google/gemini-2.5-flash-image")
          .describe("OpenRouter model ID. Defaults to google/gemini-2.5-flash-image"),
      },
    },
    async (input: any, extra: any) => {
      const openrouterKey = getEnv(extra, "OPENROUTER_API_KEY");
      if (!openrouterKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not configured. Run: wrangler secret put OPENROUTER_API_KEY"
        );
      }

      const resultJson = await generateImageViaOpenRouter(
        { prompt: input.prompt, image_url: input.product_url, model: input.model, n: 1 },
        openrouterKey
      );

      return { content: buildImageContent(resultJson, "✅ Marketing creative generated using Gemini.") };
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Tool 2: image_gen_openai
  // OpenAI gpt-5.4-image-2 via OpenRouter (/images/generations or /chat/completions)
  // ──────────────────────────────────────────────────────────────────────────
  server.registerTool(
    "image_gen_openai",
    {
      description:
        "Generate a high-quality marketing image using OpenAI's gpt-5.4-image-2 model via OpenRouter. " +
        "Provide a prompt and optionally a product image URL for product-integrated visuals. " +
        "Supports square, landscape, and portrait sizes.",
      inputSchema: {
        prompt: z
          .string()
          .min(10, "Prompt must be at least 10 characters")
          .max(2000, "Prompt must be at most 2000 characters")
          .describe(
            "Marketing creative requirements. Be specific about style, mood, and use case. " +
            "Example: 'A professional lifestyle photo of a summer shirt on a beach at golden hour, fashion campaign style'"
          ),
        product_url: z
          .string()
          .url("Must be a valid HTTPS URL")
          .optional()
          .describe(
            "Optional direct URL to a product image (JPEG/PNG/WEBP). When provided, used as a visual reference. " +
            "Example: https://example.com/product.jpg"
          ),
        size: z
          .enum(["1024x1024", "1536x1024", "1024x1536"])
          .optional()
          .default("1024x1024")
          .describe("Image size: Square (1024x1024), Landscape (1536x1024), or Portrait (1024x1536)."),
        quality: z
          .enum(["auto", "high", "medium", "low"])
          .optional()
          .default("auto")
          .describe("Image quality. 'high' gives best results. Defaults to auto."),
      },
    },
    async (input: any, extra: any) => {
      const openrouterKey = getEnv(extra, "OPENROUTER_API_KEY");
      if (!openrouterKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not configured. Run: wrangler secret put OPENROUTER_API_KEY"
        );
      }

      const resultJson = await generateImageOpenAI(
        { prompt: input.prompt, image_url: input.product_url, size: input.size, quality: input.quality },
        openrouterKey
      );

      return { content: buildImageContent(resultJson, "✅ Image generated using OpenAI gpt-image-1.") };
    }
  );

  return server;
}

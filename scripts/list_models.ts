import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("GOOGLE_API_KEY not found in environment");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function listModels() {
  try {
    const response = await ai.models.list();
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();

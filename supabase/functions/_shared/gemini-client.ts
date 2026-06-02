import { GoogleGenAI } from 'npm:@google/genai';

declare const Deno: any;

export const EMBEDDING_MODEL = 'gemini-embedding-2-preview';

let aiInstance: GoogleGenAI | null = null;

export function getGoogleGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateEmbedding(ai: GoogleGenAI, text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  let values: number[] | undefined = undefined;
  if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
    values = response.embeddings[0].values;
  } else if (response.embedding && response.embedding.values) {
    values = response.embedding.values;
  }

  if (!values) {
    throw new Error("Failed to extract embedding values from Gemini response.");
  }
  return values;
}

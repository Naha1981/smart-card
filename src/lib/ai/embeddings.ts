import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Single embedding entry point so the model can be swapped in one place.
 * Used by catalog sync (product embeddings) and the RAG document pipeline.
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return embedding;
}

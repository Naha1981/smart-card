/**
 * Provider-agnostic AI abstraction (Architecture Standard §3.3).
 * Switching providers, or routing different task classes to different models
 * (cheap-fast vs. frontier), is configuration here — never a code change in
 * the modules that consume it.
 */
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type TaskClass = "fast" | "planning";

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function resolveProvider(providerName: string | undefined, model: string): LanguageModel {
  switch (providerName) {
    case "anthropic":
      return anthropic(model);
    case "groq":
      return groq(model);
    case "openrouter":
      return openrouter(model);
    case "openai":
    default:
      return openai(model);
  }
}

/**
 * Get the configured model for a task class. Classification/extraction/
 * short-turn chat should use "fast"; meal planning, long multi-turn
 * reasoning, and anything customer-facing with complex tool orchestration
 * should use "planning".
 */
export function getModel(taskClass: TaskClass): LanguageModel {
  const provider = process.env.AI_DEFAULT_PROVIDER;
  const model =
    taskClass === "fast"
      ? process.env.AI_FAST_MODEL ?? "gpt-4o-mini"
      : process.env.AI_PLANNING_MODEL ?? "gpt-4o";
  return resolveProvider(provider, model);
}

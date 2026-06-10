import { GeminiProvider } from "./geminiProvider";
import type { AIProvider } from "./types";

export type { AIProvider, RenderRequest, RenderResult } from "./types";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!cached) cached = new GeminiProvider();
  return cached;
}

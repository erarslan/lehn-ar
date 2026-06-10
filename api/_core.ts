// Shared Gemini call used by Vercel function and Vite dev proxy.
// API key is read server-side only — never imported by client code.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash-image";

export interface GeminiResult {
  status: number;
  json: unknown;
}

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
}

export async function callGemini(
  contents: unknown,
  opts: GeminiOptions = {}
): Promise<GeminiResult> {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      json: {
        error: {
          message:
            "GEMINI_API_KEY is not set. Add it in Vercel Environment Variables (no VITE_ prefix).",
        },
      },
    };
  }
  if (contents == null) {
    return {
      status: 400,
      json: { error: { message: "Request body must include `contents`." } },
    };
  }

  // Model is locked server-side so clients cannot pick arbitrary models.
  const model = opts.model || process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const body = {
    contents,
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      status: 502,
      json: {
        error: {
          message: `Could not reach Gemini: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      },
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = { error: { message: res.statusText } };
  }
  return { status: res.status, json };
}

// Vercel serverless function — POST /api/render
// Browser calls this proxy; GEMINI_API_KEY stays server-side only.
import type { IncomingMessage, ServerResponse } from "node:http";
import { callGemini } from "./_core.js";

export const config = { maxDuration: 60 };

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== "POST") {
    send(res, 405, { error: { message: "Only POST is supported." } });
    return;
  }
  try {
    const body = await readJson(req);
    const { status, json } = await callGemini(body?.contents);
    send(res, status, json);
  } catch (err) {
    send(res, 500, {
      error: { message: err instanceof Error ? err.message : "Proxy error" },
    });
  }
}

function send(res: ServerResponse, status: number, json: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(json));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const pre = (req as any).body;
  if (pre !== undefined && pre !== null) {
    return typeof pre === "string" ? JSON.parse(pre) : pre;
  }
  const raw = await new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  return raw ? JSON.parse(raw) : {};
}

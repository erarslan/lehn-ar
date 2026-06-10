import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { callGemini } from "./api/_core";

// HTTPS is required for WebXR (immersive-ar). `--host` exposes the dev server
// on the LAN so an Android phone on the same Wi-Fi can open it.
//
// Dev proxy: mirrors /api/render locally so the Gemini key stays in Node only.
function geminiDevProxy(env: Record<string, string>): PluginOption {
  return {
    name: "gemini-dev-proxy",
    configureServer(server) {
      server.middlewares.use(
        "/api/render",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: { message: "Only POST." } }));
            return;
          }
          try {
            const raw = await readBody(req);
            const body = raw ? JSON.parse(raw) : {};
            const { status, json } = await callGemini(body?.contents, {
              apiKey: env.GEMINI_API_KEY,
              model: env.GEMINI_IMAGE_MODEL,
            });
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(json));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: {
                  message: err instanceof Error ? err.message : "Proxy error",
                },
              })
            );
          }
        }
      );
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default defineConfig(({ mode }) => {
  // Load all env vars (including GEMINI_API_KEY) for the dev proxy only.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), basicSsl(), tailwindcss(), geminiDevProxy(env)],
    server: {
      host: true,
      port: 5173,
    },
  };
});

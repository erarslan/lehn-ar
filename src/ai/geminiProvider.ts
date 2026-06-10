import { PANEL_LABEL, type PartitionConfig } from "../products/catalog";
import type { AIProvider, RenderRequest, RenderResult } from "./types";

const MAX_DIM = 1920;

export class GeminiProvider implements AIProvider {
  name = "gemini";

  async generateRealisticRender(req: RenderRequest): Promise<RenderResult> {
    // Prefer the room photo alone as the edit base.
    const baseImage = req.roomPhoto ?? req.snapshot;
    const base = await downscale(baseImage, MAX_DIM);
    const layout = await downscale(req.snapshot, MAX_DIM);
    const mask = req.mask ? await downscale(req.mask, MAX_DIM) : null;

    const prompt = buildInstruction(req.products, !!req.roomPhoto, !!mask);
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { inlineData: { mimeType: base.mimeType, data: base.data } },
    ];

    if (mask) {
      parts.push({ inlineData: { mimeType: mask.mimeType, data: mask.data } });
    }
    // Layout reference: panel positions from the 3D placement
    if (req.roomPhoto) {
      parts.push({ inlineData: { mimeType: layout.mimeType, data: layout.data } });
    }
    parts.push({ text: prompt });

    // POST to /api/render so the API key stays server-side.
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    });

    if (!res.ok) {
      const detail = await safeError(res);
      throw new Error(`Render API error (${res.status}): ${detail}`);
    }

    const json = await res.json();
    const after = extractImage(json);
    if (!after) {
      const reason = extractBlockReason(json);
      throw new Error(
        reason
          ? `Gemini returned no image: ${reason}`
          : "No image found in the Gemini response."
      );
    }

    return {
      before: req.snapshot,
      after,
      roomPhoto: req.roomPhoto,
    };
  }
}

function buildInstruction(
  products: PartitionConfig[],
  hasRoomPhoto: boolean,
  hasMask: boolean
): string {
  const list = products.length
    ? products.map((p) => PANEL_LABEL[p.type]).join(", ")
    : "partition wall panels";

  const lines = [
    "TASK: Strict PHOTO EDITING / INPAINTING — NOT image generation.",
    "IMAGE 1 is a photograph of the customer's ACTUAL room. This is the base image.",
  ];

  if (hasMask) {
    lines.push(
      "IMAGE 2 is a binary mask: WHITE pixels = partition-wall regions to edit; BLACK pixels = must stay UNCHANGED.",
      "Only modify WHITE mask regions. Every BLACK pixel must remain identical to IMAGE 1."
    );
  }

  if (hasRoomPhoto) {
    lines.push(
      "IMAGE 3 (if provided) shows the same room with rough CGI partition panels — use ONLY as a layout/position reference for where panels sit.",
      "Match the EXACT position, size, height, angle, and count of panels from the layout reference — do not change them."
    );
  }

  lines.push(
    "Inside the editable regions, replace rough/blocky CGI partition walls with photorealistic finished partition walls.",
    `Panel types: ${list}. Glass = clear glass; solid = acoustic panels; door = door leaf with handle.`,
    "MATERIAL / TRANSPARENCY RULE — this is critical:",
    "- The layout reference (IMAGE 3) and the placed model ALREADY show the correct transparency for every surface. Preserve it EXACTLY.",
    "- Where a surface is OPAQUE in the reference (solid panels, door leaf, frames), keep it OPAQUE. Do NOT make it see-through and do NOT reveal anything behind it.",
    "- Where a surface is CLEAR/TRANSPARENT glass in the reference, keep it transparent and show the REAL room visible behind it, exactly as it would appear.",
    "- Do NOT guess or invent transparency. Your only job is to make each surface look like a more realistic version of what is already there — same opacity, same material intent.",
    "- For any glass surface: do NOT add mirror-like reflections of the person, the camera, or the photographer. At most very faint, subtle surface highlights; no person reflection.",
    "GEOMETRY RULE — keep the panel EXACTLY as placed:",
    "- Do NOT extend, stretch, or grow the panel up to the ceiling or in any direction.",
    "- Do NOT add any extra panels, segments, frames, or partitions beyond the ones already placed.",
    "- Keep the same number, height, and footprint of panels as in the layout reference. Only refine THIS panel to look real and physically correct.",
    "- The panel must obey real-world physics: standing upright on the floor, with correct perspective and grounded contact, not floating.",
    "CRITICAL — DO NOT CHANGE:",
    "- The room itself: same walls, floor, ceiling, windows, doors, furniture, objects, clutter, colors, textures",
    "- Camera angle, perspective, field of view, crop, and framing",
    "- Existing lighting direction and color temperature of the room",
    "- Anything outside the partition panel areas",
    "DO NOT generate a new office, showroom, or stock interior.",
    "DO NOT add people, text, watermarks, or new furniture.",
    "The result must look like the SAME photograph, with only the partition walls upgraded to realistic materials.",
    "Add subtle contact shadows where panels meet the floor, consistent with the room's existing light."
  );

  return lines.join("\n");
}

function extractImage(json: any): string | null {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const inline = part?.inlineData ?? part?.inline_data;
    if (inline?.data) {
      const mime = inline.mimeType ?? inline.mime_type ?? "image/png";
      return `data:${mime};base64,${inline.data}`;
    }
  }
  return null;
}

function extractBlockReason(json: any): string | null {
  return (
    json?.promptFeedback?.blockReason ??
    json?.candidates?.[0]?.finishReason ??
    null
  );
}

async function safeError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error?.message ?? JSON.stringify(j);
  } catch {
    return res.statusText;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error("Invalid snapshot data URL.");
  return { mimeType: m[1], data: m[2] };
}

async function downscale(
  dataUrl: string,
  maxDim: number
): Promise<{ mimeType: string; data: string }> {
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || 1280;
    const h = img.naturalHeight || 720;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, cw, ch);
    return parseDataUrl(canvas.toDataURL("image/jpeg", 0.92));
  } catch {
    return parseDataUrl(dataUrl);
  }
}

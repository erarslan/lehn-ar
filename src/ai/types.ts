import type { PartitionConfig } from "../products/catalog";

export interface RenderResult {
  before: string; // AR snapshot: room + 3D panels
  after: string; // photorealistic edit
  roomPhoto?: string; // room photo only (camera)
}

export interface RenderRequest {
  snapshot: string; // room + 3D panels (layout reference)
  roomPhoto?: string; // room photo only — edit base
  prompt: string;
  products: PartitionConfig[];
  depthMap?: string;
  mask?: string; // white = panel region for inpainting
}

export interface AIProvider {
  name: string;
  generateRealisticRender(req: RenderRequest): Promise<RenderResult>;
}

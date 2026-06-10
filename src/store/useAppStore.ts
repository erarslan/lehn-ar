import { create } from "zustand";
import { PRODUCTS, type PartitionConfig } from "../products/catalog";
import type { RenderResult } from "../ai/types";

export type Screen = "home" | "catalog" | "ar" | "summary";

export interface PlacedItem {
  id: string;
  config: PartitionConfig;
}

interface AppState {
  screen: Screen;
  config: PartitionConfig;
  placed: PlacedItem[];
  render: RenderResult | null;

  setScreen: (s: Screen) => void;
  setConfig: (c: Partial<PartitionConfig>) => void;
  addPlaced: (config: PartitionConfig) => void;
  removeLastPlaced: () => void;
  setRender: (r: RenderResult | null) => void;
  resetAll: () => void;
}

const defaultConfig: PartitionConfig = {
  type: PRODUCTS[1].type, // glass
  width: PRODUCTS[1].width,
  height: PRODUCTS[1].height,
  color: PRODUCTS[1].color,
};

export const useAppStore = create<AppState>((set) => ({
  screen: "home",
  config: { ...defaultConfig },
  placed: [],
  render: null,

  setScreen: (screen) => set({ screen }),
  setConfig: (c) =>
    set((s) => {
      const next = { ...s.config, ...c };
      // Cap panel height at 1.8 m.
      if (next.height > 1.8) next.height = 1.8;
      return { config: next };
    }),
  addPlaced: (config) =>
    set((s) => ({
      placed: [...s.placed, { id: crypto.randomUUID(), config: { ...config } }],
    })),
  removeLastPlaced: () => set((s) => ({ placed: s.placed.slice(0, -1) })),
  setRender: (render) => set({ render }),
  resetAll: () =>
    set({ screen: "home", placed: [], render: null, config: { ...defaultConfig } }),
}));

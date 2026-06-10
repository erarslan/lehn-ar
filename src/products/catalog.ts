export type PanelType = "solid" | "glass" | "door";

export interface PartitionConfig {
  type: PanelType;
  width: number; // meters
  height: number; // meters
  color: string; // hex accent / panel color
}

export interface ProductPreset extends PartitionConfig {
  id: string;
  name: string;
  description: string;
}

// Lehnert-inspired parametric partition presets. No real GLB assets required:
// every product is generated procedurally from these parameters.
export const PRODUCTS: ProductPreset[] = [
  {
    id: "solid-acoustic",
    name: "Acoustic Solid Panel",
    description: "Sound-insulated, opaque partition panel. For quiet work areas.",
    type: "solid",
    width: 1.0,
    height: 1.8,
    color: "#aab2bd",
  },
  {
    id: "glass-clear",
    name: "Glass Partition",
    description: "Clear, spacious look. Open yet separated spaces.",
    type: "glass",
    width: 1.0,
    height: 1.8,
    color: "#9ec7d6",
  },
  {
    id: "door-glass",
    name: "Glass Partition with Door",
    description: "Glass door module for passage. Meeting room entrances.",
    type: "door",
    width: 1.0,
    height: 1.8,
    color: "#9ec7d6",
  },
];

export const PANEL_LABEL: Record<PanelType, string> = {
  solid: "Solid Panel",
  glass: "Glass Panel",
  door: "Door Panel",
};

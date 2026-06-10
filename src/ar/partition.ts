import * as THREE from "three";
import type { PartitionConfig } from "../products/catalog";

const FRAME = 0.04; // frame bar thickness (m)
const DEPTH = 0.05; // panel depth (m)

// Soft contact shadow so panels feel grounded on the floor.
let shadowTexture: THREE.CanvasTexture | null = null;
function getShadowTexture(): THREE.CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.45, "rgba(0,0,0,0.28)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  shadowTexture = new THREE.CanvasTexture(canvas);
  shadowTexture.needsUpdate = true;
  return shadowTexture;
}

/** Soft shadow plane under the panel base. */
function createContactShadow(width: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width * 1.5, 0.7).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.005; // slightly above floor to avoid z-fighting
  mesh.renderOrder = -1; // draw before the panel
  mesh.userData.isContactShadow = true;
  return mesh;
}

function frameMaterial(): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color: 0x2b2f3a,
    metalness: 0.7,
    roughness: 0.35,
  });
}

function bar(w: number, h: number, d: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

/**
 * Builds a partition panel procedurally from its config. Origin is at the
 * bottom-center so it sits on the detected floor; centered horizontally.
 */
export function createPartition(cfg: PartitionConfig): THREE.Group {
  const group = new THREE.Group();
  const { width: w, height: h } = cfg;
  const accent = new THREE.Color(cfg.color);
  const fMat = frameMaterial();

  // Contact shadow under the panel base
  group.add(createContactShadow(w));

  // Outer frame (4 bars)
  const top = bar(w, FRAME, DEPTH, fMat);
  top.position.set(0, h - FRAME / 2, 0);
  const bottom = bar(w, FRAME, DEPTH, fMat);
  bottom.position.set(0, FRAME / 2, 0);
  const left = bar(FRAME, h, DEPTH, fMat);
  left.position.set(-w / 2 + FRAME / 2, h / 2, 0);
  const right = bar(FRAME, h, DEPTH, fMat);
  right.position.set(w / 2 - FRAME / 2, h / 2, 0);
  group.add(top, bottom, left, right);

  const innerW = Math.max(0.01, w - FRAME * 2);
  const innerH = Math.max(0.01, h - FRAME * 2);

  if (cfg.type === "solid") {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(innerW, innerH, DEPTH * 0.6),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.1, roughness: 0.85 })
    );
    panel.position.set(0, h / 2, 0);
    group.add(panel);
  } else if (cfg.type === "glass") {
    group.add(makeGlass(innerW, innerH, accent, h / 2));
  } else {
    // door: glass side fill + a framed door leaf with a handle
    const doorW = Math.min(0.9, w * 0.55);
    const sideW = (innerW - doorW) / 2;
    if (sideW > 0.05) {
      const side = makeGlass(sideW, innerH, accent, h / 2);
      side.position.x = -(doorW / 2 + sideW / 2);
      group.add(side);
    }
    const leafGroup = new THREE.Group();
    const leaf = makeGlass(doorW - 0.04, innerH - 0.04, accent, 0);
    leafGroup.add(leaf);
    const lf = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, innerH, DEPTH * 0.4),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4b, metalness: 0.6, roughness: 0.4 })
    );
    lf.position.z = -0.005;
    leafGroup.add(lf);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.2 })
    );
    handle.position.set(doorW / 2 - 0.08, h / 2, DEPTH * 0.35);
    leafGroup.position.set(0, h / 2, 0);
    group.add(leafGroup, handle);
  }

  group.userData.config = cfg;
  return group;
}

function makeGlass(w: number, h: number, tint: THREE.Color, y: number): THREE.Mesh {
  const mat = new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.9,
    transparent: true,
    opacity: 0.4,
    thickness: 0.02,
    ior: 1.45,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), mat);
  mesh.position.y = y;
  return mesh;
}


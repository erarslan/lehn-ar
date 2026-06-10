import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createPartition } from "./partition";
import { useAppStore } from "../store/useAppStore";
import type { PartitionConfig } from "../products/catalog";

export interface PreviewHandle {
  dispose: () => void;
}

/** Live 3D preview for the configurator screen (separate from WebXR AR). */
export function startPreview(container: HTMLElement): PreviewHandle {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  // Cap DPR: iOS Safari can choke on very high pixel ratios.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7c8492);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
  camera.position.set(2.2, 1.8, 3.2);

  // Size from the container; ResizeObserver fires on the first layout pass too,
  // which fixes iOS Safari where flex heights resolve to 0 at mount time.
  const applySize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(applySize);
  ro.observe(container);
  applySize();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x33384a, 1.2));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8b92a0, roughness: 0.95 })
  );
  scene.add(floor);
  const grid = new THREE.GridHelper(12, 24, 0x6c7382, 0x828a98);
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.1, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;

  let current: THREE.Group | null = null;
  let lastCfg: PartitionConfig | null = null;
  const rebuild = (cfg: PartitionConfig) => {
    if (current) scene.remove(current);
    current = createPartition(cfg);
    scene.add(current);
    lastCfg = cfg;
  };
  rebuild(useAppStore.getState().config);

  const unsub = useAppStore.subscribe((state) => {
    if (state.config !== lastCfg) rebuild(state.config);
  });

  let raf = 0;
  const loop = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  return {
    dispose: () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      controls.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    },
  };
}

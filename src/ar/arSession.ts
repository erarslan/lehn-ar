import * as THREE from "three";
import { createPartition } from "./partition";
import { useAppStore } from "../store/useAppStore";
import type { PartitionConfig } from "../products/catalog";

export interface StartAROptions {
  overlayRoot: HTMLElement;
  onCountChange?: (n: number) => void;
  onReticleChange?: (visible: boolean) => void;
  /** True while waiting for the second tap after the first point. */
  onPlacingChange?: (placing: boolean) => void;
  onEnd?: () => void;
}

export interface CaptureResult {
  /** Room + 3D panels (before comparison). */
  snapshot: string;
  /** Camera / room photo only. */
  roomPhoto: string;
  /** White = panel region for AI inpainting. */
  mask?: string;
}

export interface ARHandle {
  end: () => Promise<void>;
  capture: () => Promise<CaptureResult>;
  removeLast: () => void;
  /** Cancel the pending first point before the second tap. */
  cancelPlacement: () => void;
}


export async function isARSupported(): Promise<boolean> {
  const xr = (navigator as any).xr;
  if (!xr?.isSessionSupported) return false;
  try {
    return await xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

export async function startARSession(opts: StartAROptions): Promise<ARHandle> {
  const { overlayRoot, onCountChange, onReticleChange, onPlacingChange, onEnd } =
    opts;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.style.position = "fixed";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "0";

const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    40
  );

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.3));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(1, 3, 2);
  scene.add(dir);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4ade80 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const placedGroup = new THREE.Group();
  scene.add(placedGroup);
  const placedMeshes: THREE.Group[] = [];

  const PREVIEW_DEPTH = 0.06;

  // Two taps define width; firstPoint holds the start until the second tap.
  let firstPoint: THREE.Vector3 | null = null;

  // Small marker at the first tap point.
  const startMarker = new THREE.Mesh(
    new THREE.CircleGeometry(0.05, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9 })
  );
  startMarker.visible = false;
  scene.add(startMarker);

  // Live preview wall between the first point and the reticle.
  let lastCfg: PartitionConfig = useAppStore.getState().config;
  const previewMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(lastCfg.color),
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const preview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), previewMat);
  preview.visible = false;
  scene.add(preview);

  const unsub = useAppStore.subscribe((state) => {
    if (state.config !== lastCfg) {
      lastCfg = state.config;
      previewMat.color.set(lastCfg.color);
    }
  });

  // camera-access: required to capture the real room photo for rendering.
  let session: XRSession;
  try {
    session = await (navigator as any).xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "camera-access"],
      optionalFeatures: ["dom-overlay", "light-estimation", "local-floor"],
      domOverlay: { root: overlayRoot },
    });
  } catch {
    session = await (navigator as any).xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "camera-access", "light-estimation", "local-floor"],
      domOverlay: { root: overlayRoot },
    });
  }

  // When a tap lands on an interactive DOM-overlay element (our buttons), this
  // event fires and cancelling it prevents the XR "select" from also firing,
  // so tapping a button no longer places a panel. Taps on empty areas
  // (pointer-events: none) don't trigger it and still place normally.
  const blockSelect = (e: Event) => e.preventDefault();
  overlayRoot.addEventListener("beforexrselect", blockSelect as EventListener);

  renderer.xr.setReferenceSpaceType("local");
  await renderer.xr.setSession(session as any);

  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource: XRHitTestSource = await (session as any).requestHitTestSource({
    space: viewerSpace,
  });

  const clearPlacement = () => {
    firstPoint = null;
    startMarker.visible = false;
    preview.visible = false;
    onPlacingChange?.(false);
  };

  const controller = renderer.xr.getController(0);
  controller.addEventListener("select", () => {
    if (captureBlocked) return;
    if (!reticle.visible) return;
    const point = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);

    // First tap: width start point.
    if (!firstPoint) {
      firstPoint = point.clone();
      startMarker.position.copy(firstPoint);
      startMarker.visible = true;
      onPlacingChange?.(true);
      return;
    }

    // Second tap: place a panel between the two points.
    const a = firstPoint;
    const dx = point.x - a.x;
    const dz = point.z - a.z;
    const width = Math.hypot(dx, dz);
    clearPlacement();
    if (width < 0.1) return; // ignore accidental tiny taps

    const cfg: PartitionConfig = { ...useAppStore.getState().config, width };
    const obj = createPartition(cfg);
    // Bottom-center origin at the midpoint on the floor.
    obj.position.set((a.x + point.x) / 2, a.y, (a.z + point.z) / 2);
    // Local +X faces A→B; keep the panel upright (yaw only).
    obj.rotation.set(0, Math.atan2(-dz, dx), 0);
    placedGroup.add(obj);
    placedMeshes.push(obj);
    useAppStore.getState().addPlaced(cfg);
    onCountChange?.(placedMeshes.length);
  });
  scene.add(controller);

  let captureRequested = false;
  let captureResolve: ((result: CaptureResult) => void) | null = null;
  let captureReject: ((err: Error) => void) | null = null;
  let capturing = false;
  let captureBlocked = false;

  const disposeRenderer = () => {
    try {
      renderer.domElement.remove();
      renderer.dispose();
    } catch {
      /* ignore */
    }
  };

  let lastReticleVisible = false;

  renderer.setAnimationLoop((_time, frame) => {
    if (frame) {
      const refSpace = renderer.xr.getReferenceSpace();
      if (refSpace) {
        const results = frame.getHitTestResults(hitTestSource);
        if (results.length > 0) {
          const pose = results[0].getPose(refSpace);
          if (pose) {
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
            // Show live preview between first point and reticle.
            if (firstPoint) {
              const b = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
              const dx = b.x - firstPoint.x;
              const dz = b.z - firstPoint.z;
              const width = Math.hypot(dx, dz);
              const h = lastCfg.height;
              preview.visible = width > 0.02;
              preview.position.set(
                (firstPoint.x + b.x) / 2,
                firstPoint.y + h / 2,
                (firstPoint.z + b.z) / 2
              );
              preview.scale.set(Math.max(width, 0.02), h, PREVIEW_DEPTH);
              preview.rotation.set(0, Math.atan2(-dz, dx), 0);
            }
          }
        } else {
          reticle.visible = false;
          preview.visible = false;
        }
        if (reticle.visible !== lastReticleVisible) {
          lastReticleVisible = reticle.visible;
          onReticleChange?.(lastReticleVisible);
        }
      }

      // XRFrame is only valid in this callback; run capture here.
      if (captureRequested && !capturing) {
        captureRequested = false;
        void doCapture(frame);
      }
    }

    renderer.render(scene, camera);
  });


  async function doCapture(frame: XRFrame) {
    if (capturing) return;
    capturing = true;
    captureBlocked = true;

    const finish = captureResolve;
    const fail = captureReject;

    try {
      // Copy projection/camera matrices only (avoid large allocations).
      let proj: number[] | null = null;
      let camMat: number[] | null = null;
      const refSpace = renderer.xr.getReferenceSpace();
      if (refSpace) {
        const pose = frame.getViewerPose(refSpace);
        if (pose?.views.length) {
          proj = Array.from(pose.views[0].projectionMatrix);
          camMat = Array.from(pose.views[0].transform.matrix);
        }
      }
      reticle.visible = false;
      startMarker.visible = false;
      preview.visible = false;

      // End AR session so the renderer can compose the final frame.
      renderer.setAnimationLoop(null);
      await Promise.race([
        session.end().catch(() => {}),
        new Promise<void>((r) => setTimeout(r, 2000)),
      ]);
      // Grab a room photo via getUserMedia once the camera is free.
      const roomPhoto = (await fallbackRoomPhoto(6000)) ?? "";

      // Compose the 3D overlay after the XR session ends.
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = buildCaptureCamera(proj, camMat, w, h);

      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, cam);
      // PNG keeps transparency; JPEG would turn empty areas black over the room.
      const overlayUrl = renderer.domElement.toDataURL("image/png");

      let mask: string | undefined;
      if (placedMeshes.length > 0) {
        const maskScene = new THREE.Scene();
        const clone = placedGroup.clone(true);
        clone.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            (o as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0xffffff });
          }
        });
        maskScene.add(clone);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(maskScene, cam);
        mask = renderer.domElement.toDataURL("image/jpeg", 0.85);
      }

      const snapshot = roomPhoto
        ? await mergeRoomAndOverlay(roomPhoto, overlayUrl, w, h)
        : overlayUrl;

      finish?.({ snapshot, roomPhoto: roomPhoto || snapshot, mask });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      renderer.setAnimationLoop(null);
      void session.end().catch(() => {});
      fail?.(e instanceof Error ? e : new Error(msg));
    } finally {
      captureBlocked = false;
      capturing = false;
      captureResolve = null;
      captureReject = null;
      disposeRenderer();
    }
  }

  function buildCaptureCamera(
    proj: number[] | null,
    camMat: number[] | null,
    w: number,
    h: number
  ): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera();
    if (proj && camMat) {
      cam.projectionMatrix.fromArray(proj);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      cam.matrixAutoUpdate = false;
      cam.matrix.fromArray(camMat);
      cam.matrixWorldNeedsUpdate = true;
    } else {
      cam.aspect = w / h;
      cam.fov = 70;
      cam.updateProjectionMatrix();
    }
    return cam;
  }

  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    unsub();
    overlayRoot.removeEventListener("beforexrselect", blockSelect as EventListener);
    renderer.setAnimationLoop(null);
    // While capturing we intentionally end the session but keep the renderer
    // alive so composeFinal can still render the 3D layer; doCapture disposes it.
    if (!capturing) disposeRenderer();
  };

  session.addEventListener("end", () => {
    cleanup();
    onEnd?.();
  });

  return {
    end: async () => {
      try {
        await session.end();
      } catch {
        cleanup();
      }
    },
    capture: () => {
      const CAPTURE_TIMEOUT_MS = 25_000;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const work = new Promise<CaptureResult>((resolve, reject) => {
        captureResolve = resolve;
        captureReject = reject;
        captureRequested = true;
        captureBlocked = true;
      });

      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          captureRequested = false;
          captureBlocked = false;
          const rej = captureReject;
          captureResolve = null;
          captureReject = null;
          const err = new Error("Capture timed out (25 s)");
          rej?.(err);
          reject(err);
        }, CAPTURE_TIMEOUT_MS);
      });

      return Promise.race([work, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    },
    removeLast: () => {
      const last = placedMeshes.pop();
      if (last) {
        placedGroup.remove(last);
        disposeGroup(last);
        useAppStore.getState().removeLastPlaced();
        onCountChange?.(placedMeshes.length);
      }
    },
    cancelPlacement: () => clearPlacement(),
  };
}

/** Dispose a group's geometry and materials (shared textures are kept). */
function disposeGroup(group: THREE.Object3D): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mat = o.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

async function mergeRoomAndOverlay(
  roomPhoto: string,
  overlayUrl: string,
  w: number,
  h: number
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const [roomImg, overlayImg] = await Promise.all([
    loadImage(roomPhoto),
    loadImage(overlayUrl),
  ]);
  ctx.drawImage(roomImg, 0, 0, w, h);
  ctx.drawImage(overlayImg, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Capture one room frame via getUserMedia after the AR session ends. */
async function fallbackRoomPhoto(timeoutMs: number): Promise<string | null> {
  try {
    const stream = (await Promise.race([
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getUserMedia timeout")), timeoutMs)
      ),
    ])) as MediaStream;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
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

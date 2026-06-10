import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  isARSupported,
  startARSession,
  type ARHandle,
  type CaptureResult,
} from "../ar/arSession";
import { getAIProvider } from "../ai";
import type { PanelType } from "../products/catalog";

type Phase = "checking" | "unsupported" | "idle" | "running" | "rendering";

export default function ARView() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const arRef = useRef<ARHandle | null>(null);
  const finishingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("checking");
  const [count, setCount] = useState(0);
  const [reticleVisible, setReticleVisible] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [panelColor, setPanelColor] = useState(
    () => useAppStore.getState().config.color
  );
  const [panelType, setPanelType] = useState<PanelType>(
    () => useAppStore.getState().config.type
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);
  const lastCaptureRef = useRef<CaptureResult | null>(null);

  const setScreen = useAppStore((s) => s.setScreen);
  const setRender = useAppStore((s) => s.setRender);
  const setConfig = useAppStore((s) => s.setConfig);

  useEffect(() => {
    let mounted = true;
    isARSupported().then((ok) => {
      if (mounted) setPhase(ok ? "idle" : "unsupported");
    });
    return () => {
      mounted = false;
      arRef.current?.end();
    };
  }, []);

  const startAR = async () => {
    if (!overlayRef.current) return;
    try {
      const handle = await startARSession({
        overlayRoot: overlayRef.current,
        onCountChange: setCount,
        onReticleChange: setReticleVisible,
        onPlacingChange: setPlacing,
        onEnd: () => {
          if (!finishingRef.current) setScreen("catalog");
        },
      });
      arRef.current = handle;
      setPhase("running");
    } catch {
      // AR session could not start on this device/browser
      setPhase("unsupported");
    }
  };

  const runRender = async (capture: CaptureResult) => {
    lastCaptureRef.current = capture;
    setError(null);
    setPhase("rendering");
    const products = useAppStore.getState().placed.map((p) => p.config);
    const provider = getAIProvider();
    try {
      setStatus("Sending to AI…");
      const result = await provider.generateRealisticRender({
        snapshot: capture.snapshot,
        roomPhoto: capture.roomPhoto,
        mask: capture.mask,
        prompt: "",
        products,
      });
      setRender(result);
      setScreen("summary");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(msg);
    }
  };

  const onRenderAR = async () => {
    if (!arRef.current || overlayMsg) return;
    finishingRef.current = true;
    setError(null);
    setOverlayMsg("Capturing image…");
    try {
      const capture = await arRef.current.capture();
      setOverlayMsg(null);
      setPhase("rendering");
      await runRender(capture);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Capture error.";
      setOverlayMsg(null);
      finishingRef.current = false;
      setPhase("idle");
      setError(msg);
    }
  };

  return (
    <div className="min-h-full">
      <div ref={overlayRef} className="xr-overlay">
        {phase === "running" && overlayMsg && (
          <OverlayStatus message={overlayMsg} />
        )}
        {phase === "running" && !overlayMsg && (
          <RunningControls
            count={count}
            reticleVisible={reticleVisible}
            placing={placing}
            activeColor={panelColor}
            activeType={panelType}
            onColorChange={(color) => {
              setPanelColor(color);
              setConfig({ color }); // next panel + live preview
            }}
            onTypeChange={(type) => {
              setPanelType(type);
              setConfig({ type }); // next panel + live preview
            }}
            onUndo={() => {
              if (placing) arRef.current?.cancelPlacement();
              else arRef.current?.removeLast();
            }}
            onRender={onRenderAR}
            onExit={() => {
              finishingRef.current = false;
              arRef.current?.end();
            }}
          />
        )}
        {phase === "rendering" && !error && (
          <OverlayStatus
            message={status || "Generating AI render…"}
            sub="May take 10–30 seconds…"
          />
        )}
        {phase === "rendering" && error && (
          <OverlayError
            message={error}
            canRetry={!!lastCaptureRef.current}
            onRetry={() => {
              if (lastCaptureRef.current) void runRender(lastCaptureRef.current);
            }}
            onExit={() => {
              setError(null);
              setScreen("catalog");
            }}
          />
        )}
        {(phase === "idle" || phase === "checking" || phase === "unsupported") && error && (
          <OverlayError
            message={error}
            canRetry={false}
            onRetry={() => {}}
            onExit={() => {
              setError(null);
              setScreen("catalog");
            }}
          />
        )}
      </div>

      {phase === "checking" && (
        <Centered>
          <Spinner />
          <p className="mt-4 text-white/45">Checking AR support…</p>
        </Centered>
      )}

      {phase === "idle" && (
        <Centered>
          <div className="screen-in flex flex-col items-center">
            <div className="text-emerald-400 text-[13px] tracking-[0.2em] font-semibold mb-3">
              AUGMENTED REALITY
            </div>
            <h2 className="text-[1.65rem] font-bold tracking-tight">
              Point your phone at your room
            </h2>
            <p className="mt-3 text-white/55 max-w-sm leading-relaxed">
              When AR starts, scan the floor. Then tap two points on the floor —
              the partition wall is built between them at your chosen width.
            </p>
            <button
              onClick={startAR}
              className="press-lg hover-accent mt-8 rounded-2xl bg-emerald-500 text-slate-950 font-semibold px-8 py-4 text-lg"
            >
              Start AR
            </button>
            <button
              onClick={() => setScreen("catalog")}
              className="press mt-4 px-2 text-white/45 text-sm"
            >
              ← Back to configurator
            </button>
          </div>
        </Centered>
      )}

      {phase === "unsupported" && (
        <Centered>
          <div className="screen-in flex flex-col items-center">
            <div className="text-3xl">📱</div>
            <h2 className="mt-4 text-xl font-bold tracking-tight">
              WebXR not supported
            </h2>
            <p className="mt-3 text-white/55 max-w-sm leading-relaxed">
              Augmented reality isn't available on this device or browser.
              Try an <span className="text-white/90">Android phone</span> with a{" "}
              <span className="text-white/90">WebXR-capable browser</span> (usually Chrome).
            </p>
            <button
              onClick={() => setScreen("catalog")}
              className="press mt-8 rounded-2xl border border-white/15 text-white/80 px-8 py-3 transition-colors duration-200 hover:border-white/30"
            >
              ← Back to configurator
            </button>
          </div>
        </Centered>
      )}

    </div>
  );
}

function OverlayStatus({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="rounded-2xl bg-black/70 backdrop-blur px-8 py-6 text-center max-w-xs">
        <Spinner />
        <p className="mt-4 text-white font-medium">{message}</p>
        {sub && <p className="mt-1 text-white/45 text-xs">{sub}</p>}
      </div>
    </div>
  );
}

function OverlayError({
  message,
  canRetry,
  onRetry,
  onExit,
}: {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="rounded-2xl bg-black/70 backdrop-blur px-8 py-6 text-center max-w-xs">
        <div className="text-3xl">⚠️</div>
        <p className="mt-3 text-white font-medium">Render failed</p>
        <p className="mt-2 text-white/45 text-xs break-words max-h-24 overflow-auto">{message}</p>
        {canRetry && (
          <button
            onClick={onRetry}
            className="press hover-accent mt-4 rounded-2xl bg-emerald-500 text-slate-950 font-semibold px-6 py-2.5 text-sm w-full"
          >
            Try again
          </button>
        )}
        <button onClick={onExit} className="press mt-3 px-2 text-white/45 text-xs">
          ← Back to configurator
        </button>
      </div>
    </div>
  );
}

function RunningControls({
  count,
  reticleVisible,
  placing,
  activeColor,
  activeType,
  onColorChange,
  onTypeChange,
  onUndo,
  onRender,
  onExit,
}: {
  count: number;
  reticleVisible: boolean;
  placing: boolean;
  activeColor: string;
  activeType: PanelType;
  onColorChange: (color: string) => void;
  onTypeChange: (type: PanelType) => void;
  onUndo: () => void;
  onRender: () => void;
  onExit: () => void;
}) {
  const scanning = !reticleVisible && count === 0 && !placing;

  const statusText = placing
    ? "Tap the 2nd point to set width"
    : reticleVisible
    ? count > 0
      ? `${count} placed · tap the 1st point`
      : "Tap the 1st point"
    : count > 0
    ? `${count} panel${count > 1 ? "s" : ""} placed`
    : "Looking for floor…";

  return (
    <>
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between">
        <div className="rounded-full bg-black/55 backdrop-blur px-4 py-2 text-sm transition-colors duration-200">
          {statusText}
        </div>
        <button
          onClick={onExit}
          className="press rounded-full bg-black/55 backdrop-blur h-10 w-10 text-lg"
          aria-label="Exit"
        >
          ✕
        </button>
      </div>

      {scanning && <ScanningOverlay />}

      <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col items-center gap-3">
        {!scanning && (
          <TypeSelector value={activeType} onChange={onTypeChange} />
        )}
        {!scanning && (
          <FinishSwatches value={activeColor} onChange={onColorChange} />
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onUndo}
            disabled={count === 0 && !placing}
            className="press rounded-2xl bg-black/55 backdrop-blur px-5 py-3 text-sm transition-opacity duration-200 disabled:opacity-40"
          >
            {placing ? "Cancel" : "Undo"}
          </button>
          <button
            type="button"
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRender();
            }}
            className="press rounded-2xl bg-emerald-500 text-slate-950 font-semibold px-7 py-4 text-base shadow-lg shadow-emerald-500/30"
          >
            Photorealistic Render
          </button>
        </div>
      </div>
    </>
  );
}

/** Panel type segmented control; the active pill slides between options. */
const TYPES: { type: PanelType; label: string }[] = [
  { type: "solid", label: "Solid" },
  { type: "glass", label: "Glass" },
  { type: "door", label: "Door" },
];

function TypeSelector({
  value,
  onChange,
}: {
  value: PanelType;
  onChange: (type: PanelType) => void;
}) {
  const idx = Math.max(
    TYPES.findIndex((t) => t.type === value),
    0
  );

  return (
    <div className="relative grid grid-cols-3 w-56 rounded-full bg-black/55 backdrop-blur p-1">
      {/* Sliding active pill */}
      <div
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-emerald-500"
        style={{
          width: "calc((100% - 8px) / 3)",
          left: 4,
          transform: `translateX(${idx * 100}%)`,
          transition: "transform 260ms var(--ease-out)",
        }}
      />
      {TYPES.map((t) => (
        <button
          key={t.type}
          type="button"
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(t.type);
          }}
          className={`relative z-10 py-2 text-sm font-medium transition-colors duration-200 ${
            value === t.type ? "text-slate-950" : "text-white/60"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Three tasteful finishes; the active ring slides between swatches. */
const FINISHES: { color: string; label: string }[] = [
  { color: "#9ec7d6", label: "Clear" },
  { color: "#cbb38a", label: "Oak" },
  { color: "#4b5563", label: "Graphite" },
];

function FinishSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const SWATCH = 34;
  const GAP = 14;
  const PAD = 10;
  const idx = FINISHES.findIndex(
    (f) => f.color.toLowerCase() === value.toLowerCase()
  );

  return (
    <div
      className="relative flex items-center rounded-full bg-black/55 backdrop-blur"
      style={{ gap: GAP, padding: PAD }}
    >
      {/* Sliding active ring */}
      <div
        className="pointer-events-none absolute rounded-full border-2 border-white"
        style={{
          width: SWATCH + 8,
          height: SWATCH + 8,
          top: PAD - 4,
          left: PAD - 4,
          transform: `translateX(${Math.max(idx, 0) * (SWATCH + GAP)}px)`,
          transition: "transform 260ms var(--ease-out), opacity 200ms ease",
          opacity: idx >= 0 ? 1 : 0,
        }}
      />
      {FINISHES.map((f) => (
        <button
          key={f.color}
          type="button"
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(f.color);
          }}
          aria-label={f.label}
          className="press rounded-full ring-1 ring-white/15"
          style={{ width: SWATCH, height: SWATCH, background: f.color }}
        />
      ))}
    </div>
  );
}

function ScanningOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="relative flex items-center justify-center mb-8">
        {/* Expanding radar rings */}
        <div
          className="absolute rounded-full border border-emerald-400/25 animate-ping"
          style={{ width: 128, height: 128, animationDuration: "2s" }}
        />
        <div
          className="absolute rounded-full border border-emerald-400/40 animate-ping"
          style={{ width: 88, height: 88, animationDuration: "2s", animationDelay: "0.45s" }}
        />
        <div
          className="absolute rounded-full border border-emerald-400/60 animate-ping"
          style={{ width: 52, height: 52, animationDuration: "2s", animationDelay: "0.9s" }}
        />
        {/* Center icon */}
        <div className="relative z-10 w-12 h-12 rounded-full bg-black/60 border border-emerald-400/70 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-emerald-400 animate-bounce"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <div className="rounded-2xl bg-black/65 backdrop-blur px-7 py-4 text-center">
        <p className="text-white font-semibold text-sm">Point the camera at the floor</p>
        <p className="text-white/45 text-xs mt-1">Find a flat floor, scan slowly</p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      {children}
    </div>
  );
}

function Spinner() {
  // Faster spin reads as "loading faster" even at identical load times.
  return (
    <div
      className="mx-auto h-9 w-9 rounded-full border-2 border-white/15 border-t-emerald-400 animate-spin"
      style={{ animationDuration: "0.7s" }}
    />
  );
}

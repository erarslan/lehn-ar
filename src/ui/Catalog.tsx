import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { PRODUCTS, PANEL_LABEL, type ProductPreset } from "../products/catalog";
import { startPreview, type PreviewHandle } from "../ar/previewScene";

export default function Catalog() {
  const config = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);
  const setScreen = useAppStore((s) => s.setScreen);

  const previewRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PreviewHandle | null>(null);

  useEffect(() => {
    if (previewRef.current && !handleRef.current) {
      handleRef.current = startPreview(previewRef.current);
    }
    return () => {
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  const selectPreset = (p: ProductPreset) => {
    setConfig({ type: p.type, width: p.width, height: p.height, color: p.color });
  };

  return (
    <div className="min-h-full flex flex-col screen-in">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button
          onClick={() => setScreen("home")}
          className="press -ml-1 px-1 text-white/45 text-sm"
        >
          ← Back
        </button>
        <div className="text-[13px] font-semibold tracking-[0.2em] text-emerald-400">
          CONFIGURATOR
        </div>
        <div className="w-10" />
      </header>

      <div
        ref={previewRef}
        className="mx-5 rounded-2xl overflow-hidden border border-white/10"
        style={{ height: "38vh" }}
      />

      <div className="px-5 mt-6">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/35 mb-2">
          Panel type
        </div>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/[0.04] p-1.5">
          {PRODUCTS.map((p) => {
            const active = config.type === p.type;
            return (
              <button
                key={p.id}
                onClick={() => selectPreset(p)}
                className={`press rounded-xl px-2 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "bg-emerald-500 text-slate-950"
                    : "text-white/55"
                }`}
              >
                {PANEL_LABEL[p.type]}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-white/40 min-h-[2.5rem]">
          {PRODUCTS.find((p) => p.type === config.type)?.description}
        </p>
      </div>

      <div className="px-5 mt-3 space-y-5">
        <Slider
          label="Height"
          value={config.height}
          min={1.0}
          max={1.8}
          step={0.1}
          unit="m"
          onChange={(v) => setConfig({ height: v })}
        />
        <p className="text-xs leading-relaxed text-white/40">
          Width is set in AR by tapping two points on the floor.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Color / Tone</span>
          <input
            type="color"
            value={config.color}
            onChange={(e) => setConfig({ color: e.target.value })}
            className="h-9 w-14 rounded-lg bg-transparent border border-white/15 cursor-pointer"
          />
        </div>
      </div>

      <div className="px-5 mt-auto pt-6 pb-6">
        <button
          onClick={() => setScreen("ar")}
          className="press-lg hover-accent w-full rounded-2xl bg-emerald-500 text-slate-950 font-semibold py-4 text-lg"
        >
          View in Your Room (AR)
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="text-emerald-400 font-medium tabular-nums">
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500 mt-2 h-1"
      />
    </div>
  );
}

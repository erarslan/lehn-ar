import { useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function Summary() {
  const render = useAppStore((s) => s.render);
  const setScreen = useAppStore((s) => s.setScreen);
  const resetAll = useAppStore((s) => s.resetAll);

  const onShare = async () => {
    if (!render) return;
    try {
      const blob = await (await fetch(render.after)).blob();
      const file = new File([blob], "lehnar-render.jpg", { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "LehnAR concept" });
        return;
      }
    } catch {
      /* fall through to download */
    }
    const a = document.createElement("a");
    a.href = render.after;
    a.download = "lehnar-render.jpg";
    a.click();
  };

  if (!render) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 screen-in">
        <p className="text-white/45">No render found.</p>
        <button
          onClick={() => setScreen("catalog")}
          className="press rounded-xl bg-emerald-500 text-slate-950 font-semibold px-6 py-3"
        >
          Back to configurator
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col screen-in">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="text-[13px] font-semibold tracking-[0.2em] text-emerald-400">
          CONCEPT SUMMARY
        </div>
        <button onClick={resetAll} className="press px-1 text-white/45 text-sm">
          Start over
        </button>
      </header>

      <ImageCarousel before={render.before} after={render.after} />

      <div className="px-5 mt-auto pt-6 pb-6 space-y-3 shrink-0">
        <button
          onClick={onShare}
          className="press-lg hover-accent w-full rounded-2xl bg-emerald-500 text-slate-950 font-semibold py-4 text-lg"
        >
          Save / share image
        </button>
        <button
          onClick={() => setScreen("ar")}
          className="press w-full rounded-2xl border border-white/12 text-white/75 py-3 transition-colors duration-200 hover:border-white/25"
        >
          Back to AR
        </button>
      </div>
    </div>
  );
}

function ImageCarousel({ before, after }: { before: string; after: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(idx);
  };

  const goTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };

  const slides = [
    { src: after, label: "After (AI)", accent: true },
    { src: before, label: "Before (AR)", accent: false },
  ];

  return (
    <div className="relative">
      {/* Slide label */}
      <div className="px-5 mb-2 flex items-center justify-between">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 ${
            activeIdx === 0 ? "text-emerald-400" : "text-white/45"
          }`}
        >
          {slides[activeIdx].label}
        </span>
        <span className="text-[11px] tabular-nums text-white/35">
          {activeIdx + 1} / {slides.length}
        </span>
      </div>

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {slides.map((slide, i) => (
          <div key={i} className="snap-start shrink-0 w-full px-5">
            <div
              className={`overflow-hidden rounded-2xl border bg-black/40 transition-colors duration-200 ${
                slide.accent ? "border-emerald-500/40" : "border-white/10"
              }`}
            >
              <img
                src={slide.src}
                alt={slide.label}
                className="w-full object-contain max-h-[62vh]"
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to image ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIdx ? "bg-emerald-400 w-6" : "bg-white/20 w-2"
            }`}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          />
        ))}
      </div>
    </div>
  );
}

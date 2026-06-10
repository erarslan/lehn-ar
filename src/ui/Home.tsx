import { useAppStore } from "../store/useAppStore";

export default function Home() {
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <div className="min-h-full flex flex-col screen-in">
      <header className="px-6 pt-10 pb-4 rise" style={{ animationDelay: "40ms" }}>
        <div className="text-[13px] font-semibold tracking-[0.2em] text-emerald-400">
          LEHNAR
        </div>
        <div className="mt-0.5 text-xs text-white/40">Web AR room concept</div>
      </header>

      <main className="flex-1 px-6 flex flex-col justify-center max-w-xl mx-auto w-full">
        <h1
          className="text-[2.6rem] font-bold leading-[1.05] tracking-tight text-balance rise"
          style={{ animationDelay: "90ms" }}
        >
          See your room concept{" "}
          <span className="text-emerald-400">in your own space</span>.
        </h1>
        <p
          className="mt-5 text-[15px] leading-relaxed text-white/55 rise"
          style={{ animationDelay: "150ms" }}
        >
          No more drawings and PDFs in on-site consulting. Place partition wall
          solutions in your real space with your phone, then see the{" "}
          <span className="text-white/90 font-medium">photorealistic finished result</span>{" "}
          with AI in a single tap.
        </p>

        <ul className="mt-9 space-y-3.5 text-sm text-white/70">
          <Feature text="Place at 1:1 scale in your real room (WebXR)" delay={210} />
          <Feature text="Glass, solid and door partition panels" delay={260} />
          <Feature text="From blocky preview to photorealistic result with AI" delay={310} />
        </ul>

        <button
          onClick={() => setScreen("catalog")}
          className="press-lg hover-accent mt-10 w-full rounded-2xl bg-emerald-500 text-slate-950 font-semibold py-4 text-lg rise"
          style={{ animationDelay: "370ms" }}
        >
          Get started
        </button>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-white/25">
        Lehnert GmbH · Room and partition wall solutions
      </footer>
    </div>
  );
}

function Feature({ text, delay }: { text: string; delay: number }) {
  return (
    <li
      className="flex items-start gap-3 rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-[11px]">
        ✓
      </span>
      <span>{text}</span>
    </li>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseBom }  from "@/lib/utils/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10`;

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant results",
    desc:  "All distributors searched in parallel. Results in seconds.",
  },
  {
    icon: "📦",
    title: "Smart quantity",
    desc:  "Auto-rounds to the nearest reel or package unit.",
  },
  {
    icon: "🏷️",
    title: "Best price only",
    desc:  "No noise. Just the cheapest option with stock.",
  },
  {
    icon: "🔍",
    title: "Any code format",
    desc:  "MPN, Mouser, Digi-Key or Farnell codes — all accepted.",
  },
];

const DISTRIBUTORS = [
  { name: "Mouser",   color: "text-blue-400",   dot: "bg-blue-400" },
  { name: "Digi-Key", color: "text-yellow-400",  dot: "bg-yellow-400" },
  { name: "Farnell",  color: "text-green-400",   dot: "bg-green-400" },
];

export default function HomePage() {
  const router  = useRouter();
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  function handleSearch() {
    setError("");
    const bom = parseBom(input);
    if (bom.length === 0) {
      setError("No valid components found. Try: LM358N 100");
      return;
    }
    setLoading(true);
    const encoded = btoa(JSON.stringify(bom));
    router.push(`/results?bom=${encoded}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSearch();
  }

  const lineCount = input.split("\n").filter(l => l.trim()).length;

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            ic<span className="text-sky-400">paste</span>
          </span>
          <span className="tag text-[10px] font-semibold"
            style={{ background: "var(--brand-dim)", color: "var(--brand)" }}>
            BETA
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {DISTRIBUTORS.map(d => (
            <span key={d.name}
              className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
              <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
              {d.name}
            </span>
          ))}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">

        {/* Glow blob */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)",
          }} />

        <div className="relative z-10 w-full max-w-2xl">

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-4 leading-tight">
            Find the best price<br />
            <span className="gradient-text">for every component.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Paste your BOM. We search Mouser, Digi-Key and Farnell simultaneously
            and return only the best deal — ready to buy.
          </p>

          {/* Input card */}
          <div className="card p-1 mb-3 shadow-2xl">
            {/* Textarea header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-3)" }}>
                BOM INPUT — one component per line
              </span>
              {lineCount > 0 && (
                <span className="tag text-[10px]"
                  style={{ background: "var(--brand-dim)", color: "var(--brand)" }}>
                  {lineCount} {lineCount === 1 ? "component" : "components"}
                </span>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border)", margin: "0 16px" }} />

            {/* Textarea */}
            <div className="px-4 pt-3 pb-2">
              <textarea
                className="bom-textarea w-full h-40"
                placeholder={PLACEHOLDER}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
              />
            </div>

            {/* Footer bar */}
            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                MPN·QTY &nbsp;·&nbsp; CSV &nbsp;·&nbsp; Tab &nbsp;·&nbsp; Max 100 rows
                &nbsp;·&nbsp;
                <kbd className="px-1 py-0.5 rounded text-[10px]"
                  style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  ⌘ Enter
                </kbd>
                {" "}to search
              </p>
              <button
                className="btn-primary"
                onClick={handleSearch}
                disabled={loading || input.trim().length === 0}
              >
                {loading ? (
                  <><span className="spinner" /> Searching…</>
                ) : (
                  <>Find best prices <span className="opacity-70">→</span></>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-left px-1 fade-up">{error}</p>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-4 pb-16 max-w-2xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FEATURES.map(f => (
            <div key={f.title} className="card-hover p-4 text-left">
              <div className="text-xl mb-2">{f.icon}</div>
              <div className="text-sm font-semibold text-slate-200 mb-1">{f.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-5 px-6 flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>
          © {new Date().getFullYear()} icpaste.com
        </span>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>
          Built for hardware buyers
        </span>
      </footer>

    </main>
  );
}

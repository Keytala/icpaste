"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseBom }  from "@/lib/utils/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10
NE555P 250`;

export default function HomePage() {
  const router  = useRouter();
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const lineCount = input.split("\n").filter(l => l.trim()).length;

  function handleSearch() {
    setError("");
    const bom = parseBom(input);
    if (bom.length === 0) {
      setError("No valid components found. Enter one MPN and quantity per line — e.g. LM358N 100");
      return;
    }
    setLoading(true);
    const encoded = btoa(JSON.stringify(bom));
    router.push(`/results?bom=${encoded}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSearch();
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-gray-900">
            ic<span className="text-sky-500">paste</span>
            <span className="ml-2 text-[10px] font-semibold tracking-widest
                             text-sky-600 bg-sky-50 border border-sky-200
                             px-2 py-0.5 rounded-full align-middle">
              BETA
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            {["Mouser", "Digi-Key", "Farnell"].map(d => (
              <span key={d}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs
                           text-gray-500 bg-gray-50 border border-gray-200
                           px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {d}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-3xl">

          {/* Headline */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4 leading-tight">
              Find the best price<br />
              <span className="text-sky-500">for every component.</span>
            </h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
              Paste your BOM below. We search Mouser, Digi-Key and Farnell
              simultaneously and return only the best deal — stock included.
            </p>
          </div>

          {/* ── Input box ── */}
          <div className="rounded-2xl border shadow-sm overflow-hidden"
            style={{ borderColor: "var(--border)" }}>

            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                BOM Input
              </span>
              <div className="flex items-center gap-3">
                {lineCount > 0 && (
                  <span className="text-xs font-medium text-sky-600 bg-sky-50
                                   border border-sky-200 px-2.5 py-0.5 rounded-full">
                    {lineCount} {lineCount === 1 ? "component" : "components"}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  MPN &nbsp;·&nbsp; QTY &nbsp;·&nbsp; one per line
                </span>
              </div>
            </div>

            {/* Textarea */}
            <div className="relative">
              {/* Line numbers */}
              <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col
                              pt-4 pb-4 items-center pointer-events-none select-none"
                style={{ borderRight: "1px solid var(--border)" }}>
                {(input || PLACEHOLDER).split("\n").slice(0, 30).map((_, i) => (
                  <div key={i} className="text-xs leading-6 text-gray-300 w-full text-center">
                    {i + 1}
                  </div>
                ))}
              </div>

              <textarea
                className="w-full pl-14 pr-5 py-4 font-mono text-sm text-gray-800
                           placeholder-gray-300 focus:outline-none resize-none
                           leading-6"
                style={{
                  background:  "var(--bg)",
                  minHeight:   "280px",
                  caretColor:  "var(--brand)",
                }}
                placeholder={PLACEHOLDER}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
              />
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Supports CSV, tab or space separated</span>
                <span className="hidden sm:inline">Max 100 rows</span>
                <span className="hidden sm:inline">
                  <kbd className="px-1.5 py-0.5 rounded text-[11px] font-medium
                                  bg-white border border-gray-200 text-gray-500 shadow-sm">
                    ⌘ Enter
                  </kbd>
                  {" "}to search
                </span>
              </div>
              <button
                className="btn-primary"
                onClick={handleSearch}
                disabled={loading || input.trim().length === 0}
              >
                {loading
                  ? <><span className="spinner" /> Searching…</>
                  : <>Find best prices <span className="ml-1 opacity-60 text-base">→</span></>
                }
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-sm text-red-500 px-1 fade-up">{error}</p>
          )}

          {/* Format hint */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "MPN + Quantity",       example: "LM358N 100",        note: "space separated" },
              { label: "Distributor code",      example: "512-LM358N 100",    note: "auto-resolved to MPN" },
              { label: "CSV / tab format",      example: "LM358N,100",        note: "comma or tab" },
            ].map(h => (
              <div key={h.label}
                className="rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="text-xs font-semibold text-gray-500 mb-1">{h.label}</p>
                <p className="font-mono text-sm text-gray-800">{h.example}</p>
                <p className="text-xs text-gray-400 mt-0.5">{h.note}</p>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-5 px-6" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs text-gray-400">
            © {new Date().getFullYear()} icpaste.com
          </span>
          <span className="text-xs text-gray-400">
            Built for hardware buyers
          </span>
        </div>
      </footer>

    </div>
  );
}

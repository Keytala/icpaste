"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseBom }  from "@/lib/utils/bom-parser";
import s from "./Home.module.css";

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

  const lines     = input.split("\n");
  const lineCount = lines.filter(l => l.trim()).length;
  const displayLines = input ? lines : PLACEHOLDER.split("\n");

  const handleSearch = useCallback(() => {
    setError("");
    const bom = parseBom(input);
    if (bom.length === 0) {
      setError("No valid components found. Enter one MPN and quantity per line — e.g. LM358N 100");
      return;
    }
    setLoading(true);
    const encoded = btoa(JSON.stringify(bom));
    router.push(`/results?bom=${encoded}`);
  }, [input, router]);

  // ── Fix: intercetta Ctrl+Enter e Cmd+Enter ────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSearch();
    }
  }

  return (
    <div className={s.page}>

      {/* ── Header ── */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div>
            <span className={s.logo}>
              ic<span className={s.logoAccent}>paste</span>
            </span>
            <span className={s.betaBadge}>BETA</span>
          </div>
          <div className={s.distPills}>
            {["Mouser", "Digi-Key", "Farnell"].map(d => (
              <span key={d} className={s.distPill}>
                <span className={s.distDot} />
                {d}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={s.main}>
        <div className={s.container}>

          {/* Headline */}
          <div className={s.headline}>
            <h1 className={s.title}>
              Find the best price<br />
              <span className={s.titleAccent}>for every component.</span>
            </h1>
            <p className={s.subtitle}>
              Paste your BOM below. We search Mouser, Digi-Key and Farnell
              simultaneously and return only the best deal — stock included.
            </p>
          </div>

          {/* Input Box */}
          <div className={s.inputBox}>

            {/* Top bar */}
            <div className={s.inputBoxTop}>
              <span className={s.inputLabel}>BOM Input</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {lineCount > 0 && (
                  <span className={s.componentCount}>
                    {lineCount} {lineCount === 1 ? "component" : "components"}
                  </span>
                )}
                <span className={s.inputLabel}>MPN · QTY · one per line</span>
              </div>
            </div>

            {/* Body: line numbers + textarea */}
            <div className={s.inputBody}>
              <div className={s.lineNumbers}>
                {displayLines.slice(0, 1000).map((_, i) => (
                  <div key={i} className={s.lineNum}>{i + 1}</div>
                ))}
              </div>
              <textarea
                className={s.textarea}
                placeholder={PLACEHOLDER}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>

            {/* Bottom bar */}
            <div className={s.inputBoxBottom}>
              <div className={s.inputHints}>
                <span>CSV, tab or space separated</span>
                <span>Max 1000 rows</span>
                <span>
                  <kbd className={s.kbd}>⌘ Enter</kbd> to search
                </span>
              </div>
              <button
                className={s.btnPrimary}
                onClick={handleSearch}
                disabled={loading || input.trim().length === 0}
              >
                {loading ? (
                  <><span className={s.spinner} /> Searching…</>
                ) : (
                  <>Find best prices →</>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className={s.error}>{error}</p>}

          {/* Format hints */}
          <div className={s.formatHints}>
            {[
              { label: "MPN + Quantity",    example: "LM358N 100",     note: "space separated" },
              { label: "Distributor code",  example: "512-LM358N 100", note: "auto-resolved to MPN" },
              { label: "CSV / tab format",  example: "LM358N,100",     note: "comma or tab" },
            ].map(h => (
              <div key={h.label} className={s.formatCard}>
                <div className={s.formatCardLabel}>{h.label}</div>
                <div className={s.formatCardExample}>{h.example}</div>
                <div className={s.formatCardNote}>{h.note}</div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span className={s.footerText}>© {new Date().getFullYear()} icpaste.com</span>
          <span className={s.footerText}>Built for hardware buyers</span>
        </div>
      </footer>

    </div>
  );
}

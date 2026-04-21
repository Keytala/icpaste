"use client";

import { useState, useCallback } from "react";
import { useRouter }             from "next/navigation";

const DISTRIBUTORS = ["Mouser", "Digi-Key", "Farnell"];

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 2700
STM32F103C8T6 10
NE555P 250`;

export default function HomePage() {
  const router  = useRouter();
  const [input,   setInput]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const lines     = input.split("\n");
  const lineCount = lines.filter(l => l.trim()).length;

  const handleSearch = useCallback(() => {
    setError("");
    const rows = input.split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("#"))
      .map(line => {
        const parts = line.split(/[\t,;\s]+/);
        const mpn   = parts[0]?.toUpperCase().trim();
        const qty   = parseInt(parts[1]?.replace(/\D/g, "") ?? "0", 10);
        return mpn && qty > 0 ? { mpn, qty } : null;
      })
      .filter(Boolean);

    if (!rows.length) {
      setError("No valid components found. Format: MPN QTY (one per line)");
      return;
    }
    setLoading(true);
    const encoded = btoa(JSON.stringify(rows));
    router.push(`/results?bom=${encoded}`);
  }, [input, router]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSearch();
    }
  }

  const displayLines = (input || PLACEHOLDER).split("\n").slice(0, 100);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: "1px solid var(--border)", height: 48, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font)", fontWeight: 600, fontSize: 15, letterSpacing: -0.5, color: "var(--fg)" }}>
            ic<span style={{ color: "var(--brand)" }}>paste</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--fg-3)", fontFamily: "var(--font)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 2 }}>
            BETA
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {DISTRIBUTORS.map(d => (
            <span key={d} style={{ fontSize: 11, color: "var(--fg-2)", fontFamily: "var(--font)", padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 2 }}>
              {d}
            </span>
          ))}
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", overflow: "auto" }}>
        <div style={{ width: "100%", maxWidth: 760 }}>

          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ fontFamily: "var(--font)", fontSize: 28, fontWeight: 600, letterSpacing: -1, color: "var(--fg)", marginBottom: 10, lineHeight: 1.2 }}>
              Find the best price<br />
              <span style={{ color: "var(--brand)" }}>for every component.</span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6, fontFamily: "var(--sans)", maxWidth: 480, margin: "0 auto" }}>
              Paste your BOM below. We search {DISTRIBUTORS.join(", ")} simultaneously
              and return only the best deal — stock included.
            </p>
          </div>

          {/* Input box */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--fg-3)", fontFamily: "var(--font)" }}>
                BOM INPUT
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {lineCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--brand)", fontFamily: "var(--font)" }}>
                    {lineCount} {lineCount === 1 ? "row" : "rows"}
                  </span>
                )}
                <span style={{ fontSize: 10, letterSpacing: 1, color: "var(--fg-3)", fontFamily: "var(--font)" }}>
                  MPN · QTY · ONE PER LINE
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: "flex", minHeight: 260 }}>
              {/* Line numbers */}
              <div style={{ width: 40, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border)", padding: "12px 0", userSelect: "none" }}>
                {displayLines.map((_, i) => (
                  <div key={i} style={{ fontFamily: "var(--font)", fontSize: 11, lineHeight: "22px", color: "var(--fg-3)", textAlign: "center" }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                style={{ flex: 1, background: "var(--bg)", border: "none", outline: "none", resize: "none", padding: "12px 16px", fontFamily: "var(--font)", fontSize: 13, lineHeight: "22px", color: "var(--fg)", minHeight: 260, caretColor: "var(--brand)" }}
              />
            </div>

            {/* Bottom bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--surface)", borderTop: "1px solid var(--border)", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font)", flexWrap: "wrap" }}>
                <span>CSV, tab or space separated</span>
                <span>Max 1000 rows</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <kbd style={{ background: "white", border: "1px solid var(--border-2)", borderRadius: 2, padding: "0 4px", fontSize: 10 }}>⌘ Enter</kbd>
                  <span>to search</span>
                </span>
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !input.trim()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 18px", background: loading || !input.trim() ? "var(--border)" : "var(--brand)", color: loading || !input.trim() ? "var(--fg-3)" : "var(--brand-fg)", border: "none", borderRadius: "var(--radius)", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font)", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, transition: "all 0.15s", whiteSpace: "nowrap" }}
              >
                {loading ? "Searching…" : "Find best prices →"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--red)", fontFamily: "var(--font)" }}>
              {error}
            </p>
          )}

          {/* Format hints */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
            {[
              { label: "MPN + QUANTITY",    example: "LM358N 100",     note: "space separated" },
              { label: "DISTRIBUTOR CODE",  example: "512-LM358N 100", note: "auto-resolved to MPN" },
              { label: "CSV / TAB FORMAT",  example: "LM358N,100",     note: "comma or tab" },
            ].map(h => (
              <div key={h.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: "var(--fg-3)", fontFamily: "var(--font)", marginBottom: 4 }}>{h.label}</div>
                <div style={{ fontSize: 12, fontFamily: "var(--font)", color: "var(--fg)", marginBottom: 2 }}>{h.example}</div>
                <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--sans)" }}>{h.note}</div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", height: 48, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font)" }}>© {new Date().getFullYear()} icpaste.com</span>
        <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font)" }}>Built for hardware buyers</span>
      </footer>

    </div>
  );
}

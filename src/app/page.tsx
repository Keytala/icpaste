"use client";

import { useState, useCallback } from "react";
import { useRouter }             from "next/navigation";
import { parseBom }              from "@/lib/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10
NE555P 250`;

const DISTRIBUTORS = ["Mouser", "Digi-Key", "Farnell"];

const S = {
  page: {
    minHeight: "100vh", display: "flex", flexDirection: "column" as const,
    background: "var(--bg)", fontFamily: "var(--font)",
  },
  header: {
    borderBottom: "1px solid var(--border)", padding: "0 24px",
    height: 48, display: "flex", alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { fontSize: 14, fontWeight: 600, letterSpacing: -0.3, color: "var(--fg)" },
  pills: { display: "flex", gap: 8, alignItems: "center" },
  pill: {
    fontSize: 11, color: "var(--fg-3)", border: "1px solid var(--border)",
    padding: "2px 8px", borderRadius: 99,
  },
  main: {
    flex: 1, display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center", padding: "32px 24px",
  },
  container: { width: "100%", maxWidth: "var(--max-w)" },
  headline: { textAlign: "center" as const, marginBottom: 32 },
  title: {
    fontSize: 28, fontWeight: 600, letterSpacing: -0.8,
    lineHeight: 1.2, color: "var(--fg)", marginBottom: 8,
  },
  subtitle: { fontSize: 13, color: "var(--fg-3)", lineHeight: 1.7 },
  box: {
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    background: "var(--bg)", overflow: "hidden",
  },
  boxTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 14px", background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
  },
  boxLabel: { fontSize: 11, color: "var(--fg-3)", letterSpacing: 0.5 },
  boxBody: { display: "flex", minHeight: 260 },
  lineNums: {
    width: 36, flexShrink: 0, padding: "12px 0",
    borderRight: "1px solid var(--border)", background: "var(--surface)",
    display: "flex", flexDirection: "column" as const, alignItems: "center",
    userSelect: "none" as const,
  },
  lineNum: { fontSize: 11, lineHeight: "22px", color: "var(--fg-3)", width: "100%", textAlign: "center" as const },
  textarea: {
    flex: 1, padding: "12px 14px", fontFamily: "var(--font)",
    fontSize: 13, lineHeight: "22px", color: "var(--fg)",
    background: "transparent", border: "none", outline: "none",
    resize: "none" as const, minHeight: 260, caretColor: "var(--fg)",
  },
  boxBottom: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 14px", background: "var(--surface)",
    borderTop: "1px solid var(--border)", gap: 12,
  },
  hints: { display: "flex", gap: 12, fontSize: 11, color: "var(--fg-3)", flexWrap: "wrap" as const },
  kbd: {
    border: "1px solid var(--border)", borderRadius: 3,
    padding: "0 5px", fontSize: 10, color: "var(--fg-2)",
    background: "var(--bg)",
  },
  btn: {
    padding: "6px 16px", background: "var(--fg)", color: "var(--brand-fg)",
    fontSize: 12, fontWeight: 600, fontFamily: "var(--font)",
    border: "none", borderRadius: "var(--radius)", cursor: "pointer",
    letterSpacing: 0.3, flexShrink: 0,
  },
  btnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  hints3: {
    display: "grid", gridTemplateColumns: "repeat(3,1fr)",
    gap: 8, marginTop: 10,
  },
  hintCard: {
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "10px 12px", background: "var(--surface)",
  },
  hintLabel: { fontSize: 10, color: "var(--fg-3)", marginBottom: 4, letterSpacing: 0.5 },
  hintExample: { fontSize: 12, color: "var(--fg)", marginBottom: 2 },
  hintNote: { fontSize: 10, color: "var(--fg-3)" },
  footer: {
    borderTop: "1px solid var(--border)", height: 48,
    display: "flex", alignItems: "center", padding: "0 24px",
  },
  footerInner: {
    maxWidth: "var(--max-w)", margin: "0 auto", width: "100%",
    display: "flex", justifyContent: "space-between",
  },
  footerText: { fontSize: 11, color: "var(--fg-3)" },
};

export default function HomePage() {
  const router  = useRouter();
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const lines     = (input || PLACEHOLDER).split("\n");
  const lineCount = input.split("\n").filter(l => l.trim()).length;

  const handleSearch = useCallback(() => {
    setError("");
    const bom = parseBom(input);
    if (!bom.length) { setError("No valid components found. Format: MPN QTY (one per line)"); return; }
    setLoading(true);
    router.push(`/results?bom=${btoa(JSON.stringify(bom))}`);
  }, [input, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSearch(); }
  }, [handleSearch]);

  return (
    <div style={S.page}>

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo}>ic<span style={{ color: "var(--fg-2)" }}>paste</span></div>
        <div style={S.pills}>
          {DISTRIBUTORS.map(d => <span key={d} style={S.pill}>{d}</span>)}
        </div>
      </header>

      {/* Main */}
      <main style={S.main}>
        <div style={S.container}>

          {/* Headline */}
          <div style={S.headline}>
            <h1 style={S.title}>Find the best price<br />for every component.</h1>
            <p style={S.subtitle}>
              Paste your BOM. We search {DISTRIBUTORS.join(", ")} simultaneously<br />
              and return only the best deal — stock and quantity optimized.
            </p>
          </div>

          {/* Input box */}
          <div style={S.box}>
            <div style={S.boxTop}>
              <span style={S.boxLabel}>BOM INPUT</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {lineCount > 0 && (
                  <span style={{ ...S.boxLabel, color: "var(--fg-2)", fontWeight: 600 }}>
                    {lineCount} rows
                  </span>
                )}
                <span style={S.boxLabel}>MPN · QTY · ONE PER LINE</span>
              </div>
            </div>

            <div style={S.boxBody}>
              <div style={S.lineNums}>
                {lines.slice(0, 100).map((_, i) => (
                  <div key={i} style={S.lineNum}>{i + 1}</div>
                ))}
              </div>
              <textarea
                style={S.textarea}
                placeholder={PLACEHOLDER}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>

            <div style={S.boxBottom}>
              <div style={S.hints}>
                <span>CSV, tab or space separated</span>
                <span>Max 1000 rows</span>
                <span><kbd style={S.kbd}>⌘ Enter</kbd> to search</span>
              </div>
              <button
                style={{ ...S.btn, ...(loading || !input.trim() ? S.btnDisabled : {}) }}
                onClick={handleSearch}
                disabled={loading || !input.trim()}
              >
                {loading ? "Searching..." : "Find best prices →"}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{error}</p>
          )}

          {/* Format hints */}
          <div style={S.hints3}>
            {[
              { label: "MPN + QUANTITY",    example: "LM358N 100",     note: "space separated" },
              { label: "CSV / TAB FORMAT",  example: "LM358N,100",     note: "comma or tab" },
              { label: "DISTRIBUTOR CODE",  example: "512-LM358N 100", note: "auto-resolved to MPN" },
            ].map(h => (
              <div key={h.label} style={S.hintCard}>
                <div style={S.hintLabel}>{h.label}</div>
                <div style={S.hintExample}>{h.example}</div>
                <div style={S.hintNote}>{h.note}</div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <span style={S.footerText}>© {new Date().getFullYear()} icpaste.com</span>
          <span style={S.footerText}>Built for hardware buyers</span>
        </div>
      </footer>

    </div>
  );
}

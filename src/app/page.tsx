"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseBom }  from "@/lib/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10
NE555P 250`;

const FEATURES = [
  { icon: "⚡", title: "Instant results",  desc: "Search across all major distributors simultaneously" },
  { icon: "📦", title: "Qty optimized",    desc: "Package units and price breaks calculated automatically" },
  { icon: "💰", title: "Best price",       desc: "Always shows the cheapest option with stock available" },
];

export default function HomePage() {
  const router  = useRouter();
  const [input, setInput]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = input.split("\n").filter(l => l.trim()).length;

  const handleSearch = useCallback(() => {
    setError("");
    const bom = parseBom(input);
    if (!bom.length) {
      setError("No valid components found. Format: MPN QUANTITY — one per line.");
      return;
    }
    setLoading(true);
    router.push(`/results?bom=${btoa(JSON.stringify(bom))}`);
  }, [input, router]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>icpaste</span>
          <span style={{ fontSize: 10, fontWeight: 600, background: "var(--fg)", color: "var(--brand-fg)", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.5 }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Mouser", "Digi-Key", "Farnell", "TME"].map(d => (
            <span key={d} style={{ fontSize: 11, color: "var(--fg-2)", background: "var(--surface)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 99 }}>{d}</span>
          ))}
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 720 }}>

          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.15, marginBottom: 12 }}>
              Find the best price<br />
              <span style={{ color: "var(--fg-2)" }}>for every component.</span>
            </h1>
            <p style={{ fontSize: 15, color: "var(--fg-2)", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
              Paste your BOM below. We search all major distributors simultaneously and return only the best deal — stock included.
            </p>
          </div>

          {/* Input box */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow)", background: "var(--bg)" }}>

            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "var(--fg-3)" }}>BOM Input</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {lineCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--fg)", background: "var(--border)", padding: "1px 8px", borderRadius: 99 }}>
                    {lineCount} {lineCount === 1 ? "component" : "components"}
                  </span>
                )}
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "var(--fg-3)" }}>MPN · QTY · one per line</span>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={taRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              style={{
                width: "100%", minHeight: 260, padding: "14px 16px",
                fontSize: 13, lineHeight: "22px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                background: "var(--bg)", color: "var(--fg)", border: "none", outline: "none", resize: "none",
                display: "block",
              }}
            />

            {/* Bottom bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--surface)", borderTop: "1px solid var(--border)", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--fg-3)", flexWrap: "wrap" }}>
                <span>CSV, tab or space separated</span>
                <span>Max 1000 rows</span>
                <span>
                  <kbd style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontSize: 10, color: "var(--fg-2)" }}>⌘ Enter</kbd>
                  {" "}to search
                </span>
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !input.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 18px", background: loading || !input.trim() ? "var(--border)" : "var(--brand)",
                  color: loading || !input.trim() ? "var(--fg-3)" : "var(--brand-fg)",
                  fontSize: 13, fontWeight: 600, border: "none", borderRadius: "var(--radius)",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                    Searching…
                  </>
                ) : "Find best prices →"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--red)", padding: "0 2px" }}>{error}</p>
          )}

          {/* Format hints */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
            {[
              { label: "MPN + Quantity",   example: "LM358N 100",     note: "space separated" },
              { label: "Distributor code", example: "512-LM358N 100", note: "auto-resolved to MPN" },
              { label: "CSV / tab format", example: "LM358N,100",     note: "comma or tab" },
            ].map(h => (
              <div key={h.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 4 }}>{h.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--fg)", marginBottom: 2 }}>{h.example}</div>
                <div style={{ fontSize: 10, color: "var(--fg-3)" }}>{h.note}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", height: 52, display: "flex", alignItems: "center", padding: "0 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>© {new Date().getFullYear()} icpaste.com</span>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Built for hardware buyers</span>
        </div>
      </footer>

    </div>
  );
}

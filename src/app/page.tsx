"use client";

import { useState, useCallback } from "react";
import { useRouter }             from "next/navigation";
import { parseBom }              from "@/lib/bom-parser";

const DISTRIBUTORS = ["Mouser", "Digi-Key", "Farnell"];

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10
NE555P 250`;

const S = {
  page: {
    minHeight:      "100vh",
    display:        "flex",
    flexDirection:  "column" as const,
    background:     "var(--bg)",
    fontFamily:     "var(--font)",
  },
  header: {
    borderBottom:   "1px solid var(--border)",
    padding:        "0 32px",
    height:         48,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    flexShrink:     0,
  },
  logo: {
    fontSize:   14,
    fontWeight: 600,
    color:      "var(--text-1)",
    letterSpacing: "-0.3px",
  },
  logoAccent: {
    color: "var(--accent)",
  },
  headerRight: {
    display:    "flex",
    alignItems: "center",
    gap:        16,
    fontSize:   11,
    color:      "var(--text-3)",
  },
  main: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column" as const,
    alignItems:     "center",
    justifyContent: "center",
    padding:        "32px 24px",
  },
  container: {
    width:    "100%",
    maxWidth: 720,
  },
  headline: {
    marginBottom: 28,
  },
  title: {
    fontSize:      28,
    fontWeight:    600,
    letterSpacing: "-0.5px",
    lineHeight:    1.2,
    color:         "var(--text-1)",
    marginBottom:  8,
  },
  subtitle: {
    fontSize: 12,
    color:    "var(--text-2)",
  },
  box: {
    border:       "1px solid var(--border)",
    background:   "var(--bg)",
  },
  boxTop: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "6px 12px",
    borderBottom:   "1px solid var(--border)",
    background:     "var(--surface)",
  },
  boxLabel: {
    fontSize:      10,
    fontWeight:    600,
    letterSpacing: "0.1em",
    color:         "var(--text-3)",
    textTransform: "uppercase" as const,
  },
  boxBody: {
    display:   "flex",
    minHeight: 260,
  },
  lineNums: {
    width:          36,
    flexShrink:     0,
    borderRight:    "1px solid var(--border)",
    background:     "var(--surface)",
    padding:        "12px 0",
    display:        "flex",
    flexDirection:  "column" as const,
    alignItems:     "center",
    userSelect:     "none" as const,
  },
  lineNum: {
    fontSize:   10,
    lineHeight: "22px",
    color:      "var(--text-3)",
    width:      "100%",
    textAlign:  "center" as const,
  },
  textarea: {
    flex:        1,
    padding:     "12px 14px",
    fontFamily:  "var(--font)",
    fontSize:    13,
    lineHeight:  "22px",
    color:       "var(--text-1)",
    background:  "transparent",
    border:      "none",
    outline:     "none",
    resize:      "none" as const,
    minHeight:   260,
  },
  boxBottom: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "6px 12px",
    borderTop:      "1px solid var(--border)",
    background:     "var(--surface)",
    gap:            12,
  },
  hints: {
    display:  "flex",
    gap:      16,
    fontSize: 10,
    color:    "var(--text-3)",
  },
  kbd: {
    border:        "1px solid var(--border)",
    padding:       "0 4px",
    fontSize:      10,
    background:    "white",
    color:         "var(--text-2)",
  },
  btn: {
    padding:       "5px 16px",
    background:    "var(--text-1)",
    color:         "white",
    border:        "none",
    fontSize:      12,
    fontFamily:    "var(--font)",
    fontWeight:    600,
    cursor:        "pointer",
    letterSpacing: "0.05em",
    flexShrink:    0,
  },
  btnDisabled: {
    opacity: 0.4,
    cursor:  "not-allowed",
  },
  error: {
    marginTop: 8,
    fontSize:  11,
    color:     "var(--red)",
  },
  hints2: {
    display:             "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap:                 8,
    marginTop:           10,
  },
  hintCard: {
    border:     "1px solid var(--border)",
    padding:    "8px 12px",
    background: "var(--surface)",
  },
  hintLabel: {
    fontSize:      9,
    fontWeight:    600,
    letterSpacing: "0.1em",
    color:         "var(--text-3)",
    textTransform: "uppercase" as const,
    marginBottom:  3,
  },
  hintExample: {
    fontSize: 12,
    color:    "var(--text-1)",
  },
  hintNote: {
    fontSize: 10,
    color:    "var(--text-3)",
  },
  footer: {
    borderTop:      "1px solid var(--border)",
    height:         40,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "0 32px",
    flexShrink:     0,
    fontSize:       10,
    color:          "var(--text-3)",
  },
};

export default function HomePage() {
  const router  = useRouter();
  const [input,   setInput]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const lines     = (input || PLACEHOLDER).split("\n");
  const lineCount = input.split("\n").filter(l => l.trim()).length;

  const handleSearch = useCallback(() => {
    setError("");
    const bom = parseBom(input);
    if (!bom.length) {
      setError("! no valid MPN/QTY pairs found");
      return;
    }
    setLoading(true);
    const encoded = btoa(JSON.stringify(bom));
    router.push(`/results?bom=${encoded}`);
  }, [input, router]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo}>
          ic<span style={S.logoAccent}>paste</span>
          <span style={{ color: "var(--text-3)", fontWeight: 400, marginLeft: 8 }}>
            // bom price finder
          </span>
        </div>
        <div style={S.headerRight}>
          {DISTRIBUTORS.map(d => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </header>

      {/* Main */}
      <main style={S.main}>
        <div style={S.container}>

          {/* Headline */}
          <div style={S.headline}>
            <div style={S.title}>
              find the best price<br />
              <span style={{ color: "var(--accent)" }}>for every component.</span>
            </div>
            <div style={S.subtitle}>
              paste your BOM below — we search {DISTRIBUTORS.join(", ")} and return only the best deal.
            </div>
          </div>

          {/* Input box */}
          <div style={S.box}>

            {/* Top bar */}
            <div style={S.boxTop}>
              <span style={S.boxLabel}>BOM_INPUT</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {lineCount > 0 && (
                  <span style={{ ...S.boxLabel, color: "var(--accent)" }}>
                    {lineCount} rows
                  </span>
                )}
                <span style={S.boxLabel}>MPN · QTY · one per line</span>
              </div>
            </div>

            {/* Body */}
            <div style={S.boxBody}>
              <div style={S.lineNums}>
                {lines.slice(0, 100).map((_, i) => (
                  <div key={i} style={S.lineNum}>{i + 1}</div>
                ))}
              </div>
              <textarea
                style={S.textarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>

            {/* Bottom bar */}
            <div style={S.boxBottom}>
              <div style={S.hints}>
                <span>csv / tab / space</span>
                <span>max 1000 rows</span>
                <span>
                  <kbd style={S.kbd}>⌘ Enter</kbd> to search
                </span>
              </div>
              <button
                style={{
                  ...S.btn,
                  ...(loading || !input.trim() ? S.btnDisabled : {}),
                }}
                onClick={handleSearch}
                disabled={loading || !input.trim()}
              >
                {loading ? "searching..." : "> find best prices"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <div style={S.error}>{error}</div>}

          {/* Format hints */}
          <div style={S.hints2}>
            {[
              { label: "MPN + QTY",         example: "LM358N 100",     note: "space separated"  },
              { label: "CSV format",         example: "LM358N,100",     note: "comma or tab"     },
              { label: "Distributor code",   example: "512-LM358N 100", note: "auto-resolved"    },
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
        <span>© {new Date().getFullYear()} icpaste.com</span>
        <span>built for hardware buyers</span>
      </footer>

    </div>
  );
}

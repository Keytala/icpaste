"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter }                      from "next/navigation";
import { parseBom }                       from "@/lib/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10
NE555P 250`;

const DISTRIBUTORS = ["Mouser", "Digi-Key", "Farnell"];

export default function HomePage() {
  const router               = useRouter();
  const [input, setInput]    = useState("");
  const [error, setError]    = useState("");
  const [loading, setLoading]= useState(false);
  const textareaRef          = useRef<HTMLTextAreaElement>(null);

  const lineCount = input.split("\n").filter(l => l.trim()).length;

  const handleSearch = useCallback(() => {
    setError("");
    const bom = parseBom(input);
    if (!bom.length) {
      setError("no valid MPN/QTY pairs found — example: LM358N 100");
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
    <div style={{
      minHeight:     "100vh",
      display:       "flex",
      flexDirection: "column",
      background:    "var(--bg)",
      fontFamily:    "var(--font)",
    }}>

      {/* ── Header ── */}
      <header style={{
        borderBottom:   "1px solid var(--border)",
        padding:        "0 32px",
        height:         52,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text-1)", fontWeight: 700, fontSize: 15, letterSpacing: -0.5 }}>
            icpaste
          </span>
          <span style={{
            fontSize:      10,
            fontWeight:    700,
            color:         "var(--accent)",
            background:    "var(--accent-bg)",
            border:        "1px solid #bfdbfe",
            padding:       "1px 6px",
            letterSpacing: 1,
          }}>
            BETA
          </span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {DISTRIBUTORS.map(d => (
            <span key={d} style={{ color: "var(--text-3)", fontSize: 12 }}>
              {d}
            </span>
          ))}
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{
        flex:           1,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "0 24px",
        overflow:       "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 820, padding: "32px 0" }}>

          {/* Titolo */}
          <div style={{ marginBottom: 28, textAlign: "center" }}>
            <h1 style={{
              fontSize:      38,
              fontWeight:    700,
              letterSpacing: -1.5,
              lineHeight:    1.15,
              color:         "var(--text-1)",
              marginBottom:  10,
            }}>
              Find the best price<br />
              <span style={{ color: "var(--text-3)" }}>for every component.</span>
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>
              Paste your BOM. We search {DISTRIBUTORS.join(", ")} simultaneously
              and return only the best deal — stock included.
            </p>
          </div>

          {/* Input box */}
          <div style={{
            border:     "1px solid var(--border-2)",
            background: "var(--bg)",
            boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
          }}>

            {/* Top bar */}
            <div style={{
              borderBottom:   "1px solid var(--border)",
              padding:        "7px 14px",
              background:     "var(--surface)",
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
            }}>
              <span style={{ color: "var(--text-3)", fontSize: 11, letterSpacing: 0.5 }}>
                BOM INPUT
              </span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {lineCount > 0 && (
                  <span style={{
                    color:      "var(--accent)",
                    fontSize:   11,
                    background: "var(--accent-bg)",
                    border:     "1px solid #bfdbfe",
                    padding:    "1px 8px",
                  }}>
                    {lineCount} rows
                  </span>
                )}
                <span style={{ color: "var(--text-4)", fontSize: 11 }}>
                  MPN · QTY · one per line
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: "flex", minHeight: 280 }}>

              {/* Line numbers */}
              <div style={{
                width:       40,
                borderRight: "1px solid var(--border)",
                padding:     "14px 0",
                background:  "var(--surface)",
                userSelect:  "none",
                flexShrink:  0,
              }}>
                {(input || PLACEHOLDER).split("\n").slice(0, 100).map((_, i) => (
                  <div key={i} style={{
                    textAlign:  "center",
                    fontSize:   11,
                    lineHeight: "22px",
                    color:      "var(--text-4)",
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                style={{
                  flex:       1,
                  background: "transparent",
                  border:     "none",
                  outline:    "none",
                  resize:     "none",
                  padding:    "14px 16px",
                  fontFamily: "var(--font)",
                  fontSize:   13,
                  lineHeight: "22px",
                  color:      "var(--text-1)",
                  minHeight:  280,
                  caretColor: "var(--accent)",
                }}
              />
            </div>

            {/* Bottom bar */}
            <div style={{
              borderTop:      "1px solid var(--border)",
              padding:        "8px 14px",
              background:     "var(--surface)",
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              gap:            12,
            }}>
              <div style={{
                display:  "flex",
                gap:      16,
                color:    "var(--text-3)",
                fontSize: 11,
                flexWrap: "wrap",
              }}>
                <span>CSV, tab or space</span>
                <span>Max 1000 rows</span>
                <span style={{ color: "var(--text-4)" }}>
                  <kbd style={{
                    background:   "var(--bg)",
                    border:       "1px solid var(--border-2)",
                    padding:      "0 5px",
                    fontSize:     10,
                    borderRadius: 2,
                  }}>⌘ Enter</kbd>
                  {" "}to search
                </span>
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !input.trim()}
                style={{
                  background:    loading || !input.trim() ? "var(--surface)" : "var(--text-1)",
                  color:         loading || !input.trim() ? "var(--text-3)" : "var(--bg)",
                  border:        `1px solid ${loading || !input.trim() ? "var(--border-2)" : "var(--text-1)"}`,
                  padding:       "6px 20px",
                  fontFamily:    "var(--font)",
                  fontSize:      12,
                  fontWeight:    700,
                  cursor:        loading || !input.trim() ? "not-allowed" : "pointer",
                  letterSpacing: 0.5,
                  flexShrink:    0,
                  transition:    "all 0.15s",
                }}
              >
                {loading ? "Searching..." : "Find best prices →"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>
              ✗ {error}
            </div>
          )}

          {/* Format hints */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 8,
            marginTop:           10,
          }}>
            {[
              { label: "MPN + Quantity",   example: "LM358N 100",     note: "space separated" },
              { label: "CSV / tab format", example: "LM358N,100",     note: "comma or tab" },
              { label: "Distributor code", example: "512-LM358N 100", note: "auto-resolved to MPN" },
            ].map(h => (
              <div key={h.label} style={{
                border:  "1px solid var(--border)",
                padding: "9px 12px",
                background: "var(--surface)",
              }}>
                <div style={{ color: "var(--text-3)", fontSize: 10, marginBottom: 3, letterSpacing: 0.5 }}>
                  {h.label.toUpperCase()}
                </div>
                <div style={{ color: "var(--text-1)", fontSize: 12, marginBottom: 2 }}>
                  {h.example}
                </div>
                <div style={{ color: "var(--text-4)", fontSize: 10 }}>
                  {h.note}
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop:      "1px solid var(--border)",
        height:         52,
        display:        "flex",
        alignItems:     "center",
        padding:        "0 32px",
        justifyContent: "space-between",
      }}>
        <span style={{ color: "var(--text-4)", fontSize: 11 }}>
          © {new Date().getFullYear()} icpaste.com
        </span>
        <span style={{ color: "var(--text-4)", fontSize: 11 }}>
          Built for hardware buyers
        </span>
      </footer>

    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseBom } from "@/lib/bom-parser";

const PLACEHOLDER = `LM358N 100
BC547B 500
GRM188R71C104KA01D 6800
STM32F103C8T6 10
NE555P 250`;

const DISTRIBUTORS = ["Mouser", "Digi-Key", "Farnell"];

export default function HomePage() {
  const router              = useRouter();
  const [input, setInput]   = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef         = useRef<HTMLTextAreaElement>(null);

  const lineCount = input.split("\n").filter(l => l.trim()).length;

  const handleSearch = useCallback(() => {
    setError("");
    const bom = parseBom(input);
    if (!bom.length) {
      setError("ERR: no valid MPN/QTY pairs found");
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
      minHeight:      "100vh",
      display:        "flex",
      flexDirection:  "column",
      background:     "var(--bg)",
      fontFamily:     "var(--font)",
    }}>

      {/* ── Header ── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding:      "8px 24px",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 16 }}>
            ic<span style={{ color: "var(--text-3)" }}>paste</span>
          </span>
          <span style={{
            color:      "var(--green-dark)",
            fontSize:   11,
            border:     "1px solid var(--green-dark)",
            padding:    "1px 6px",
          }}>
            BETA
          </span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {DISTRIBUTORS.map(d => (
            <span key={d} style={{
              color:    "var(--text-3)",
              fontSize: 12,
            }}>
              [{d}]
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
        padding:        "32px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 800 }}>

          {/* Titolo */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{
              color:      "var(--green)",
              fontSize:   28,
              fontWeight: 700,
              lineHeight: 1.3,
              marginBottom: 8,
            }}>
              FIND THE BEST PRICE<br />
              <span style={{ color: "var(--text-3)" }}>FOR EVERY COMPONENT.</span>
            </div>
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>
              &gt; paste your BOM below. we search {DISTRIBUTORS.join(", ")} simultaneously.
            </div>
          </div>

          {/* Input box */}
          <div style={{
            border:     "1px solid var(--border-2)",
            background: "var(--surface)",
          }}>
            {/* Top bar */}
            <div style={{
              borderBottom:   "1px solid var(--border)",
              padding:        "6px 12px",
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
            }}>
              <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                BOM_INPUT.TXT
              </span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {lineCount > 0 && (
                  <span style={{ color: "var(--green)", fontSize: 11 }}>
                    {lineCount} ROWS
                  </span>
                )}
                <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                  MPN · QTY · ONE PER LINE
                </span>
              </div>
            </div>

            {/* Textarea */}
            <div style={{ display: "flex", minHeight: 280 }}>
              {/* Line numbers */}
              <div style={{
                width:       40,
                borderRight: "1px solid var(--border)",
                padding:     "12px 0",
                background:  "var(--bg)",
                userSelect:  "none",
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
                  padding:    "12px 16px",
                  fontFamily: "var(--font)",
                  fontSize:   13,
                  lineHeight: "22px",
                  color:      "var(--green)",
                  minHeight:  280,
                  caretColor: "var(--green)",
                }}
              />
            </div>

            {/* Bottom bar */}
            <div style={{
              borderTop:      "1px solid var(--border)",
              padding:        "8px 12px",
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              background:     "var(--bg)",
            }}>
              <div style={{ display: "flex", gap: 16, color: "var(--text-3)", fontSize: 11 }}>
                <span>CSV/TAB/SPACE</span>
                <span>MAX 1000 ROWS</span>
                <span style={{ color: "var(--text-4)" }}>
                  [CTRL+ENTER] TO SEARCH
                </span>
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !input.trim()}
                style={{
                  background:  loading || !input.trim() ? "transparent" : "var(--green)",
                  color:       loading || !input.trim() ? "var(--text-3)" : "var(--bg)",
                  border:      `1px solid ${loading || !input.trim() ? "var(--border-2)" : "var(--green)"}`,
                  padding:     "5px 20px",
                  fontFamily:  "var(--font)",
                  fontSize:    13,
                  fontWeight:  700,
                  cursor:      loading || !input.trim() ? "not-allowed" : "pointer",
                  letterSpacing: 1,
                }}
              >
                {loading ? "SEARCHING..." : "> FIND BEST PRICES"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>
              {error}
            </div>
          )}

          {/* Format hints */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 8,
            marginTop:           12,
          }}>
            {[
              { label: "MPN + QTY",         example: "LM358N 100",     note: "space separated" },
              { label: "CSV FORMAT",         example: "LM358N,100",     note: "comma or tab" },
              { label: "DISTRIBUTOR CODE",   example: "512-LM358N 100", note: "auto-resolved" },
            ].map(h => (
              <div key={h.label} style={{
                border:  "1px solid var(--border)",
                padding: "8px 12px",
              }}>
                <div style={{ color: "var(--text-3)", fontSize: 10, marginBottom: 4 }}>
                  // {h.label}
                </div>
                <div style={{ color: "var(--green)", fontSize: 12 }}>
                  {h.example}
                </div>
                <div style={{ color: "var(--text-4)", fontSize: 10, marginTop: 2 }}>
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
        padding:        "8px 24px",
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
      }}>
        <span style={{ color: "var(--text-4)", fontSize: 11 }}>
          © {new Date().getFullYear()} ICPASTE.COM
        </span>
        <span style={{ color: "var(--text-4)", fontSize: 11 }}>
          BUILT FOR HARDWARE BUYERS
        </span>
      </footer>

    </div>
  );
}

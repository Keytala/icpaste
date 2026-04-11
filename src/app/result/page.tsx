"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter }                  from "next/navigation";
import { SearchResponse, ResultRow, Adjustment }       from "@/lib/types";

// ── Colori distributori ───────────────────────────────────────────────────────
const DIST_COLOR: Record<string, string> = {
  "Mouser":   "#00ff41",
  "Digi-Key": "#ffb000",
  "Farnell":  "#00ffff",
  "TME":      "#ff6600",
};
function distColor(name: string) {
  return DIST_COLOR[name] ?? "#00cc33";
}

// ── Badge ADJ ─────────────────────────────────────────────────────────────────
const ADJ_LABEL: Record<Adjustment, string> = {
  none:      "",
  package:   "PKG",
  pricestep: "STEP",
  both:      "PKG+STEP",
};
const ADJ_COLOR: Record<Adjustment, string> = {
  none:      "",
  package:   "#ffb000",
  pricestep: "#00ff41",
  both:      "#00ffff",
};

function AdjBadge({ adj, saved, currency }: { adj: Adjustment; saved: number; currency: string }) {
  if (adj === "none") return null;
  return (
    <span style={{
      color:        ADJ_COLOR[adj],
      border:       `1px solid ${ADJ_COLOR[adj]}`,
      fontSize:     9,
      padding:      "0 4px",
      marginLeft:   4,
      letterSpacing: 0.5,
      whiteSpace:   "nowrap",
      title:        saved > 0 ? `saves ${currency} ${saved.toFixed(2)}` : "",
    }}>
      {ADJ_LABEL[adj]}
      {saved > 0 && ` -${currency}${saved.toFixed(2)}`}
    </span>
  );
}

// ── Riga risultato ────────────────────────────────────────────────────────────
function ResultRow_({ r, onResolve }: { r: ResultRow; onResolve: (mpn: string) => void }) {
  const isOos      = r.error === "Out of stock";
  const isNotFound = Boolean(r.error && !isOos);
  const color      = isNotFound ? "var(--text-3)" : isOos ? "var(--amber)" : "var(--green)";

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>

      {/* MPN */}
      <td style={{ padding: "8px 12px", color: "var(--green)", fontWeight: 700, whiteSpace: "nowrap" }}>
        {r.mpn}
      </td>

      {/* Description */}
      <td style={{
        padding:      "8px 12px",
        color:        "var(--text-3)",
        fontSize:     12,
        maxWidth:     200,
        overflow:     "hidden",
        textOverflow: "ellipsis",
        whiteSpace:   "nowrap",
      }}>
        {r.description || "—"}
      </td>

      {/* Requested */}
      <td style={{ padding: "8px 12px", color: "var(--text-3)", textAlign: "right" }}>
        {r.requestedQty.toLocaleString()}
      </td>

      {/* Buy Qty */}
      <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
        {isNotFound ? (
          <span style={{ color: "var(--text-4)" }}>—</span>
        ) : (
          <>
            <span style={{
              color:      r.adjustment !== "none" ? "var(--amber)" : "var(--green)",
              fontWeight: 700,
            }}>
              {r.optimalQty.toLocaleString()}
            </span>
            <AdjBadge adj={r.adjustment} saved={r.saved} currency={r.currency} />
          </>
        )}
      </td>

      {/* Unit Price */}
      <td style={{ padding: "8px 12px", color: "var(--text-2)", textAlign: "right" }}>
        {isNotFound ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
      </td>

      {/* Total */}
      <td style={{ padding: "8px 12px", color, fontWeight: 700, textAlign: "right" }}>
        {isNotFound ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
      </td>

      {/* Best Deal */}
      <td style={{ padding: "8px 12px", textAlign: "right" }}>
        {isNotFound ? (
          <span style={{ color: "var(--red)", fontSize: 11 }}>[NOT FOUND]</span>
        ) : isOos ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
            <span style={{ color: "var(--amber)", fontSize: 11 }}>[OOS]</span>
            {r.fallback && (
              <button
                onClick={() => onResolve(r.mpn)}
                style={{
                  background:   "transparent",
                  border:       "1px solid var(--green)",
                  color:        "var(--green)",
                  fontSize:     11,
                  padding:      "2px 8px",
                  cursor:       "pointer",
                  fontFamily:   "var(--font)",
                  letterSpacing: 0.5,
                }}
              >
                [RESOLVE]
              </button>
            )}
          </div>
        ) : (
          <a
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color:          distColor(r.distributor),
              textDecoration: "none",
              fontSize:       12,
              border:         `1px solid ${distColor(r.distributor)}`,
              padding:        "2px 8px",
              whiteSpace:     "nowrap",
            }}
          >
            [{r.distributor} ↗]
          </a>
        )}
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ResultsContent() {
  const params    = useSearchParams();
  const router    = useRouter();
  const [data, setData]       = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Production run
  const [prodQty, setProdQty]       = useState("");
  const [activeProd, setActiveProd] = useState(1);
  const [origBom, setOrigBom]       = useState<{ mpn: string; qty: number }[]>([]);

  useEffect(() => {
    const encoded = params.get("bom");
    if (!encoded) { router.push("/"); return; }
    let bom: { mpn: string; qty: number }[];
    try { bom = JSON.parse(atob(encoded)); }
    catch { router.push("/"); return; }
    setOrigBom(bom);
    fetchResults(bom);
  }, [params]);

  async function fetchResults(bom: { mpn: string; qty: number }[]) {
    setLoading(true);
    try {
      const res  = await fetch("/api/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bom }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json as SearchResponse);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Resolve OOS
  const handleResolve = useCallback((mpn: string) => {
    if (!data) return;
    const updated = data.results.map(r => {
      if (r.mpn !== mpn || !r.fallback) return r;
      const fb = r.fallback;
      return {
        ...r,
        distributor:  fb.distributor,
        optimalQty:   fb.optimalQty,
        unitPrice:    fb.unitPrice,
        totalPrice:   fb.totalPrice,
        currency:     fb.currency,
        stock:        fb.stock,
        productUrl:   fb.productUrl,
        adjustment:   "none" as Adjustment,
        saved:        0,
        error:        undefined,
        fallback:     undefined,
      };
    });
    const newTotal = parseFloat(updated.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2));
    setData({ ...data, results: updated, totalBom: newTotal });
  }, [data]);

  // Apply production run
  function handleApplyProd() {
    const n = parseInt(prodQty, 10);
    if (!n || n <= 0 || !origBom.length) return;
    setActiveProd(n);
    fetchResults(origBom.map(r => ({ mpn: r.mpn, qty: r.qty * n })));
  }

  function handleResetProd() {
    setActiveProd(1);
    setProdQty("");
    fetchResults(origBom);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "var(--bg)",
        gap:            16,
      }}>
        <div style={{ color: "var(--green)", fontSize: 14 }}>
          &gt; SEARCHING DISTRIBUTORS...
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["MOUSER", "DIGI-KEY", "FARNELL"].map((d, i) => (
            <span key={d} style={{
              color:     "var(--text-3)",
              fontSize:  12,
              animation: `pulse 1.2s ease infinite`,
              animationDelay: `${i * 0.2}s`,
            }}>
              [{d}]
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "var(--bg)",
        gap:            16,
      }}>
        <div style={{ color: "var(--red)" }}>ERR: {error}</div>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "transparent",
            border:     "1px solid var(--green)",
            color:      "var(--green)",
            padding:    "6px 16px",
            fontFamily: "var(--font)",
            cursor:     "pointer",
          }}
        >
          [BACK]
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Stats
  const found      = data.results.filter(r => !r.error);
  const oos        = data.results.filter(r => r.error === "Out of stock");
  const notFound   = data.results.filter(r => r.error && r.error !== "Out of stock");
  const adjusted   = data.results.filter(r => r.adjustment !== "none");
  const totalSaved = data.results.reduce((s, r) => s + (r.saved ?? 0), 0);

  // Distributor breakdown
  const distCount = found.reduce((acc, r) => {
    acc[r.distributor] = (acc[r.distributor] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
        padding:        "8px 24px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        position:       "sticky",
        top:            0,
        background:     "var(--bg)",
        zIndex:         10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "transparent",
              border:     "none",
              color:      "var(--text-3)",
              fontFamily: "var(--font)",
              fontSize:   13,
              cursor:     "pointer",
              padding:    0,
            }}
          >
            &lt; NEW SEARCH
          </button>
          <span style={{ color: "var(--border-2)" }}>|</span>
          <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>
            ic<span style={{ color: "var(--text-3)" }}>paste</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {Object.entries(distCount).map(([dist, count]) => (
            <span key={dist} style={{
              color:   distColor(dist),
              fontSize: 12,
              border:  `1px solid ${distColor(dist)}`,
              padding: "1px 8px",
            }}>
              {dist} · {count}
            </span>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "20px 24px" }}>

        {/* ── Stats ── */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap:                 8,
          marginBottom:        16,
          borderBottom:        "1px solid var(--border)",
          paddingBottom:       16,
        }}>
          {[
            { label: "BOM TOTAL",   value: `${data.results[0]?.currency ?? "USD"} ${data.totalBom.toFixed(2)}`, color: "var(--green)" },
            { label: "FOUND",       value: `${found.length}/${data.results.length}`,                            color: "var(--green)" },
            ...(oos.length        ? [{ label: "OUT OF STOCK", value: String(oos.length),       color: "var(--amber)" }] : []),
            ...(notFound.length   ? [{ label: "NOT FOUND",    value: String(notFound.length),  color: "var(--red)"   }] : []),
            ...(totalSaved > 0    ? [{ label: "SAVED",        value: `$${totalSaved.toFixed(2)} (${adjusted.length} adj)`, color: "var(--cyan)" }] : []),
            ...(activeProd > 1    ? [{ label: "PROD RUN",     value: `×${activeProd} UNITS`,   color: "var(--amber)" }] : []),
          ].map(s => (
            <div key={s.label} style={{ padding: "8px 12px", border: "1px solid var(--border)" }}>
              <div style={{ color: "var(--text-3)", fontSize: 10, marginBottom: 4 }}>
                // {s.label}
              </div>
              <div style={{ color: s.color, fontSize: 20, fontWeight: 700 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Production Run Banner ── */}
        <div style={{
          border:        "1px solid var(--border-2)",
          padding:       "10px 16px",
          marginBottom:  12,
          display:       "flex",
          alignItems:    "center",
          gap:           16,
          flexWrap:      "wrap",
        }}>
          <span style={{ color: "var(--text-3)", fontSize: 12, flex: 1, minWidth: 0 }}>
            &gt; PRODUCTION_RUN: multiply BOM quantities by number of finished units
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>UNITS:</span>
            <input
              type="number"
              value={prodQty}
              onChange={e => setProdQty(e.target.value)}
              placeholder="e.g. 500"
              style={{
                background: "var(--bg)",
                border:     "1px solid var(--border-2)",
                color:      "var(--green)",
                fontFamily: "var(--font)",
                fontSize:   13,
                padding:    "4px 8px",
                width:      90,
                outline:    "none",
              }}
            />
            <button
              onClick={handleApplyProd}
              disabled={!prodQty || parseInt(prodQty) <= 0}
              style={{
                background:   !prodQty ? "transparent" : "var(--green)",
                color:        !prodQty ? "var(--text-3)" : "var(--bg)",
                border:       `1px solid ${!prodQty ? "var(--border-2)" : "var(--green)"}`,
                fontFamily:   "var(--font)",
                fontSize:     12,
                padding:      "4px 12px",
                cursor:       !prodQty ? "not-allowed" : "pointer",
                fontWeight:   700,
              }}
            >
              [APPLY]
            </button>
            {activeProd > 1 && (
              <button
                onClick={handleResetProd}
                style={{
                  background: "transparent",
                  border:     "1px solid var(--border-2)",
                  color:      "var(--text-3)",
                  fontFamily: "var(--font)",
                  fontSize:   12,
                  padding:    "4px 12px",
                  cursor:     "pointer",
                }}
              >
                [RESET]
              </button>
            )}
          </div>
        </div>

        {/* ── Notices ── */}
        {oos.length > 0 && (
          <div style={{
            border:       "1px solid var(--amber)",
            color:        "var(--amber)",
            padding:      "8px 12px",
            fontSize:     12,
            marginBottom: 8,
          }}>
            &gt; WARN: {oos.length} component{oos.length > 1 ? "s" : ""} out of stock — click [RESOLVE] to switch to next best option
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ overflowX: "auto", border: "1px solid var(--border)" }}>
          <table style={{
            width:           "100%",
            borderCollapse:  "collapse",
            fontFamily:      "var(--font)",
            fontSize:        13,
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-2)", background: "var(--surface)" }}>
                {["MPN", "DESCRIPTION", "REQUESTED", "BUY QTY", "UNIT PRICE", "TOTAL", "BEST DEAL"].map((h, i) => (
                  <th key={h} style={{
                    padding:   "8px 12px",
                    color:     "var(--text-3)",
                    fontSize:  10,
                    fontWeight: 600,
                    textAlign: i >= 2 ? "right" : "left",
                    whiteSpace: "nowrap",
                    letterSpacing: 1,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.results.map(r => (
                <ResultRow_
                  key={r.mpn}
                  r={r}
                  onResolve={handleResolve}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Legend ── */}
        <div style={{
          marginTop:  12,
          display:    "flex",
          gap:        16,
          flexWrap:   "wrap",
          alignItems: "center",
          fontSize:   11,
          color:      "var(--text-4)",
        }}>
          <span>[<span style={{ color: "var(--amber)" }}>PKG</span>] rounded to package unit</span>
          <span>[<span style={{ color: "var(--green)" }}>STEP</span>] increased to better price tier</span>
          <span>[<span style={{ color: "var(--cyan)" }}>PKG+STEP</span>] both applied</span>
          <span style={{ marginLeft: "auto" }}>
            SEARCHED: {new Date(data.searchedAt).toLocaleTimeString()}
          </span>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop:      "1px solid var(--border)",
        padding:        "8px 24px",
        display:        "flex",
        justifyContent: "space-between",
      }}>
        <span style={{ color: "var(--text-4)", fontSize: 11 }}>© {new Date().getFullYear()} ICPASTE.COM</span>
        <span style={{ color: "var(--text-4)", fontSize: 11 }}>BUILT FOR HARDWARE BUYERS</span>
      </footer>

    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}

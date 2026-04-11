"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter }                  from "next/navigation";
import { SearchResponse, ResultRow, Adjustment }       from "@/lib/types";

// ── Colori distributori ───────────────────────────────────────────────────────
const DIST_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  "Mouser":   { text: "#0066ff", bg: "#f0f4ff", border: "#bfdbfe" },
  "Digi-Key": { text: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  "Farnell":  { text: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
};
function distStyle(name: string) {
  return DIST_COLOR[name] ?? { text: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" };
}

// ── Badge ADJ ─────────────────────────────────────────────────────────────────
const ADJ_CONFIG: Record<Adjustment, { label: string; text: string; bg: string; border: string; title: string }> = {
  none:      { label: "",         text: "",         bg: "",         border: "",         title: "" },
  package:   { label: "PKG",     text: "#b45309",  bg: "#fffbeb",  border: "#fde68a",  title: "Rounded to package unit" },
  pricestep: { label: "STEP",    text: "#16a34a",  bg: "#f0fdf4",  border: "#bbf7d0",  title: "Increased to better price tier" },
  both:      { label: "PKG+STEP",text: "#0891b2",  bg: "#ecfeff",  border: "#a5f3fc",  title: "Package unit + price step applied" },
};

function AdjBadge({ adj, saved, currency }: { adj: Adjustment; saved: number; currency: string }) {
  if (adj === "none") return null;
  const cfg = ADJ_CONFIG[adj];
  return (
    <span
      title={`${cfg.title}${saved > 0 ? ` — saves ${currency} ${saved.toFixed(2)}` : ""}`}
      style={{
        fontSize:      9,
        fontWeight:    700,
        color:         cfg.text,
        background:    cfg.bg,
        border:        `1px solid ${cfg.border}`,
        padding:       "1px 5px",
        marginLeft:    6,
        letterSpacing: 0.5,
        whiteSpace:    "nowrap",
        cursor:        "help",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Riga risultato ────────────────────────────────────────────────────────────
function ResultRowItem({ r, onResolve }: { r: ResultRow; onResolve: (mpn: string) => void }) {
  const isOos      = r.error === "Out of stock";
  const isNotFound = Boolean(r.error && !isOos);
  const ds         = distStyle(r.distributor);

  return (
    <tr style={{
      borderBottom: "1px solid var(--border)",
      transition:   "background 0.1s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >

      {/* MPN */}
      <td style={{ padding: "11px 16px", fontWeight: 700, whiteSpace: "nowrap", color: "var(--text-1)" }}>
        {r.mpn}
      </td>

      {/* Description */}
      <td style={{
        padding:      "11px 16px",
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
      <td style={{ padding: "11px 16px", color: "var(--text-3)", textAlign: "right" }}>
        {r.requestedQty.toLocaleString()}
      </td>

      {/* Buy Qty */}
      <td style={{ padding: "11px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
        {isNotFound ? (
          <span style={{ color: "var(--text-4)" }}>—</span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{
              color:      r.adjustment !== "none" ? "#b45309" : "var(--text-1)",
              fontWeight: 700,
            }}>
              {r.optimalQty.toLocaleString()}
            </span>
            <AdjBadge adj={r.adjustment} saved={r.saved} currency={r.currency} />
          </span>
        )}
      </td>

      {/* Unit Price */}
      <td style={{ padding: "11px 16px", color: "var(--text-2)", textAlign: "right", fontSize: 13 }}>
        {isNotFound ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
      </td>

      {/* Total */}
      <td style={{
        padding:    "11px 16px",
        textAlign:  "right",
        fontWeight: 700,
        color:      isNotFound ? "var(--text-4)" : isOos ? "#b45309" : "var(--text-1)",
      }}>
        {isNotFound ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
      </td>

      {/* Best Deal */}
      <td style={{ padding: "11px 16px", textAlign: "right" }}>
        {isNotFound ? (
          <span style={{
            fontSize:   11,
            color:      "var(--red)",
            background: "var(--red-bg)",
            border:     "1px solid #fecaca",
            padding:    "2px 8px",
          }}>
            not found
          </span>
        ) : isOos ? (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            <span style={{
              fontSize:   11,
              color:      "#b45309",
              background: "#fffbeb",
              border:     "1px solid #fde68a",
              padding:    "2px 8px",
            }}>
              out of stock
            </span>
            {r.fallback && (
              <button
                onClick={() => onResolve(r.mpn)}
                title={`Switch to ${r.fallback.distributor} — ${r.fallback.currency} ${r.fallback.unitPrice.toFixed(4)}/pz`}
                style={{
                  background:  "var(--green-bg)",
                  border:      "1px solid #bbf7d0",
                  color:       "var(--green)",
                  fontSize:    11,
                  padding:     "2px 10px",
                  cursor:      "pointer",
                  fontFamily:  "var(--font)",
                  fontWeight:  700,
                  transition:  "all 0.15s",
                }}
              >
                resolve ↗
              </button>
            )}
          </div>
        ) : (
          <a
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        "inline-flex",
              alignItems:     "center",
              gap:            5,
              color:          ds.text,
              background:     ds.bg,
              border:         `1px solid ${ds.border}`,
              textDecoration: "none",
              fontSize:       12,
              fontWeight:     600,
              padding:        "3px 10px",
              whiteSpace:     "nowrap",
              transition:     "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            {r.distributor} ↗
          </a>
        )}
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ResultsContent() {
  const params               = useSearchParams();
  const router               = useRouter();
  const [data, setData]      = useState<SearchResponse | null>(null);
  const [loading, setLoading]= useState(true);
  const [error, setError]    = useState("");

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchResults(bom: { mpn: string; qty: number }[]) {
    setLoading(true);
    setError("");
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

  const handleResolve = useCallback((mpn: string) => {
    if (!data) return;
    const updated = data.results.map(r => {
      if (r.mpn !== mpn || !r.fallback) return r;
      const fb = r.fallback;
      return {
        ...r,
        distributor: fb.distributor,
        optimalQty:  fb.optimalQty,
        unitPrice:   fb.unitPrice,
        totalPrice:  fb.totalPrice,
        currency:    fb.currency,
        stock:       fb.stock,
        productUrl:  fb.productUrl,
        adjustment:  "none" as Adjustment,
        saved:       0,
        error:       undefined,
        fallback:    undefined,
      };
    });
    const newTotal = parseFloat(updated.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2));
    setData({ ...data, results: updated, totalBom: newTotal });
  }, [data]);

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
  if (loading) return (
    <div style={{
      minHeight:      "100vh",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      background:     "var(--bg)",
      gap:            16,
      fontFamily:     "var(--font)",
    }}>
      <div style={{ color: "var(--text-2)", fontSize: 13 }}>
        Searching distributors...
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {["Mouser", "Digi-Key", "Farnell"].map((d, i) => (
          <span key={d} style={{
            color:             distStyle(d).text,
            background:        distStyle(d).bg,
            border:            `1px solid ${distStyle(d).border}`,
            fontSize:          12,
            padding:           "3px 10px",
            animation:         "pulse 1.2s ease infinite",
            animationDelay:    `${i * 0.2}s`,
          }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div style={{
      minHeight:      "100vh",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      background:     "var(--bg)",
      gap:            16,
      fontFamily:     "var(--font)",
    }}>
      <div style={{ color: "var(--red)", fontSize: 13 }}>✗ {error}</div>
      <button
        onClick={() => router.push("/")}
        style={{
          background: "var(--text-1)",
          color:      "var(--bg)",
          border:     "none",
          padding:    "7px 20px",
          fontFamily: "var(--font)",
          fontSize:   13,
          cursor:     "pointer",
        }}
      >
        ← New search
      </button>
    </div>
  );

  if (!data) return null;

  const found    = data.results.filter(r => !r.error);
  const oos      = data.results.filter(r => r.error === "Out of stock");
  const notFound = data.results.filter(r => r.error && r.error !== "Out of stock");
  const adjusted = data.results.filter(r => r.adjustment !== "none");
  const saved    = data.results.reduce((s, r) => s + (r.saved ?? 0), 0);
  const currency = data.results[0]?.currency ?? "USD";

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
        height:         52,
        display:        "flex",
        alignItems:     "center",
        padding:        "0 32px",
        justifyContent: "space-between",
        position:       "sticky",
        top:            0,
        background:     "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)",
        zIndex:         10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "none",
              border:     "none",
              color:      "var(--text-3)",
              fontFamily: "var(--font)",
              fontSize:   13,
              cursor:     "pointer",
              padding:    0,
            }}
          >
            ← New search
          </button>
          <span style={{ color: "var(--border-2)" }}>|</span>
          <span style={{ color: "var(--text-1)", fontWeight: 700, fontSize: 14, letterSpacing: -0.5 }}>
            icpaste
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(distCount).map(([dist, count]) => {
            const ds = distStyle(dist);
            return (
              <span key={dist} style={{
                color:      ds.text,
                background: ds.bg,
                border:     `1px solid ${ds.border}`,
                fontSize:   12,
                fontWeight: 600,
                padding:    "2px 10px",
              }}>
                {dist} · {count}
              </span>
            );
          })}
        </div>
      </header>

      <main style={{
        flex:      1,
        maxWidth:  1200,
        margin:    "0 auto",
        width:     "100%",
        padding:   "24px 32px",
      }}>

        {/* ── Stats ── */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap:                 8,
          marginBottom:        16,
        }}>
          {[
            { label: "BOM TOTAL",     value: `${currency} ${data.totalBom.toFixed(2)}`, color: "var(--text-1)", big: true },
            { label: "FOUND",         value: `${found.length} / ${data.results.length}`, color: "var(--text-1)", big: false },
            ...(oos.length      > 0 ? [{ label: "OUT OF STOCK", value: String(oos.length),                              color: "#b45309",       big: false }] : []),
            ...(notFound.length > 0 ? [{ label: "NOT FOUND",    value: String(notFound.length),                         color: "var(--red)",    big: false }] : []),
            ...(saved           > 0 ? [{ label: "SAVED",        value: `${currency} ${saved.toFixed(2)}`,               color: "var(--green)",  big: false }] : []),
            ...(adjusted.length > 0 ? [{ label: "ADJUSTED",     value: `${adjusted.length} rows`,                       color: "var(--cyan)",   big: false }] : []),
          ].map(s => (
            <div key={s.label} style={{
              border:     "1px solid var(--border)",
              padding:    "14px 16px",
              background: "var(--surface)",
            }}>
              <div style={{ color: "var(--text-3)", fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ color: s.color, fontSize: s.big ? 22 : 18, fontWeight: 700, letterSpacing: -0.5 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Production Run ── */}
        <div style={{
          border:        "1px solid var(--border)",
          padding:       "10px 16px",
          marginBottom:  12,
          background:    "var(--surface)",
          display:       "flex",
          alignItems:    "center",
          gap:           16,
          flexWrap:      "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "var(--text-2)", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
              Production Run
            </div>
            <div style={{ color: "var(--text-3)", fontSize: 11 }}>
              Multiply BOM quantities by number of finished units. Stock checks and price breaks recalculated automatically.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>Units to produce:</span>
            <input
              type="number"
              value={prodQty}
              onChange={e => setProdQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyProd()}
              placeholder="e.g. 500"
              style={{
                background: "var(--bg)",
                border:     "1px solid var(--border-2)",
                color:      "var(--text-1)",
                fontFamily: "var(--font)",
                fontSize:   13,
                padding:    "5px 10px",
                width:      90,
                outline:    "none",
              }}
            />
            <button
              onClick={handleApplyProd}
              disabled={!prodQty || parseInt(prodQty) <= 0}
              style={{
                background:  !prodQty ? "var(--surface)" : "var(--text-1)",
                color:       !prodQty ? "var(--text-3)"  : "var(--bg)",
                border:      `1px solid ${!prodQty ? "var(--border-2)" : "var(--text-1)"}`,
                fontFamily:  "var(--font)",
                fontSize:    12,
                fontWeight:  700,
                padding:     "5px 14px",
                cursor:      !prodQty ? "not-allowed" : "pointer",
                transition:  "all 0.15s",
              }}
            >
              Apply ↗
            </button>
            {activeProd > 1 && (
              <button
                onClick={handleResetProd}
                style={{
                  background: "var(--bg)",
                  border:     "1px solid var(--border-2)",
                  color:      "var(--text-3)",
                  fontFamily: "var(--font)",
                  fontSize:   12,
                  padding:    "5px 12px",
                  cursor:     "pointer",
                  transition: "all 0.15s",
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ── OOS Notice ── */}
        {oos.length > 0 && (
          <div style={{
            border:       "1px solid #fde68a",
            background:   "#fffbeb",
            color:        "#92400e",
            padding:      "8px 14px",
            fontSize:     12,
            marginBottom: 10,
          }}>
            ⚠ {oos.length} component{oos.length > 1 ? "s" : ""} out of stock —
            click <strong>resolve</strong> to switch to next best available option
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ border: "1px solid var(--border)", overflowX: "auto" }}>
          <table style={{
            width:          "100%",
            borderCollapse: "collapse",
            fontFamily:     "var(--font)",
            fontSize:       13,
          }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-2)" }}>
                {[
                  { label: "MPN",        align: "left"  },
                  { label: "DESCRIPTION",align: "left"  },
                  { label: "REQUESTED",  align: "right" },
                  { label: "BUY QTY",    align: "right" },
                  { label: "UNIT PRICE", align: "right" },
                  { label: "TOTAL",      align: "right" },
                  { label: "BEST DEAL",  align: "right" },
                ].map(h => (
                  <th key={h.label} style={{
                    padding:       "10px 16px",
                    fontSize:      10,
                    fontWeight:    600,
                    color:         "var(--text-3)",
                    textAlign:     h.align as "left" | "right",
                    letterSpacing: 0.8,
                    whiteSpace:    "nowrap",
                  }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
                <ResultRowItem key={`${r.mpn}-${i}`} r={r} onResolve={handleResolve} />
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
          {(["package", "pricestep", "both"] as Adjustment[]).map(adj => {
            const cfg = ADJ_CONFIG[adj];
            return (
              <span key={adj} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  fontSize:   9,
                  fontWeight: 700,
                  color:      cfg.text,
                  background: cfg.bg,
                  border:     `1px solid ${cfg.border}`,
                  padding:    "1px 5px",
                }}>
                  {cfg.label}
                </span>
                <span>{cfg.title.toLowerCase()}</span>
              </span>
            );
          })}
          <span style={{ marginLeft: "auto" }}>
            {new Date(data.searchedAt).toLocaleTimeString()}
          </span>
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
        marginTop:      24,
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

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}

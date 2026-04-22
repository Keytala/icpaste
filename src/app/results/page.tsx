"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import type { ResultRow, SearchResponse, Adjustment }  from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:      "var(--bg)",
  surface: "var(--surface)",
  border:  "var(--border)",
  fg:      "var(--fg)",
  fg2:     "var(--fg-2)",
  fg3:     "var(--fg-3)",
  brand:   "var(--brand)",
  green:   "var(--green)",
  amber:   "var(--amber)",
  red:     "var(--red)",
  font:    "var(--font)",
  radius:  "var(--radius)",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  ADJUSTMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ADJ: Record<Adjustment, { label: string; color: string; title: string; detail: string }> = {
  none:      { label: "",        color: "",        title: "",                    detail: "" },
  package:   { label: "PKG",     color: "#d97706", title: "Package unit",        detail: "Rounded to reel / tray size" },
  pricestep: { label: "STEP",    color: "#16a34a", title: "Better price tier",   detail: "Qty increased for cheaper price break" },
  both:      { label: "PKG+STEP",color: "#7c3aed", title: "Package + price tier",detail: "Both adjustments applied" },
};

// ─────────────────────────────────────────────────────────────────────────────
//  DISTRIBUTOR COLORS
// ─────────────────────────────────────────────────────────────────────────────

const DIST_COLORS: Record<string, string> = {
  "Mouser":        "#16a34a",
  "Digi-Key":      "#2563eb",
  "Farnell":       "#dc2626",
  "TME":           "#d97706",
  "RS Components": "#7c3aed",
  "Arrow":         "#0891b2",
  "Avnet":         "#be185d",
  "LCSC":          "#059669",
};

function distColor(name: string): string {
  for (const [k, v] of Object.entries(DIST_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "#6b7280";
}

// ─────────────────────────────────────────────────────────────────────────────
//  UNIQUE ARRAY HELPER (no Set)
// ─────────────────────────────────────────────────────────────────────────────

function unique<T>(arr: T[]): T[] {
  return arr.filter((v, i, a) => a.indexOf(v) === i);
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESULTS CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function ResultsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [data,    setData]    = useState<SearchResponse | null>(null);
  const [rows,    setRows]    = useState<ResultRow[]>([]);
  const [prodQty, setProdQty] = useState("");
  const [activeProd, setActiveProd] = useState(1);

  useEffect(() => {
    const raw = searchParams.get("bom");
    if (!raw) { setError("No BOM data found."); setLoading(false); return; }

    let bom: { mpn: string; qty: number }[];
    try { bom = JSON.parse(atob(raw)); }
    catch { setError("Invalid BOM data."); setLoading(false); return; }

    fetch("/api/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ bom }),
    })
      .then(r => r.json())
      .then((d: SearchResponse) => { setData(d); setRows(d.results); setLoading(false); })
      .catch(() => { setError("Search failed. Please try again."); setLoading(false); });
  }, [searchParams]);

  const handleResolve = useCallback((idx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx || !r.fallback) return r;
      return {
        ...r,
        optimalQty:  r.fallback.optimalQty,
        unitPrice:   r.fallback.unitPrice,
        totalPrice:  r.fallback.totalPrice,
        distributor: r.fallback.distributor,
        stock:       r.fallback.stock,
        productUrl:  r.fallback.productUrl,
        currency:    r.fallback.currency,
        error:       undefined,
        fallback:    undefined,
      };
    }));
  }, []);

  const handleApplyProd = useCallback(() => {
    const n = parseInt(prodQty, 10);
    if (!n || n < 1 || !data) return;
    setActiveProd(n);
    setRows(data.results.map(r => ({
      ...r,
      requestedQty: r.requestedQty * n,
      optimalQty:   r.optimalQty   * n,
      totalPrice:   parseFloat((r.totalPrice * n).toFixed(2)),
    })));
  }, [prodQty, data]);

  const handleReset = useCallback(() => {
    if (!data) return;
    setActiveProd(1);
    setProdQty("");
    setRows(data.results);
  }, [data]);

  const handleExportCSV = useCallback(() => {
    const csv = [
      ["MPN","Description","Requested","Buy Qty","Unit Price","Total","Distributor","URL"].join(","),
      ...rows.map(r => [
        r.mpn,
        `"${r.description}"`,
        r.requestedQty,
        r.optimalQty,
        r.unitPrice,
        r.totalPrice,
        r.distributor,
        r.productUrl,
      ].join(",")),
    ].join("\n");
    const a    = document.createElement("a");
    a.href     = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `icpaste_bom_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }, [rows]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: C.bg }}>
      <div style={{ display: "flex", gap: 8 }}>
        {["Mouser","Digi-Key","Farnell"].map((d, i) => (
          <span key={d} style={{ fontSize: 12, fontWeight: 500, color: C.fg2, background: C.surface, border: `1px solid ${C.border}`, padding: "5px 12px", borderRadius: 99, fontFamily: C.font, animation: `pulse 1.4s ease ${i * 0.2}s infinite` }}>
            {d}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 13, color: C.fg3, fontFamily: C.font }}>Searching best prices…</p>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.bg }}>
      <p style={{ fontSize: 14, color: C.red, fontFamily: C.font }}>{error}</p>
      <button onClick={() => router.push("/")} style={{ padding: "8px 16px", background: C.brand, color: "white", border: "none", borderRadius: C.radius, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: C.font }}>
        ← New search
      </button>
    </div>
  );

  if (!data) return null;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const found    = rows.filter(r => !r.error || r.error === "Out of stock").length;
  const savings  = rows.reduce((s, r) => s + (r.saved ?? 0), 0);
  const totalBom = rows.reduce((s, r) => s + (r.totalPrice ?? 0), 0);
  const distUsed = unique(rows.filter(r => r.distributor !== "—").map(r => r.distributor));

  const stats = [
    { label: "BOM TOTAL",         value: `${rows[0]?.currency ?? "USD"} ${totalBom.toFixed(2)}`, sub: "estimated cost",        accent: true,  green: false },
    { label: "FOUND",             value: `${found} / ${rows.length}`,                            sub: "components with stock", accent: false, green: false },
    { label: "OPTIMIZED SAVINGS", value: `$${savings.toFixed(2)}`,                               sub: `${rows.filter(r => r.adjustment !== "none").length} qty adjusted`, accent: false, green: savings > 0 },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/")} style={{ fontSize: 13, color: C.fg2, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: C.radius, fontFamily: C.font }}>
              ← New search
            </button>
            <span style={{ width: 1, height: 16, background: C.border }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.fg, fontFamily: C.font, letterSpacing: -0.3 }}>
              ic<span style={{ color: C.brand }}>paste</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {distUsed.map(d => (
              <span key={d} style={{ fontSize: 11, fontWeight: 600, color: distColor(d), background: `${distColor(d)}15`, border: `1px solid ${distColor(d)}40`, padding: "3px 10px", borderRadius: 99, fontFamily: C.font }}>
                ● {d} · {rows.filter(r => r.distributor === d).length}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "24px 24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: s.green ? "#f0fdf4" : C.surface, border: `1px solid ${s.green ? "#bbf7d0" : C.border}`, borderRadius: C.radius, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.fg3, marginBottom: 6, fontFamily: C.font }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.accent ? C.brand : s.green ? "#16a34a" : C.fg, fontFamily: C.font, letterSpacing: -0.5, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.fg3, marginTop: 4, fontFamily: C.font }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Production Run Banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 18px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: C.radius, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", fontFamily: C.font }}>🏭 Production Run</div>
            <div style={{ fontSize: 11, color: "#0284c7", fontFamily: C.font, marginTop: 2 }}>
              Multiply BOM quantities by the number of finished units. Stock checks and price breaks are recalculated automatically.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "#0369a1", fontFamily: C.font, whiteSpace: "nowrap" }}>Units to produce:</span>
            <input
              type="number"
              min={1}
              placeholder="e.g. 500"
              value={prodQty}
              onChange={e => setProdQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyProd()}
              style={{ width: 90, padding: "5px 8px", fontSize: 13, border: "1px solid #bae6fd", borderRadius: C.radius, outline: "none", background: "white", fontFamily: C.font }}
            />
            <button onClick={handleApplyProd} style={{ padding: "5px 14px", background: C.brand, color: "white", border: "none", borderRadius: C.radius, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: C.font }}>
              Apply ✓
            </button>
            {activeProd > 1 && (
              <button onClick={handleReset} style={{ padding: "5px 10px", background: "white", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: C.radius, cursor: "pointer", fontSize: 12, fontFamily: C.font }}>
                Reset ×
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radius, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.font }}>
              <thead>
                <tr style={{ background: C.surface }}>
                  {["MPN","DESCRIPTION","REQUESTED","BUY QTY","UNIT PRICE","TOTAL","BEST DEAL"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: C.fg3, borderBottom: `1px solid ${C.border}`, textAlign: i >= 2 ? "right" : "left", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isOOS  = r.error === "Out of stock";
                  const isNF   = r.error && !isOOS;
                  const color  = distColor(r.distributor);
                  const adjQty = r.optimalQty !== r.requestedQty;
                  const adj    = ADJ[r.adjustment];

                  return (
                    <tr key={idx}
                      style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surface; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      {/* MPN */}
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: C.fg, fontFamily: C.font }}>
                        {r.mpn}
                      </td>

                      {/* Description */}
                      <td style={{ padding: "12px 16px", fontSize: 11, color: C.fg3, fontFamily: C.font, maxWidth: 200 }}>
                        <span title={r.description}>{r.description ? r.description.slice(0, 40) + (r.description.length > 40 ? "…" : "") : "—"}</span>
                      </td>

                      {/* Requested */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.fg2, textAlign: "right", fontFamily: C.font }}>
                        {r.requestedQty}
                      </td>

                      {/* Buy Qty */}
                      <td style={{ padding: "12px 16px", fontSize: 12, textAlign: "right", fontFamily: C.font }}>
                        {isNF ? (
                          <span style={{ color: C.fg3 }}>—</span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 700, color: adjQty ? C.amber : C.fg }}>{r.optimalQty}</span>
                            {adj.label && (
                              <span title={`${adj.title}: ${adj.detail}${r.saved > 0 ? ` · saves $${r.saved.toFixed(2)}` : ""}`} style={{ fontSize: 9, fontWeight: 700, color: adj.color, border: `1px solid ${adj.color}`, padding: "0 4px", borderRadius: 3, cursor: "help", letterSpacing: 0.3 }}>
                                {adj.label}
                              </span>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Unit Price */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.fg2, textAlign: "right", fontFamily: C.font }}>
                        {isNF ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
                      </td>

                      {/* Total */}
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: C.fg, textAlign: "right", fontFamily: C.font }}>
                        {isNF ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
                      </td>

                      {/* Best Deal */}
                      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: C.font }}>
                        {isNF ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.red, background: "#fef2f2", border: "1px solid #fecaca", padding: "3px 10px", borderRadius: 99 }}>
                            Not found
                          </span>
                        ) : isOOS ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: 99 }}>
                              ⚠ Out of stock
                            </span>
                            {r.fallback && (
                              <button onClick={() => handleResolve(idx)} style={{ fontSize: 11, fontWeight: 600, color: "white", background: C.green, border: "none", padding: "4px 10px", borderRadius: 99, cursor: "pointer" }}>
                                Resolve ↗
                              </button>
                            )}
                          </span>
                        ) : (
                          <a href={r.productUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color, background: `${color}12`, border: `1px solid ${color}40`, padding: "4px 12px", borderRadius: 99, textDecoration: "none", whiteSpace: "nowrap" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            {r.distributor} ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend + Export */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.entries(ADJ) as [Adjustment, typeof ADJ[Adjustment]][])
              .filter(([k]) => k !== "none")
              .map(([, c]) => (
                <span key={c.label} title={`${c.title}: ${c.detail}`} style={{ fontSize: 9, fontWeight: 700, color: c.color, border: `1px solid ${c.color}`, padding: "2px 7px", borderRadius: 3, cursor: "help", letterSpacing: 0.3 }}>
                  {c.label}
                </span>
              ))}
          </div>
          <span style={{ fontSize: 11, color: C.fg3, fontFamily: C.font }}>Hover for details</span>
          <button onClick={handleExportCSV} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "white", color: C.fg2, fontSize: 11, fontWeight: 500, border: `1px solid ${C.border}`, borderRadius: C.radius, cursor: "pointer", fontFamily: C.font }}>
            ↓ Export CSV
          </button>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, height: 52, display: "flex", alignItems: "center", padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: C.fg3, fontFamily: C.font }}>© {new Date().getFullYear()} icpaste.com</span>
          <span style={{ fontSize: 11, color: C.fg3, fontFamily: C.font }}>Built for hardware buyers</span>
        </div>
      </footer>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>}>
      <ResultsContent />
    </Suspense>
  );
}

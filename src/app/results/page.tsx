"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import type { ResultRow, SearchResponse, Adjustment }  from "@/lib/types";

// ── Colori distributori ───────────────────────────────────────────────────────
const DIST_COLOR: Record<string, string> = {
  "Mouser":        "#e67e00",
  "Digi-Key":      "#cc0000",
  "Farnell":       "#e60000",
  "TME":           "#0066cc",
  "RS Components": "#e60028",
  "Arrow":         "#000000",
  "Avnet":         "#0033a0",
  "LCSC":          "#2563eb",
};

function distColor(name: string): string {
  return DIST_COLOR[name] ?? "#6c757d";
}

// ── Badge aggiustamento ───────────────────────────────────────────────────────
const ADJ_CONFIG: Record<Adjustment, { label: string; color: string }> = {
  none:      { label: "",         color: "" },
  package:   { label: "PKG",      color: "#fd7e14" },
  pricestep: { label: "STEP",     color: "#198754" },
  both:      { label: "PKG+STEP", color: "#6f42c1" },
};

function AdjBadge({ adj, saved, currency }: { adj: Adjustment; saved: number; currency: string }) {
  if (adj === "none") return null;
  const cfg = ADJ_CONFIG[adj];
  return (
    <span
      title={saved > 0 ? `saves ${currency} ${saved.toFixed(2)}` : cfg.label}
      style={{ fontSize: 9, fontWeight: 700, color: cfg.color, border: `1px solid ${cfg.color}`, padding: "0 4px", marginLeft: 4, borderRadius: 2, fontFamily: "var(--font)", letterSpacing: 0.5, whiteSpace: "nowrap", cursor: "help" }}
    >
      {cfg.label}{saved > 0 ? ` -${saved.toFixed(2)}` : ""}
    </span>
  );
}

// ── Componente principale ─────────────────────────────────────────────────────
function ResultsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [data,    setData]    = useState<SearchResponse | null>(null);
  const [rows,    setRows]    = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
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
      return { ...r, optimalQty: r.fallback.optimalQty, unitPrice: r.fallback.unitPrice, totalPrice: r.fallback.totalPrice, distributor: r.fallback.distributor, stock: r.fallback.stock, productUrl: r.fallback.productUrl, currency: r.fallback.currency, error: undefined, fallback: undefined };
    }));
  }, []);

  const handleApplyProd = useCallback(() => {
    const n = parseInt(prodQty, 10);
    if (!n || n < 1 || !data) return;
    setActiveProd(n);
    setRows(data.results.map(r => ({ ...r, requestedQty: r.requestedQty * n, optimalQty: r.optimalQty * n, totalPrice: parseFloat((r.totalPrice * n).toFixed(2)) })));
  }, [prodQty, data]);

  const handleReset = useCallback(() => {
    if (!data) return;
    setActiveProd(1); setProdQty(""); setRows(data.results);
  }, [data]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "var(--bg)" }}>
      <div style={{ fontFamily: "var(--font)", fontSize: 13, color: "var(--fg-2)", letterSpacing: 1 }}>
        Searching {["Mouser", "Digi-Key", "Farnell"].join(", ")}…
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["Mouser", "Digi-Key", "Farnell"].map((d, i) => (
          <span key={d} style={{ fontSize: 11, fontFamily: "var(--font)", color: "var(--fg-3)", padding: "3px 10px", border: "1px solid var(--border)", borderRadius: 2, animation: `pulse 1.4s ease ${i * 0.2}s infinite` }}>{d}</span>
        ))}
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ fontFamily: "var(--font)", fontSize: 13, color: "var(--red)" }}>{error}</p>
      <button onClick={() => router.push("/")} style={{ padding: "8px 16px", background: "var(--brand)", color: "var(--brand-fg)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font)", fontWeight: 600 }}>← New search</button>
    </div>
  );

  if (!data) return null;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const found    = rows.filter(r => !r.error || r.error === "Out of stock").length;
  const savings  = rows.reduce((s, r) => s + (r.saved ?? 0), 0);
  const totalBom = rows.reduce((s, r) => s + (r.totalPrice ?? 0), 0);

  // Fix Set — usa Array.from + filter per rimuovere duplicati
  const distUsed = rows
    .filter(r => r.distributor !== "—")
    .map(r => r.distributor)
    .filter((d, i, arr) => arr.indexOf(d) === i);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: "1px solid var(--border)", height: 48, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", flexShrink: 0, position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")} style={{ fontSize: 12, color: "var(--fg-2)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font)", padding: "4px 8px", borderRadius: "var(--radius)" }}>
            ← New search
          </button>
          <span style={{ width: 1, height: 16, background: "var(--border)" }} />
          <span style={{ fontFamily: "var(--font)", fontWeight: 600, fontSize: 14, letterSpacing: -0.5 }}>
            ic<span style={{ color: "var(--brand)" }}>paste</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {distUsed.map(d => (
            <span key={d} style={{ fontSize: 11, fontFamily: "var(--font)", padding: "2px 10px", border: `1px solid ${distColor(d)}`, borderRadius: 2, color: distColor(d) }}>
              {d} · {rows.filter(r => r.distributor === d).length}
            </span>
          ))}
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "24px 24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }} className="fade-up">
          {[
            { label: "BOM TOTAL",         value: `${rows[0]?.currency ?? "USD"} ${totalBom.toFixed(2)}`, sub: "estimated cost",          accent: true  },
            { label: "FOUND",             value: `${found} / ${rows.length}`,                            sub: "components with stock",   accent: false },
            { label: "OPTIMIZED SAVINGS", value: `${rows[0]?.currency ?? "USD"} ${savings.toFixed(2)}`,  sub: `${rows.filter(r => r.adjustment !== "none").length} qty adjusted`, green: savings > 0 },
          ].map(s => (
            <div key={s.label} style={{ background: s.green && savings > 0 ? "#f0fdf4" : "var(--surface)", border: `1px solid ${s.green && savings > 0 ? "#bbf7d0" : "var(--border)"}`, borderRadius: "var(--radius-lg)", padding: "16px 20px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "var(--fg-3)", fontFamily: "var(--font)", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font)", letterSpacing: -1, color: s.accent ? "var(--brand)" : s.green && savings > 0 ? "var(--green)" : "var(--fg)", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4, fontFamily: "var(--sans)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Production Run Banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "var(--radius)", marginBottom: 14, flexWrap: "wrap" }} className="fade-up">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", fontFamily: "var(--font)", marginBottom: 2 }}>Production Run</div>
            <div style={{ fontSize: 11, color: "#0284c7", fontFamily: "var(--sans)", lineHeight: 1.5 }}>
              Multiply BOM quantities by the number of finished units. Stock checks and price breaks are recalculated automatically.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#0369a1", fontFamily: "var(--font)", whiteSpace: "nowrap" }}>Units to produce:</span>
            <input
              type="number"
              min={1}
              value={prodQty}
              onChange={e => setProdQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyProd()}
              placeholder="e.g. 500"
              style={{ width: 90, padding: "5px 8px", fontSize: 13, fontFamily: "var(--font)", border: "1px solid #bae6fd", borderRadius: "var(--radius)", outline: "none", background: "white" }}
            />
            <button onClick={handleApplyProd} style={{ padding: "6px 14px", background: "var(--brand)", color: "white", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font)", fontWeight: 600 }}>
              Apply ✓
            </button>
            {activeProd > 1 && (
              <button onClick={handleReset} style={{ padding: "6px 12px", background: "white", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font)" }}>
                Reset ×
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} className="fade-up">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font)" }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  {["MPN", "DESCRIPTION", "REQUESTED", "BUY QTY", "UNIT PRICE", "TOTAL", "BEST DEAL"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "var(--fg-3)", textAlign: i >= 2 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isOOS  = r.error === "Out of stock";
                  const isNF   = r.error && !isOOS;
                  const color  = distColor(r.distributor);
                  const adjQty = r.optimalQty !== r.requestedQty;

                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* MPN */}
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ fontFamily: "var(--font)", fontSize: 13, fontWeight: 500 }}>{r.mpn}</span>
                      </td>
                      {/* Description */}
                      <td style={{ padding: "13px 16px", maxWidth: 220 }}>
                        <span style={{ fontSize: 12, color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{r.description || "—"}</span>
                      </td>
                      {/* Requested */}
                      <td style={{ padding: "13px 16px", textAlign: "right" }}>
                        <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{r.requestedQty}</span>
                      </td>
                      {/* Buy Qty */}
                      <td style={{ padding: "13px 16px", textAlign: "right" }}>
                        {isNF ? <span style={{ color: "var(--fg-3)" }}>—</span> : (
                          <span style={{ fontWeight: 600, color: adjQty ? "var(--amber)" : "var(--fg)" }}>
                            {r.optimalQty}
                            <AdjBadge adj={r.adjustment} saved={r.saved} currency={r.currency} />
                          </span>
                        )}
                      </td>
                      {/* Unit Price */}
                      <td style={{ padding: "13px 16px", textAlign: "right" }}>
                        <span style={{ fontSize: 13, color: "var(--fg-2)" }}>
                          {isNF ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
                        </span>
                      </td>
                      {/* Total */}
                      <td style={{ padding: "13px 16px", textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          {isNF ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
                        </span>
                      </td>
                      {/* Best Deal */}
                      <td style={{ padding: "13px 16px", textAlign: "right" }}>
                        {isNF ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", fontFamily: "var(--font)" }}>Not found</span>
                        ) : isOOS ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 8px", borderRadius: 2, fontFamily: "var(--font)" }}>⚠ Out of stock</span>
                            {r.fallback && (
                              <button onClick={() => handleResolve(idx)} style={{ fontSize: 11, fontWeight: 600, color: "white", background: "var(--green)", border: "none", padding: "4px 10px", borderRadius: 2, cursor: "pointer", fontFamily: "var(--font)" }}>
                                Resolve ↗
                              </button>
                            )}
                          </div>
                        ) : (
                          <a href={r.productUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 2, border: `1px solid ${color}`, color, textDecoration: "none", fontFamily: "var(--font)", whiteSpace: "nowrap" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {(Object.entries(ADJ_CONFIG) as [Adjustment, { label: string; color: string }][])
            .filter(([k]) => k !== "none")
            .map(([key, c]) => (
              <span key={key} style={{ fontSize: 9, fontWeight: 700, color: c.color, border: `1px solid ${c.color}`, padding: "1px 6px", borderRadius: 2, fontFamily: "var(--font)", letterSpacing: 0.5 }}>
                {c.label}
              </span>
            ))}
          <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--sans)" }}>Hover badge for details</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                const csv = [
                  ["MPN", "Description", "Requested", "Buy Qty", "Unit Price", "Total", "Distributor", "URL"].join(","),
                  ...rows.map(r => [r.mpn, `"${r.description}"`, r.requestedQty, r.optimalQty, r.unitPrice, r.totalPrice, r.distributor, r.productUrl].join(","))
                ].join("\n");
                const a = document.createElement("a");
                a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                a.download = `icpaste_bom_${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "white", color: "var(--fg-2)", fontSize: 11, fontFamily: "var(--font)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer" }}
            >
              ↓ Export CSV
            </button>
          </div>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", height: 48, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", marginTop: 24 }}>
        <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font)" }}>© {new Date().getFullYear()} icpaste.com</span>
        <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font)" }}>Built for hardware buyers</span>
      </footer>

    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", color: "var(--fg-3)" }}>Loading…</div>}>
      <ResultsContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams }        from "next/navigation";
import { Suspense }                          from "react";
import type { ResultRow, SearchResponse }    from "@/lib/types";

// ── Colori distributori ───────────────────────────────────────────────────────
const DIST_COLOR: Record<string, string> = {
  "Mouser":        "#16a34a",
  "Digi-Key":      "#d97706",
  "Farnell":       "#2563eb",
  "TME":           "#7c3aed",
  "RS Components": "#dc2626",
  "Arrow":         "#0891b2",
  "Avnet":         "#0a0a0a",
  "LCSC":          "#15803d",
};

function distColor(name: string): string {
  for (const [k, v] of Object.entries(DIST_COLOR)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "#6b7280";
}

// ── Badge aggiustamento ───────────────────────────────────────────────────────
const ADJ_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; title: string }> = {
  package:   { label: "PKG",      color: "#d97706", bg: "#fffbeb", border: "#fde68a", title: "Rounded to package unit"        },
  pricestep: { label: "STEP",     color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", title: "Increased to better price tier"  },
  both:      { label: "PKG+STEP", color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff", title: "Package + price tier applied"    },
};

function AdjBadge({ adj, saved, currency }: { adj: ResultRow["adjustment"]; saved: number; currency: string }) {
  if (adj === "none" || !ADJ_CONFIG[adj]) return null;
  const c = ADJ_CONFIG[adj];
  return (
    <span
      title={saved > 0 ? `${c.title} — saves ${currency} ${saved.toFixed(2)}` : c.title}
      style={{ fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: "1px 6px", borderRadius: 99, marginLeft: 4, cursor: "help", whiteSpace: "nowrap" }}
    >
      {c.label}{saved > 0 ? ` -${saved.toFixed(2)}` : ""}
    </span>
  );
}

// ── Componente principale ─────────────────────────────────────────────────────
function ResultsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [data, setData]             = useState<SearchResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [rows, setRows]             = useState<ResultRow[]>([]);
  const [prodQty, setProdQty]       = useState("");
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {["Mouser", "Digi-Key", "Farnell"].map(d => (
          <span key={d} style={{ fontSize: 12, color: "var(--fg-2)", background: "var(--surface)", border: "1px solid var(--border)", padding: "5px 12px", borderRadius: 99 }}>{d}</span>
        ))}
      </div>
      <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Searching best prices…</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
        <button onClick={() => router.push("/")} style={{ padding: "8px 16px", background: "var(--brand)", color: "var(--brand-fg)", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← New search</button>
      </div>
    </div>
  );

  if (!data) return null;

  const found    = rows.filter(r => !r.error || r.error === "Out of stock").length;
  const savings  = rows.reduce((s, r) => s + (r.saved ?? 0), 0);
  const totalBom = rows.reduce((s, r) => s + (r.totalPrice ?? 0), 0);

  // ── FIX: usa Array.from invece di [...new Set()] ──────────────────────────
  const distUsed = Array.from(
    rows.filter(r => r.distributor !== "—").reduce((acc, r) => { acc.add(r.distributor); return acc; }, new Set<string>())
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: "1px solid var(--border)", height: 52, display: "flex", alignItems: "center", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ maxWidth: 1100, width: "100%", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/")} style={{ fontSize: 13, color: "var(--fg-2)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--radius)" }}>
              ← New search
            </button>
            <span style={{ width: 1, height: 16, background: "var(--border)" }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>icpaste</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {distUsed.map(d => (
              <span key={d} style={{ fontSize: 11, fontWeight: 600, color: distColor(d), background: distColor(d) + "18", border: `1px solid ${distColor(d)}40`, padding: "3px 10px", borderRadius: 99 }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: distColor(d), marginRight: 5, verticalAlign: "middle" }} />
                {d} · {rows.filter(r => r.distributor === d).length}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 1100, width: "100%", margin: "0 auto", padding: "24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "BOM Total",         value: `${rows[0]?.currency ?? "USD"} ${totalBom.toFixed(2)}`, sub: "estimated cost",       accent: true,  green: false },
            { label: "Found",             value: `${found} / ${rows.length}`,                            sub: "components with stock", accent: false, green: false },
            { label: "Optimized Savings", value: `$${savings.toFixed(2)}`,                               sub: `${rows.filter(r => r.adjustment !== "none").length} qty adjusted`, accent: false, green: savings > 0 },
          ].map(s => (
            <div key={s.label} style={{ background: s.green ? "#f0fdf4" : "var(--surface)", border: `1px solid ${s.green ? "#bbf7d0" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.1, textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: s.accent ? "var(--brand)" : s.green ? "var(--green)" : "var(--fg)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Production Run */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "var(--radius)", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 2 }}>🏭 Production Run</div>
            <div style={{ fontSize: 11, color: "#0284c7", lineHeight: 1.5 }}>Multiply BOM quantities by the number of finished units. Stock checks and price breaks recalculated automatically.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#0369a1", fontWeight: 500, whiteSpace: "nowrap" }}>Units to produce:</span>
            <input
              type="number" min={1} placeholder="e.g. 500"
              value={prodQty} onChange={e => setProdQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyProd()}
              style={{ width: 90, padding: "5px 8px", fontSize: 13, border: "1px solid #bae6fd", borderRadius: "var(--radius)", outline: "none", background: "white" }}
            />
            <button onClick={handleApplyProd} style={{ padding: "5px 14px", background: "var(--brand)", color: "white", border: "none", borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Apply ✓</button>
            {activeProd > 1 && (
              <button onClick={handleReset} style={{ padding: "5px 10px", background: "white", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer" }}>Reset ×</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  {["MPN", "DESCRIPTION", "REQUESTED", "BUY QTY", "UNIT PRICE", "TOTAL", "BEST DEAL"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.1, textTransform: "uppercase", color: "var(--fg-3)", textAlign: i >= 2 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isOOS  = r.error === "Out of stock";
                  const isNF   = !!r.error && !isOOS;
                  const color  = distColor(r.distributor);
                  const adjQty = r.optimalQty !== r.requestedQty;
                  return (
                    <tr key={idx} style={{ borderBottom: idx < rows.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "13px 16px", fontFamily: "monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{r.mpn}</td>
                      <td style={{ padding: "13px 16px", color: "var(--fg-3)", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "—"}</td>
                      <td style={{ padding: "13px 16px", textAlign: "right", color: "var(--fg-3)" }}>{r.requestedQty}</td>
                      <td style={{ padding: "13px 16px", textAlign: "right", fontWeight: 600, color: adjQty ? "var(--amber)" : "var(--fg)", whiteSpace: "nowrap" }}>
                        {isNF ? "—" : r.optimalQty}
                        {!isNF && <AdjBadge adj={r.adjustment} saved={r.saved} currency={r.currency} />}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "right", color: "var(--fg-2)" }}>{isNF ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}</td>
                      <td style={{ padding: "13px 16px", textAlign: "right", fontWeight: 700 }}>{isNF ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}</td>
                      <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {isNF ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", background: "#fef2f2", border: "1px solid #fecaca", padding: "3px 10px", borderRadius: 99 }}>Not found</span>
                        ) : isOOS ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: 99 }}>⚠ Out of stock</span>
                            {r.fallback && (
                              <button onClick={() => handleResolve(idx)} style={{ fontSize: 11, fontWeight: 600, color: "white", background: "var(--green)", border: "none", padding: "4px 10px", borderRadius: 99, cursor: "pointer" }}>Resolve ↗</button>
                            )}
                          </div>
                        ) : (
                          <a href={r.productUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color, background: color + "18", border: `1px solid ${color}40`, padding: "4px 12px", borderRadius: 99, textDecoration: "none" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            {r.distributor}
                            <span style={{ fontSize: 10 }}>↗</span>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Object.entries(ADJ_CONFIG).map(([key, c]) => (
              <span key={key} title={c.title} style={{ fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: "2px 8px", borderRadius: 99, cursor: "help" }}>{c.label}</span>
            ))}
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Hover for details</span>
          </div>
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
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "white", color: "var(--fg-2)", fontSize: 11, fontWeight: 500, border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer" }}
          >
            ↓ Export CSV
          </button>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", height: 52, display: "flex", alignItems: "center", padding: "0 24px", marginTop: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>© {new Date().getFullYear()} icpaste.com</span>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Built for hardware buyers</span>
        </div>
      </footer>

    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "var(--fg-3)" }}>Loading…</p></div>}>
      <ResultsContent />
    </Suspense>
  );
}

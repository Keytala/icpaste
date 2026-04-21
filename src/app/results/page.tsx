"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import type { ResultRow, SearchResponse }              from "@/lib/types";

// ── Colori distributori ───────────────────────────────────────────────────────
const DIST_COLOR: Record<string, string> = {
  "Mouser":        "#16a34a",
  "Digi-Key":      "#d97706",
  "Farnell":       "#2563eb",
  "TME":           "#7c3aed",
  "RS Components": "#dc2626",
  "Arrow":         "#0891b2",
};
const distColor = (d: string) => DIST_COLOR[d] ?? "#555";

// ── Badge aggiustamento ───────────────────────────────────────────────────────
const ADJ: Record<string, { label: string; title: string }> = {
  package:  { label: "PKG",      title: "Rounded to package unit" },
  pricestep:{ label: "STEP",     title: "Increased to better price tier" },
  both:     { label: "PKG+STEP", title: "Package unit + price tier" },
};

function AdjBadge({ adj, saved, currency }: { adj: string; saved: number; currency: string }) {
  const cfg = ADJ[adj];
  if (!cfg) return null;
  const color = adj === "package" ? "#d97706" : adj === "pricestep" ? "#16a34a" : "#7c3aed";
  return (
    <span
      title={saved > 0 ? `${cfg.title} — saves ${currency} ${saved.toFixed(2)}` : cfg.title}
      style={{
        fontSize: 9, fontWeight: 700, color,
        border: `1px solid ${color}`, padding: "0 5px",
        borderRadius: 3, marginLeft: 4, letterSpacing: 0.3,
        cursor: "help", whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Stili ─────────────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight: "100vh", display: "flex", flexDirection: "column" as const, background: "var(--bg)", fontFamily: "var(--font)" },
  header: { borderBottom: "1px solid var(--border)", height: 48, display: "flex", alignItems: "center", position: "sticky" as const, top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", zIndex: 10 },
  headerInner: { maxWidth: "var(--max-w)", margin: "0 auto", padding: "0 24px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  btnBack: { fontSize: 12, color: "var(--fg-2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--radius)" },
  logo:    { fontSize: 13, fontWeight: 600, color: "var(--fg)" },
  pills:   { display: "flex", gap: 6, flexWrap: "wrap" as const, justifyContent: "flex-end" },
  pill:    (color: string) => ({ fontSize: 11, color, border: `1px solid ${color}`, padding: "2px 8px", borderRadius: 99, display: "flex", alignItems: "center", gap: 4 }),
  main:    { flex: 1, maxWidth: "var(--max-w)", margin: "0 auto", width: "100%", padding: "24px 24px" },
  stats:   { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 },
  statCard:(accent?: boolean, green?: boolean) => ({
    border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "14px 18px", background: accent ? "#f9f9f9" : green ? "#f0fdf4" : "var(--surface)",
  }),
  statLabel: { fontSize: 10, color: "var(--fg-3)", marginBottom: 6, letterSpacing: 0.5 },
  statValue: (accent?: boolean, green?: boolean) => ({
    fontSize: 22, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1,
    color: accent ? "var(--fg)" : green ? "var(--green)" : "var(--fg)",
  }),
  statSub:   { fontSize: 11, color: "var(--fg-3)", marginTop: 4 },
  prodBanner:{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "var(--radius)", marginBottom: 14, flexWrap: "wrap" as const },
  tableWrap: { border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" },
  tableScroll:{ overflowX: "auto" as const },
  table:     { width: "100%", borderCollapse: "collapse" as const, fontFamily: "var(--font)" },
  th:        (right?: boolean) => ({ padding: "10px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: "var(--fg-3)", background: "var(--surface)", borderBottom: "1px solid var(--border)", textAlign: (right ? "right" : "left") as const, whiteSpace: "nowrap" as const }),
  td:        (right?: boolean) => ({ padding: "12px 16px", fontSize: 12, borderBottom: "1px solid var(--border)", verticalAlign: "middle" as const, textAlign: (right ? "right" : "left") as const }),
  mpn:       { fontWeight: 600, color: "var(--fg)", letterSpacing: -0.2 },
  desc:      { color: "var(--fg-3)", fontSize: 11 },
  legend:    { display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" as const },
  footer:    { borderTop: "1px solid var(--border)", height: 48, display: "flex", alignItems: "center", padding: "0 24px", marginTop: 24 },
  footerInner:{ maxWidth: "var(--max-w)", margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between" },
  footerText: { fontSize: 11, color: "var(--fg-3)" },
};

// ── Results Content ───────────────────────────────────────────────────────────
function ResultsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [data, setData]       = useState<SearchResponse | null>(null);
  const [rows, setRows]       = useState<ResultRow[]>([]);
  const [prodQty, setProdQty] = useState("");
  const [activeProd, setActiveProd] = useState(1);

  useEffect(() => {
    const raw = searchParams.get("bom");
    if (!raw) { setError("No BOM data found."); setLoading(false); return; }
    let bom: { mpn: string; qty: number }[];
    try { bom = JSON.parse(atob(raw)); } catch { setError("Invalid BOM data."); setLoading(false); return; }

    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bom }),
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

  const exportCsv = useCallback(() => {
    const csv = [
      ["MPN","Description","Requested","Buy Qty","Unit Price","Total","Distributor","URL"].join(","),
      ...rows.map(r => [r.mpn, `"${r.description}"`, r.requestedQty, r.optimalQty, r.unitPrice, r.totalPrice, r.distributor, r.productUrl].join(","))
    ].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `icpaste_bom_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }, [rows]);

  // Loading
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, fontFamily: "var(--font)" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {["Mouser", "Digi-Key", "Farnell"].map((d, i) => (
          <span key={d} style={{ fontSize: 12, color: "var(--fg-3)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 99, animation: `blink 1.4s ease ${i * 0.2}s infinite` }}>{d}</span>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--fg-3)" }}>Searching best prices…</p>
    </div>
  );

  // Error
  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "var(--font)" }}>
      <p style={{ fontSize: 13, color: "var(--red)" }}>{error}</p>
      <button onClick={() => router.push("/")} style={{ padding: "8px 16px", background: "var(--fg)", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font)" }}>← New search</button>
    </div>
  );

  if (!data) return null;

  const found    = rows.filter(r => !r.error || r.error === "Out of stock").length;
  const savings  = rows.reduce((s, r) => s + (r.saved ?? 0), 0);
  const totalBom = rows.reduce((s, r) => s + (r.totalPrice ?? 0), 0);

  // Distributori usati — fix: no Set spread
  const distUsedArr = rows.filter(r => r.distributor !== "—").map(r => r.distributor);
  const distUsed    = distUsedArr.filter((d, i) => distUsedArr.indexOf(d) === i);

  return (
    <div style={S.page}>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={S.btnBack} onClick={() => router.push("/")}>← New search</button>
            <span style={{ width: 1, height: 16, background: "var(--border)" }} />
            <span style={S.logo}>ic<span style={{ color: "var(--fg-3)" }}>paste</span></span>
          </div>
          <div style={S.pills}>
            {distUsed.map(d => (
              <span key={d} style={S.pill(distColor(d))}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: distColor(d) }} />
                {d} · {rows.filter(r => r.distributor === d).length}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={S.main}>

        {/* Stats */}
        <div style={S.stats}>
          {[
            { label: "BOM TOTAL",         value: `${rows[0]?.currency ?? "USD"} ${totalBom.toFixed(2)}`, sub: "estimated cost",       accent: true  },
            { label: "FOUND",             value: `${found} / ${rows.length}`,                            sub: "components with stock"               },
            { label: "OPTIMIZED SAVINGS", value: `${rows[0]?.currency ?? "USD"} ${savings.toFixed(2)}`,  sub: `${rows.filter(r => r.adjustment !== "none").length} qty adjusted`, green: savings > 0 },
          ].map(s => (
            <div key={s.label} style={S.statCard(s.accent, s.green)}>
              <div style={S.statLabel}>{s.label}</div>
              <div style={S.statValue(s.accent, s.green)}>{s.value}</div>
              <div style={S.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Production Run */}
        <div style={S.prodBanner}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", marginBottom: 2 }}>Production Run</div>
            <div style={{ fontSize: 11, color: "#0284c7" }}>Multiply BOM quantities by the number of finished units.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#0369a1" }}>Units to produce:</span>
            <input
              type="number" min={1} placeholder="e.g. 500"
              value={prodQty}
              onChange={e => setProdQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyProd()}
              style={{ width: 80, padding: "5px 8px", fontSize: 12, border: "1px solid #bae6fd", borderRadius: "var(--radius)", outline: "none", fontFamily: "var(--font)" }}
            />
            <button onClick={handleApplyProd} style={{ padding: "5px 12px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "var(--font)" }}>Apply →</button>
            {activeProd > 1 && (
              <button onClick={handleReset} style={{ padding: "5px 10px", background: "#fff", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 11, fontFamily: "var(--font)" }}>Reset ×</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={S.tableWrap}>
          <div style={S.tableScroll}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["MPN", "DESCRIPTION", "REQUESTED", "BUY QTY", "UNIT PRICE", "TOTAL", "BEST DEAL"].map((h, i) => (
                    <th key={h} style={S.th(i >= 2)}>{h}</th>
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
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* MPN */}
                      <td style={S.td()}>
                        <div style={S.mpn}>{r.mpn}</div>
                      </td>

                      {/* Description */}
                      <td style={S.td()}>
                        <div style={S.desc}>{r.description ? r.description.slice(0, 40) + (r.description.length > 40 ? "…" : "") : "—"}</div>
                      </td>

                      {/* Requested */}
                      <td style={S.td(true)}>
                        <span style={{ color: "var(--fg-3)" }}>{r.requestedQty}</span>
                      </td>

                      {/* Buy Qty */}
                      <td style={S.td(true)}>
                        {isNF ? "—" : (
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            <span style={{ fontWeight: adjQty ? 700 : 400, color: adjQty ? "var(--amber)" : "var(--fg)" }}>
                              {r.optimalQty}
                            </span>
                            <AdjBadge adj={r.adjustment} saved={r.saved} currency={r.currency} />
                          </span>
                        )}
                      </td>

                      {/* Unit Price */}
                      <td style={S.td(true)}>
                        {isNF ? "—" : <span style={{ color: "var(--fg-2)" }}>{r.currency} {r.unitPrice.toFixed(4)}</span>}
                      </td>

                      {/* Total */}
                      <td style={S.td(true)}>
                        {isNF ? "—" : <span style={{ fontWeight: 700 }}>{r.currency} {r.totalPrice.toFixed(2)}</span>}
                      </td>

                      {/* Best Deal */}
                      <td style={S.td(true)}>
                        {isNF ? (
                          <span style={{ fontSize: 11, color: "var(--red)", border: "1px solid var(--red)", padding: "3px 8px", borderRadius: 99 }}>Not found</span>
                        ) : isOOS ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 8px", borderRadius: 99 }}>⚠ Out of stock</span>
                            {r.fallback && (
                              <button onClick={() => handleResolve(idx)} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "var(--green)", border: "none", padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontFamily: "var(--font)" }}>
                                Resolve ↗
                              </button>
                            )}
                          </div>
                        ) : (
                          <a href={r.productUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}`, padding: "4px 10px", borderRadius: 99, whiteSpace: "nowrap" }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
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
        <div style={S.legend}>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(ADJ).map(([key, c]) => (
              <span key={key} style={{ fontSize: 10, color: "var(--fg-3)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 3 }}
                title={c.title}
              >
                {c.label}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>Hover badge for details</span>
          <button onClick={exportCsv} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "var(--bg)", color: "var(--fg-2)", fontSize: 11, border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "var(--font)" }}>
            ↓ Export CSV
          </button>
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

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", fontSize: 12, color: "var(--fg-3)" }}>
        Loading…
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}

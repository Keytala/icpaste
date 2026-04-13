"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import type { SearchResponse, ResultRow, Adjustment } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────

const font = "'JetBrains Mono', 'Courier New', monospace";

const css = {
  page: {
    minHeight: "100vh", display: "flex", flexDirection: "column" as const,
    background: "#fff", fontFamily: font, color: "#111",
  },
  header: {
    borderBottom: "1px solid #e5e7eb", padding: "0 28px", height: 44,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky" as const, top: 0, background: "rgba(255,255,255,0.97)",
    zIndex: 10, flexShrink: 0,
  },
  btnBack: {
    fontSize: 11, color: "#666", background: "none", border: "none",
    cursor: "pointer", fontFamily: font, padding: 0, letterSpacing: "0.03em",
  },
  logo: { fontSize: 13, fontWeight: 700, letterSpacing: "-0.3px" },
  logoAccent: { color: "#2563eb" },
  main: { flex: 1, padding: "20px 28px", maxWidth: 1200, margin: "0 auto", width: "100%" },
  stats: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 1, border: "1px solid #e5e7eb", marginBottom: 16,
    background: "#e5e7eb", animation: "fadeIn 0.2s ease",
  },
  statCard: { padding: "12px 16px", background: "#fff" },
  statLabel: {
    fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
    color: "#999", textTransform: "uppercase" as const, marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: 600, letterSpacing: "-0.5px", lineHeight: 1 },
  statSub: { fontSize: 10, color: "#999", marginTop: 3 },
  prodBanner: {
    border: "1px solid #e5e7eb", padding: "8px 14px", marginBottom: 14,
    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const,
    background: "#fafafa", animation: "fadeIn 0.2s ease",
  },
  prodTag: {
    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
    color: "#999", textTransform: "uppercase" as const,
  },
  prodInput: {
    width: 72, padding: "3px 7px", fontFamily: font, fontSize: 11,
    border: "1px solid #e5e7eb", background: "#fff", color: "#111", outline: "none",
  },
  btnApply: {
    padding: "3px 10px", background: "#111", color: "#fff",
    border: "none", fontFamily: font, fontSize: 10, cursor: "pointer", fontWeight: 600,
  },
  btnReset: {
    padding: "3px 10px", background: "none", color: "#666",
    border: "1px solid #e5e7eb", fontFamily: font, fontSize: 10, cursor: "pointer",
  },
  tableWrap: { border: "1px solid #e5e7eb", animation: "fadeIn 0.3s ease", overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, minWidth: 700 },
  th: {
    padding: "8px 14px", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase" as const, color: "#999", borderBottom: "1px solid #e5e7eb",
    background: "#fafafa", textAlign: "left" as const, whiteSpace: "nowrap" as const,
  },
  thR: { textAlign: "right" as const },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "10px 14px", fontSize: 12, verticalAlign: "middle" as const },
  tdR: { textAlign: "right" as const },
  mpn: { fontWeight: 600, fontSize: 13, letterSpacing: "-0.2px" },
  desc: { fontSize: 10, color: "#999", marginTop: 2 },
  qtyAdj: { color: "#d97706", fontWeight: 600 },
  oos: {
    fontSize: 9, fontWeight: 700, color: "#b45309",
    border: "1px solid #b45309", padding: "2px 6px", letterSpacing: "0.05em",
  },
  btnResolve: {
    marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#fff",
    background: "#15803d", border: "none", padding: "2px 7px",
    cursor: "pointer", fontFamily: font, letterSpacing: "0.05em",
  },
  notFound: { fontSize: 10, color: "#bbb" },
  legend: {
    display: "flex", alignItems: "center", gap: 14, marginTop: 10,
    fontSize: 10, color: "#999", flexWrap: "wrap" as const,
  },
  footer: {
    borderTop: "1px solid #e5e7eb", height: 38, display: "flex",
    alignItems: "center", justifyContent: "space-between",
    padding: "0 28px", flexShrink: 0, fontSize: 10, color: "#bbb",
  },
  loading: {
    minHeight: "100vh", display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center", gap: 10,
    fontFamily: font, fontSize: 11, color: "#999",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  BADGE
// ─────────────────────────────────────────────────────────────────────────────

const ADJ_META: Record<string, { label: string; color: string; desc: string }> = {
  package:   { label: "PKG",      color: "#d97706", desc: "rounded to package unit"        },
  pricestep: { label: "STEP",     color: "#15803d", desc: "increased to better price tier" },
  both:      { label: "PKG+STEP", color: "#7c3aed", desc: "both applied"                   },
};

function Badge({ adj, saved, currency }: { adj: Adjustment; saved: number; currency: string }) {
  const meta = ADJ_META[adj];
  if (!meta) return null;
  return (
    <span
      title={`${meta.desc}${saved > 0 ? ` — saves ${currency} ${saved.toFixed(2)}` : ""}`}
      style={{
        fontSize: 9, fontWeight: 700, padding: "1px 5px", marginLeft: 5,
        border: `1px solid ${meta.color}`, color: meta.color,
        letterSpacing: "0.05em", cursor: "help",
      }}
    >
      {meta.label}{saved > 0 ? ` -${saved.toFixed(2)}` : ""}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DISTRIBUTOR BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const DIST_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "Mouser":   { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "Digi-Key": { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  "Farnell":  { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};

function DistBtn({ name, url }: { name: string; url: string }) {
  const c = DIST_COLORS[name] ?? { bg: "#f5f5f5", color: "#555", border: "#ddd" };
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", fontSize: 11, fontWeight: 600,
        fontFamily: font, border: `1px solid ${c.border}`,
        textDecoration: "none", color: c.color, background: c.bg,
        whiteSpace: "nowrap" as const,
      }}
    >
      {name} ↗
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROW
// ─────────────────────────────────────────────────────────────────────────────

function Row({ r, onResolve }: { r: ResultRow; onResolve: (mpn: string) => void }) {
  const isOos      = r.error === "Out of stock";
  const isNotFound = Boolean(r.error && !isOos);
  const hasFallback = Boolean((r as any).fallback);

  return (
    <tr style={css.tr}>
      <td style={css.td}>
        <div style={css.mpn}>{r.mpn}</div>
        {r.description && (
          <div style={css.desc}>
            {r.description.length > 50 ? r.description.slice(0, 50) + "…" : r.description}
          </div>
        )}
      </td>
      <td style={{ ...css.td, ...css.tdR, color: "#999" }}>
        {r.requestedQty.toLocaleString()}
      </td>
      <td style={{ ...css.td, ...css.tdR }}>
        {isNotFound ? "—" : (
          <span style={r.adjustment !== "none" ? css.qtyAdj : {}}>
            {r.optimalQty.toLocaleString()}
            <Badge adj={r.adjustment} saved={r.saved} currency={r.currency} />
          </span>
        )}
      </td>
      <td style={{ ...css.td, ...css.tdR, color: "#666" }}>
        {isNotFound ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
      </td>
      <td style={{ ...css.td, ...css.tdR, fontWeight: 600 }}>
        {isNotFound ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
      </td>
      <td style={{ ...css.td, ...css.tdR }}>
        {isNotFound ? (
          <span style={css.notFound}>not found</span>
        ) : isOos ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={css.oos}>OUT OF STOCK</span>
            {hasFallback && (
              <button style={css.btnResolve} onClick={() => onResolve(r.mpn)}>
                RESOLVE
              </button>
            )}
          </span>
        ) : (
          <DistBtn name={r.distributor} url={r.productUrl} />
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

function ResultsContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [data,       setData]       = useState<SearchResponse | null>(null);
  const [origData,   setOrigData]   = useState<SearchResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [prodQty,    setProdQty]    = useState("");
  const [activeProd, setActiveProd] = useState(1);

  useEffect(() => {
    const encoded = params.get("bom");
    if (!encoded) { router.push("/"); return; }
    let bom;
    try { bom = JSON.parse(atob(encoded)); }
    catch { router.push("/"); return; }

    fetch("/api/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ bom }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return; }
        setData(json);
        setOrigData(json);
      })
      .catch(() => setError("network error"))
      .finally(() => setLoading(false));
  }, [params, router]);

  function handleResolve(mpn: string) {
    if (!data) return;
    const updated = data.results.map(r => {
      const fb = (r as any).fallback;
      if (r.mpn !== mpn || !fb) return r;
      return {
        ...r, distributor: fb.distributor, optimalQty: fb.optimalQty,
        unitPrice: fb.unitPrice, totalPrice: fb.totalPrice,
        currency: fb.currency, stock: fb.stock, productUrl: fb.productUrl,
        adjustment: "none" as const, saved: 0, error: undefined, fallback: undefined,
      };
    });
    const totalBom = parseFloat(updated.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2));
    setData({ ...data, results: updated, totalBom });
  }

  function applyProd() {
    const n = parseInt(prodQty, 10);
    if (!n || n < 1 || !origData) return;
    setActiveProd(n);
    const updated = origData.results.map(r => ({
      ...r,
      requestedQty: r.requestedQty * n,
      optimalQty:   r.optimalQty   * n,
      totalPrice:   parseFloat((r.unitPrice * r.optimalQty * n).toFixed(2)),
    }));
    const totalBom = parseFloat(updated.reduce((s, r) => s + r.totalPrice, 0).toFixed(2));
    setData({ ...origData, results: updated, totalBom });
  }

  function resetProd() {
    setActiveProd(1);
    setProdQty("");
    setData(origData);
  }

  if (loading) {
    return (
      <div style={css.loading}>
        <div style={{
          width: 14, height: 14, border: "2px solid #e5e7eb",
          borderTopColor: "#111", borderRadius: "50%",
          animation: "spin 0.6s linear infinite",
        }} />
        searching distributors...
      </div>
    );
  }

  if (error) {
    return (
      <div style={css.loading}>
        <span style={{ color: "#dc2626" }}>error: {error}</span>
        <button style={css.btnBack} onClick={() => router.push("/")}>← back</button>
      </div>
    );
  }

  if (!data) return null;

  const found      = data.results.filter(r => !r.error);
  const oos        = data.results.filter(r => r.error === "Out of stock");
  const notFound   = data.results.filter(r => r.error && r.error !== "Out of stock");
  const adjusted   = data.results.filter(r => r.adjustment !== "none");
  const totalSaved = parseFloat(data.results.reduce((s, r) => s + (r.saved ?? 0), 0).toFixed(2));
  const currency   = data.results.find(r => r.currency)?.currency ?? "USD";

  return (
    <div style={css.page}>

      {/* Header */}
      <header style={css.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button style={css.btnBack} onClick={() => router.push("/")}>← new search</button>
          <span style={{ color: "#e5e7eb" }}>|</span>
          <span style={css.logo}>ic<span style={css.logoAccent}>paste</span></span>
        </div>
        <span style={{ fontSize: 10, color: "#bbb" }}>
          {new Date(data.searchedAt).toLocaleTimeString()}
        </span>
      </header>

      <main style={css.main}>

        {/* Stats */}
        <div style={css.stats}>
          <div style={css.statCard}>
            <div style={css.statLabel}>BOM Total</div>
            <div style={{ ...css.statValue, color: "#2563eb" }}>
              {currency} {data.totalBom.toFixed(2)}
            </div>
            {activeProd > 1 && <div style={css.statSub}>× {activeProd} units</div>}
          </div>
          <div style={css.statCard}>
            <div style={css.statLabel}>Found</div>
            <div style={css.statValue}>{found.length} / {data.results.length}</div>
            <div style={css.statSub}>with stock</div>
          </div>
          {totalSaved > 0 && (
            <div style={{ ...css.statCard, background: "#f0fdf4" }}>
              <div style={css.statLabel}>Saved</div>
              <div style={{ ...css.statValue, color: "#15803d" }}>
                {currency} {totalSaved.toFixed(2)}
              </div>
              <div style={css.statSub}>{adjusted.length} qty optimized</div>
            </div>
          )}
          {oos.length > 0 && (
            <div style={{ ...css.statCard, background: "#fffbeb" }}>
              <div style={css.statLabel}>Out of stock</div>
              <div style={{ ...css.statValue, color: "#b45309" }}>{oos.length}</div>
              <div style={css.statSub}>click resolve</div>
            </div>
          )}
          {notFound.length > 0 && (
            <div style={css.statCard}>
              <div style={css.statLabel}>Not found</div>
              <div style={css.statValue}>{notFound.length}</div>
              <div style={css.statSub}>check MPN</div>
            </div>
          )}
        </div>

        {/* Production run */}
        <div style={css.prodBanner}>
          <span style={css.prodTag}>production_run</span>
          <span style={{ fontSize: 10, color: "#666" }}>
            multiply quantities by units to produce:
          </span>
          <input
            style={css.prodInput}
            type="number" min={1} placeholder="e.g. 500"
            value={prodQty}
            onChange={e => setProdQty(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyProd()}
          />
          <button style={css.btnApply} onClick={applyProd}>apply</button>
          {activeProd > 1 && (
            <>
              <button style={css.btnReset} onClick={resetProd}>reset</button>
              <span style={{ fontSize: 10, color: "#2563eb" }}>× {activeProd} active</span>
            </>
          )}
        </div>

        {/* Table */}
        <div style={css.tableWrap}>
          <table style={css.table}>
            <thead>
              <tr>
                <th style={css.th}>MPN</th>
                <th style={{ ...css.th, ...css.thR }}>Requested</th>
                <th style={{ ...css.th, ...css.thR }}>Buy Qty</th>
                <th style={{ ...css.th, ...css.thR }}>Unit Price</th>
                <th style={{ ...css.th, ...css.thR }}>Total</th>
                <th style={{ ...css.th, ...css.thR }}>Best Deal</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => (
                <Row key={`${r.mpn}-${i}`} r={r} onResolve={handleResolve} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend + Export */}
        <div style={css.legend}>
          {Object.entries(ADJ_META).map(([key, m]) => (
            <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "1px 5px",
                border: `1px solid ${m.color}`, color: m.color, letterSpacing: "0.05em",
              }}>
                {m.label}
              </span>
              {m.desc}
            </span>
          ))}
          <span style={{ marginLeft: "auto" }}>
            <button
              style={{
                fontSize: 10, fontFamily: font, background: "none",
                border: "1px solid #e5e7eb", padding: "2px 8px",
                cursor: "pointer", color: "#666",
              }}
              onClick={() => {
                const rows = [
                  ["MPN", "Requested", "Buy Qty", "Unit Price", "Total", "Distributor", "Link"].join("\t"),
                  ...data.results.map(r =>
                    [r.mpn, r.requestedQty, r.optimalQty, r.unitPrice, r.totalPrice, r.distributor, r.productUrl].join("\t")
                  ),
                ].join("\n");
                const a    = document.createElement("a");
                a.href     = URL.createObjectURL(new Blob([rows], { type: "text/tab-separated-values" }));
                a.download = `icpaste_${new Date().toISOString().split("T")[0]}.tsv`;
                a.click();
              }}
            >
              export TSV
            </button>
          </span>
        </div>

      </main>

      {/* Footer */}
      <footer style={css.footer}>
        <span>© {new Date().getFullYear()} icpaste.com</span>
        <span>built for hardware buyers</span>
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

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, ResultRow }     from "@/lib/types";

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight:     "100vh",
    display:       "flex",
    flexDirection: "column" as const,
    background:    "var(--bg)",
    fontFamily:    "var(--font)",
  },
  header: {
    borderBottom:   "1px solid var(--border)",
    padding:        "0 32px",
    height:         48,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    flexShrink:     0,
    position:       "sticky" as const,
    top:            0,
    background:     "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
    zIndex:         10,
  },
  headerLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        16,
  },
  btnBack: {
    fontSize:   12,
    color:      "var(--text-2)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    fontFamily: "var(--font)",
    padding:    0,
  },
  sep: {
    color: "var(--border)",
  },
  logo: {
    fontSize:   14,
    fontWeight: 600,
    color:      "var(--text-1)",
  },
  logoAccent: {
    color: "var(--accent)",
  },
  main: {
    flex:    1,
    padding: "24px 32px",
    maxWidth: 1200,
    margin:  "0 auto",
    width:   "100%",
  },
  stats: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap:                 1,
    border:              "1px solid var(--border)",
    marginBottom:        20,
    background:          "var(--border)",
    animation:           "fadeIn 0.2s ease",
  },
  statCard: {
    padding:    "14px 18px",
    background: "var(--bg)",
  },
  statLabel: {
    fontSize:      9,
    fontWeight:    600,
    letterSpacing: "0.1em",
    color:         "var(--text-3)",
    textTransform: "uppercase" as const,
    marginBottom:  6,
  },
  statValue: {
    fontSize:      22,
    fontWeight:    600,
    letterSpacing: "-0.5px",
    color:         "var(--text-1)",
    lineHeight:    1,
  },
  statSub: {
    fontSize:   10,
    color:      "var(--text-3)",
    marginTop:  4,
  },
  prodBanner: {
    border:         "1px solid var(--border)",
    padding:        "10px 16px",
    marginBottom:   16,
    display:        "flex",
    alignItems:     "center",
    gap:            16,
    flexWrap:       "wrap" as const,
    background:     "var(--surface)",
    animation:      "fadeIn 0.2s ease",
  },
  prodLabel: {
    fontSize:   11,
    color:      "var(--text-2)",
    flexShrink: 0,
  },
  prodInput: {
    width:      80,
    padding:    "3px 8px",
    fontFamily: "var(--font)",
    fontSize:   12,
    border:     "1px solid var(--border)",
    background: "var(--bg)",
    color:      "var(--text-1)",
    outline:    "none",
  },
  btnApply: {
    padding:    "3px 12px",
    background: "var(--text-1)",
    color:      "white",
    border:     "none",
    fontFamily: "var(--font)",
    fontSize:   11,
    cursor:     "pointer",
    fontWeight: 600,
  },
  btnReset: {
    padding:    "3px 12px",
    background: "none",
    color:      "var(--text-2)",
    border:     "1px solid var(--border)",
    fontFamily: "var(--font)",
    fontSize:   11,
    cursor:     "pointer",
  },
  table: {
    width:          "100%",
    borderCollapse: "collapse" as const,
    border:         "1px solid var(--border)",
    animation:      "fadeIn 0.3s ease",
  },
  th: {
    padding:       "8px 14px",
    fontSize:      9,
    fontWeight:    600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color:         "var(--text-3)",
    borderBottom:  "1px solid var(--border)",
    background:    "var(--surface)",
    textAlign:     "left" as const,
    whiteSpace:    "nowrap" as const,
  },
  thRight: {
    textAlign: "right" as const,
  },
  td: {
    padding:      "11px 14px",
    fontSize:     12,
    borderBottom: "1px solid var(--border)",
    verticalAlign:"middle" as const,
  },
  tdRight: {
    textAlign: "right" as const,
  },
  mpn: {
    fontWeight: 600,
    color:      "var(--text-1)",
    fontSize:   13,
  },
  desc: {
    fontSize:  11,
    color:     "var(--text-3)",
    marginTop: 2,
  },
  qtyAdj: {
    color:      "var(--amber)",
    fontWeight: 600,
  },
  adjBadge: (adj: string) => ({
    fontSize:      9,
    fontWeight:    600,
    padding:       "1px 5px",
    border:        `1px solid ${adj === "package" ? "#996600" : adj === "pricestep" ? "#007700" : "#0066ff"}`,
    color:         adj === "package" ? "#996600" : adj === "pricestep" ? "#007700" : "#0066ff",
    marginLeft:    4,
    letterSpacing: "0.05em",
    cursor:        "help" as const,
  }),
  distBtn: (dist: string) => ({
    display:        "inline-flex",
    alignItems:     "center",
    gap:            5,
    padding:        "4px 10px",
    fontSize:       11,
    fontWeight:     600,
    fontFamily:     "var(--font)",
    border:         "1px solid",
    cursor:         "pointer",
    textDecoration: "none",
    borderColor:    dist === "Mouser" ? "#1d4ed8" : dist === "Digi-Key" ? "#b45309" : "#15803d",
    color:          dist === "Mouser" ? "#1d4ed8" : dist === "Digi-Key" ? "#b45309" : "#15803d",
    background:     dist === "Mouser" ? "#eff6ff" : dist === "Digi-Key" ? "#fffbeb" : "#f0fdf4",
  }),
  outOfStock: {
    fontSize:   10,
    fontWeight: 600,
    color:      "#996600",
    border:     "1px solid #996600",
    padding:    "2px 6px",
  },
  btnResolve: {
    marginLeft: 6,
    fontSize:   10,
    fontWeight: 600,
    color:      "white",
    background: "#007700",
    border:     "none",
    padding:    "2px 8px",
    cursor:     "pointer",
    fontFamily: "var(--font)",
  },
  notFound: {
    fontSize: 11,
    color:    "var(--text-3)",
  },
  legend: {
    display:    "flex",
    alignItems: "center",
    gap:        16,
    marginTop:  12,
    fontSize:   10,
    color:      "var(--text-3)",
    flexWrap:   "wrap" as const,
  },
  loading: {
    minHeight:      "100vh",
    display:        "flex",
    flexDirection:  "column" as const,
    alignItems:     "center",
    justifyContent: "center",
    gap:            12,
    fontFamily:     "var(--font)",
    fontSize:       12,
    color:          "var(--text-2)",
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

// ── Adj Badge ─────────────────────────────────────────────────────────────────

function AdjBadge({ adj, saved, currency }: {
  adj:      string;
  saved:    number;
  currency: string;
}) {
  if (adj === "none" || !adj) return null;
  const label = adj === "package" ? "PKG" : adj === "pricestep" ? "STEP" : "PKG+STEP";
  const tip   = adj === "package"
    ? "Rounded to package unit"
    : adj === "pricestep"
    ? "Increased to better price tier"
    : "Package unit + price tier";

  return (
    <span
      title={`${tip}${saved > 0 ? ` — saves ${currency} ${saved.toFixed(2)}` : ""}`}
      style={S.adjBadge(adj)}
    >
      {label}{saved > 0 ? ` -${saved.toFixed(2)}` : ""}
    </span>
  );
}

// ── Result Row ────────────────────────────────────────────────────────────────

function ResultRow({ r, onResolve }: {
  r:         ResultRow;
  onResolve: (mpn: string) => void;
}) {
  const isOos      = r.error === "Out of stock";
  const isNotFound = Boolean(r.error && !isOos);
  const hasFallback = Boolean(r.fallback);

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>

      {/* MPN */}
      <td style={S.td}>
        <div style={S.mpn}>{r.mpn}</div>
        {r.description && (
          <div style={S.desc}>
            {r.description.length > 40
              ? r.description.slice(0, 40) + "…"
              : r.description}
          </div>
        )}
      </td>

      {/* Requested */}
      <td style={{ ...S.td, ...S.tdRight }}>
        <span style={{ color: "var(--text-2)" }}>
          {r.requestedQty.toLocaleString()}
        </span>
      </td>

      {/* Buy qty */}
      <td style={{ ...S.td, ...S.tdRight }}>
        {isNotFound ? "—" : (
          <span style={r.adjustment !== "none" ? S.qtyAdj : {}}>
            {r.optimalQty.toLocaleString()}
            <AdjBadge adj={r.adjustment} saved={r.saved} currency={r.currency} />
          </span>
        )}
      </td>

      {/* Unit price */}
      <td style={{ ...S.td, ...S.tdRight, color: "var(--text-2)" }}>
        {isNotFound ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
      </td>

      {/* Total */}
      <td style={{ ...S.td, ...S.tdRight, fontWeight: 600 }}>
        {isNotFound ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
      </td>

      {/* Best deal */}
      <td style={{ ...S.td, ...S.tdRight }}>
        {isNotFound ? (
          <span style={S.notFound}>not found</span>
        ) : isOos ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={S.outOfStock}>out of stock</span>
            {hasFallback && (
              <button style={S.btnResolve} onClick={() => onResolve(r.mpn)}>
                resolve
              </button>
            )}
          </span>
        ) : (
          <a
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={S.distBtn(r.distributor) as React.CSSProperties}
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
  const params  = useSearchParams();
  const router  = useRouter();
  const [data,     setData]     = useState<SearchResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [prodQty,  setProdQty]  = useState("");
  const [activeProd, setActiveProd] = useState(1);
  const [origData, setOrigData] = useState<SearchResponse | null>(null);

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

  // ── Resolve out of stock ───────────────────────────────────────────────────
  function handleResolve(mpn: string) {
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
        adjustment:   "none" as const,
        saved:        0,
        error:        undefined,
        fallback:     undefined,
      };
    });
    const totalBom = parseFloat(
      updated.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2)
    );
    setData({ ...data, results: updated, totalBom });
  }

  // ── Production run ─────────────────────────────────────────────────────────
  function applyProdQty() {
    const n = parseInt(prodQty, 10);
    if (!n || n < 1 || !origData) return;
    setActiveProd(n);

    const updated = origData.results.map(r => ({
      ...r,
      requestedQty: r.requestedQty * n,
      optimalQty:   r.optimalQty   * n,
      totalPrice:   parseFloat((r.unitPrice * r.optimalQty * n).toFixed(2)),
    }));
    const totalBom = parseFloat(
      updated.reduce((s, r) => s + r.totalPrice, 0).toFixed(2)
    );
    setData({ ...origData, results: updated, totalBom });
  }

  function resetProdQty() {
    setActiveProd(1);
    setProdQty("");
    setData(origData);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.loading}>
        <div style={{
          width:  12, height: 12,
          border: "2px solid var(--border)",
          borderTopColor: "var(--text-1)",
          borderRadius: "50%",
          animation: "spin 0.6s linear infinite",
        }} />
        <span>searching distributors...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.loading}>
        <span style={{ color: "var(--red)" }}>! {error}</span>
        <button style={{ ...S.btnBack, fontSize: 12 }} onClick={() => router.push("/")}>
          ← back
        </button>
      </div>
    );
  }

  if (!data) return null;

  const found      = data.results.filter(r => !r.error);
  const outOfStock = data.results.filter(r => r.error === "Out of stock");
  const notFound   = data.results.filter(r => r.error && r.error !== "Out of stock");
  const adjusted   = data.results.filter(r => r.adjustment !== "none");
  const totalSaved = parseFloat(data.results.reduce((s, r) => s + (r.saved ?? 0), 0).toFixed(2));

  return (
    <div style={S.page}>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <button style={S.btnBack} onClick={() => router.push("/")}>
            ← new search
          </button>
          <span style={S.sep}>|</span>
          <span style={S.logo}>
            ic<span style={S.logoAccent}>paste</span>
          </span>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)" }}>
          {new Date(data.searchedAt).toLocaleTimeString()}
        </div>
      </header>

      <main style={S.main}>

        {/* Stats */}
        <div style={S.stats}>
          <div style={S.statCard}>
            <div style={S.statLabel}>BOM Total</div>
            <div style={{ ...S.statValue, color: "var(--accent)" }}>
              {data.results[0]?.currency ?? "USD"} {data.totalBom.toFixed(2)}
            </div>
            {activeProd > 1 && (
              <div style={S.statSub}>× {activeProd} units</div>
            )}
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>Found</div>
            <div style={S.statValue}>{found.length} / {data.results.length}</div>
            <div style={S.statSub}>components with stock</div>
          </div>
          {totalSaved > 0 && (
            <div style={{ ...S.statCard, background: "#f0fdf4" }}>
              <div style={S.statLabel}>Saved</div>
              <div style={{ ...S.statValue, color: "#007700" }}>
                {data.results[0]?.currency ?? "USD"} {totalSaved.toFixed(2)}
              </div>
              <div style={S.statSub}>{adjusted.length} qty optimized</div>
            </div>
          )}
          {outOfStock.length > 0 && (
            <div style={{ ...S.statCard, background: "#fffbeb" }}>
              <div style={S.statLabel}>Out of stock</div>
              <div style={{ ...S.statValue, color: "#996600" }}>{outOfStock.length}</div>
              <div style={S.statSub}>click resolve to fix</div>
            </div>
          )}
          {notFound.length > 0 && (
            <div style={S.statCard}>
              <div style={S.statLabel}>Not found</div>
              <div style={S.statValue}>{notFound.length}</div>
              <div style={S.statSub}>check MPN manually</div>
            </div>
          )}
        </div>

        {/* Production run banner */}
        <div style={S.prodBanner}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.05em" }}>
            PRODUCTION_RUN
          </span>
          <span style={S.prodLabel}>multiply BOM quantities by units to produce:</span>
          <input
            style={S.prodInput}
            type="number"
            min={1}
            placeholder="e.g. 500"
            value={prodQty}
            onChange={e => setProdQty(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyProdQty()}
          />
          <button style={S.btnApply} onClick={applyProdQty}>
            apply
          </button>
          {activeProd > 1 && (
            <button style={S.btnReset} onClick={resetProdQty}>
              reset
            </button>
          )}
          {activeProd > 1 && (
            <span style={{ fontSize: 10, color: "var(--accent)" }}>
              × {activeProd} active
            </span>
          )}
        </div>

        {/* Table */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>MPN</th>
              <th style={{ ...S.th, ...S.thRight }}>Requested</th>
              <th style={{ ...S.th, ...S.thRight }}>Buy Qty</th>
              <th style={{ ...S.th, ...S.thRight }}>Unit Price</th>
              <th style={{ ...S.th, ...S.thRight }}>Total</th>
              <th style={{ ...S.th, ...S.thRight }}>Best Deal</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map(r => (
              <ResultRow
                key={r.mpn}
                r={r}
                onResolve={handleResolve}
              />
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div style={S.legend}>
          {[
            { adj: "package",   label: "PKG",      desc: "rounded to package unit"          },
            { adj: "pricestep", label: "STEP",     desc: "increased to better price tier"   },
            { adj: "both",      label: "PKG+STEP", desc: "both applied"                     },
          ].map(l => (
            <span key={l.adj} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={S.adjBadge(l.adj) as React.CSSProperties}>{l.label}</span>
              {l.desc}
            </span>
          ))}
          <span style={{ marginLeft: "auto" }}>hover badge for savings</span>
          <button
            onClick={() => {
              const rows = data.results.map(r =>
                `${r.mpn}\t${r.requestedQty}\t${r.optimalQty}\t${r.unitPrice}\t${r.totalPrice}\t${r.distributor}\t${r.productUrl}`
              ).join("\n");
              const header = "MPN\tRequested\tBuy Qty\tUnit Price\tTotal\tDistributor\tLink";
              const blob   = new Blob([header + "\n" + rows], { type: "text/tab-separated-values" });
              const url    = URL.createObjectURL(blob);
              const a      = document.createElement("a");
              a.href       = url;
              a.download   = `icpaste_bom_${new Date().toISOString().split("T")[0]}.tsv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              fontSize:   10,
              fontFamily: "var(--font)",
              background: "none",
              border:     "1px solid var(--border)",
              padding:    "2px 8px",
              cursor:     "pointer",
              color:      "var(--text-2)",
            }}
          >
            export TSV
          </button>
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

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}

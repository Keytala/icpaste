"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, OptimizedResult } from "@/lib/types";
import s from "./Results.module.css";

// ── Distributor styles ────────────────────────────────────────────────────────
const DIST: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "Mouser":          { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  "Mouser (Mock)":   { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  "Digi-Key":        { bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  "Digi-Key (Mock)": { bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  "Farnell":         { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  "Farnell (Mock)":  { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
};

function ds(name: string) {
  return DIST[name] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb", dot: "#9ca3af" };
}

// ── Result Row ────────────────────────────────────────────────────────────────
function ResultRow({
  r,
  onResolve,
}: {
  r: OptimizedResult;
  onResolve: (mpn: string) => void;
}) {
  const isOutOfStock = r.error === "Out of stock";
  const isNotFound   = r.error && r.error !== "Out of stock";
  const wasResolved  = Boolean(r.originalCode && r.originalCode !== r.mpn);
  const style        = ds(r.distributor);
  const hasFallback  = Boolean(r.stockFallback);

  return (
    <tr className={s.tr} style={isOutOfStock ? { background: "#fffbeb" } : undefined}>

      {/* MPN */}
      <td className={s.td}>
        <div className={s.mpn}>{r.mpn}</div>
        {wasResolved && (
          <span className={s.resolvedBadge}>↑ {r.originalCode}</span>
        )}
      </td>

      {/* Description */}
      <td className={`${s.td} ${s.desc}`} style={{ maxWidth: 180 }}>
        <span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {r.description || "—"}
        </span>
      </td>

      {/* Requested */}
      <td className={`${s.td} ${s.tdRight}`}>
        <span style={{ color:"var(--text-2)", fontVariantNumeric:"tabular-nums" }}>
          {r.requestedQty.toLocaleString()}
        </span>
      </td>

      {/* Buy qty */}
      <td className={`${s.td} ${s.tdRight}`}>
        {isNotFound ? "—" : (
          <>
            <span className={r.rounded ? s.qtyAdjusted : s.qtyNormal}
              style={{ fontVariantNumeric:"tabular-nums" }}>
              {r.optimalQty.toLocaleString()}
            </span>
            {r.rounded && <span className={s.adjBadge}>ADJ</span>}
          </>
        )}
      </td>

      {/* Unit price */}
      <td className={`${s.td} ${s.tdRight} ${s.priceUnit}`}>
        <span style={{ fontVariantNumeric:"tabular-nums" }}>
          {isNotFound ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
        </span>
      </td>

      {/* Total */}
      <td className={`${s.td} ${s.tdRight} ${s.priceTotal}`}>
        <span style={{ fontVariantNumeric:"tabular-nums" }}>
          {isNotFound ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
        </span>
      </td>

      {/* Best deal / status */}
      <td className={`${s.td} ${s.tdRight}`}>
        {isNotFound ? (
          // ── Not found on any distributor ──
          <span className={s.notFound}>Not found</span>

        ) : isOutOfStock ? (
          // ── Out of stock: show warning + optional Resolve button ──
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", flexWrap:"wrap" }}>
            <span className={s.outOfStock}>
              ⚠ Out of stock
            </span>
            {hasFallback && (
              <button
                className={s.btnResolve}
                onClick={() => onResolve(r.mpn)}
                title={`Switch to ${r.stockFallback!.distributor} — ${r.stockFallback!.stock} in stock @ ${r.stockFallback!.currency} ${r.stockFallback!.unitPrice.toFixed(4)}/pz`}
              >
                Resolve ↗
              </button>
            )}
          </div>

        ) : (
          // ── Normal: distributor link ──
          <a href={r.productUrl} target="_blank" rel="noopener noreferrer"
            className={s.distLink}
            style={{ background:style.bg, color:style.color, borderColor:style.border }}>
            <span className={s.distDot} style={{ background:style.dot }} />
            {r.distributor}
            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
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
  const [data, setData]         = useState<SearchResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [apiError, setApiError] = useState("");

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
        if (json.error) setApiError(json.error);
        else setData(json as SearchResponse);
      })
      .catch(() => setApiError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [params, router]);

  // ── Resolve handler: swap out-of-stock row with its stockFallback ─────────
  function handleResolve(mpn: string) {
    if (!data) return;

    const updatedResults = data.results.map(r => {
      if (r.mpn !== mpn || !r.stockFallback) return r;

      const fb = r.stockFallback;
      const style = ds(fb.distributor);

      // Swap the row with the fallback data
      return {
        ...r,
        distributor:   fb.distributor,
        optimalQty:    fb.optimalQty,
        rounded:       fb.rounded,
        unitPrice:     fb.unitPrice,
        totalPrice:    fb.totalPrice,
        currency:      fb.currency,
        stock:         fb.stock,
        productUrl:    fb.productUrl,
        error:         undefined,       // clear error
        stockFallback: undefined,       // clear fallback
      } as OptimizedResult;
    });

    const newTotal = parseFloat(
      updatedResults.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0).toFixed(2)
    );

    setData({ ...data, results: updatedResults, totalBom: newTotal });
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={s.loading}>
        <div className={s.loadingPills}>
          {["Mouser", "Digi-Key", "Farnell"].map((d, i) => (
            <div key={d} className={s.loadingPill} style={{ animationDelay:`${i*150}ms` }}>
              <span className={s.loadingDot} style={{ animationDelay:`${i*200}ms` }} />
              {d}
            </div>
          ))}
        </div>
        <p className={s.loadingText}>Searching distributors…</p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className={s.loading}>
        <p style={{ color:"var(--red)", fontFamily:"Inter, sans-serif" }}>{apiError}</p>
        <button className={s.btnBack} onClick={() => router.push("/")}>← Back</button>
      </div>
    );
  }

  if (!data) return null;

  const found      = data.results.filter(r => !r.error);
  const outOfStock = data.results.filter(r => r.error === "Out of stock");
  const notFound   = data.results.filter(r => r.error && r.error !== "Out of stock");
  const resolved   = data.results.filter(r => r.originalCode && r.originalCode !== r.mpn);

  const distCount = found.reduce((acc, r) => {
    acc[r.distributor] = (acc[r.distributor] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={s.page}>

      {/* Header */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.headerLeft}>
            <button className={s.btnBack} onClick={() => router.push("/")}>
              ← New search
            </button>
            <div className={s.divider} />
            <span className={s.logo}>
              ic<span className={s.logoAccent}>paste</span>
            </span>
          </div>
          <div className={s.distPills}>
            {Object.entries(distCount).map(([dist, count]) => {
              const style = ds(dist);
              return (
                <span key={dist} className={s.distLink}
                  style={{ background:style.bg, color:style.color, borderColor:style.border }}>
                  <span className={s.distDot} style={{ background:style.dot }} />
                  {dist} · {count}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <main className={s.main}>

        {/* Stats */}
        <div className={s.stats}>
          <div className={s.statCard}>
            <div className={s.statLabel}>BOM Total</div>
            <div className={`${s.statValue} ${s.statValueAccent}`}>
              {data.currency} {data.totalBom.toFixed(2)}
            </div>
            <div className={s.statSub}>estimated cost</div>
          </div>
          <div className={s.statCard}>
            <div className={s.statLabel}>Found</div>
            <div className={s.statValue}>{found.length} / {data.results.length}</div>
            <div className={s.statSub}>components with stock</div>
          </div>
          {outOfStock.length > 0 && (
            <div className={s.statCard} style={{ borderColor:"#fde68a", background:"#fffbeb" }}>
              <div className={s.statLabel}>Out of stock</div>
              <div className={s.statValue} style={{ color:"var(--amber)" }}>
                {outOfStock.length}
              </div>
              <div className={s.statSub}>click Resolve to fix</div>
            </div>
          )}
          {notFound.length > 0 && (
            <div className={s.statCard}>
              <div className={s.statLabel}>Not found</div>
              <div className={s.statValue}>{notFound.length}</div>
              <div className={s.statSub}>check MPN manually</div>
            </div>
          )}
        </div>

        {/* Out of stock notice */}
        {outOfStock.length > 0 && (
          <div className={s.notice} style={{
            background:"#fffbeb", borderColor:"#fde68a", color:"#92400e", marginBottom:12
          }}>
            <strong>⚠ {outOfStock.length} component{outOfStock.length > 1 ? "s" : ""} out of stock.</strong>
            {" "}Click <strong>Resolve</strong> to instantly switch to the next best available option.
          </div>
        )}

        {/* Auto-resolve notice */}
        {resolved.length > 0 && (
          <div className={s.notice} style={{
            background:"var(--violet-light)", borderColor:"#e9d5ff", color:"var(--violet)"
          }}>
            <strong>Auto-resolved {resolved.length} distributor code{resolved.length > 1 ? "s" : ""}</strong>
            {" "}— order codes were automatically converted to manufacturer part numbers.
          </div>
        )}

        {/* Table */}
        <div className={s.tableWrap}>
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead className={s.thead}>
                <tr>
                  <th className={`${s.th} ${s.thLeft}`}>MPN</th>
                  <th className={`${s.th} ${s.thLeft}`}>Description</th>
                  <th className={`${s.th} ${s.thRight}`}>Requested</th>
                  <th className={`${s.th} ${s.thRight}`}>Buy Qty</th>
                  <th className={`${s.th} ${s.thRight}`}>Unit Price</th>
                  <th className={`${s.th} ${s.thRight}`}>Total</th>
                  <th className={`${s.th} ${s.thRight}`}>Best Deal</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map(r => (
                  <ResultRow
                    key={r.originalCode ?? r.mpn}
                    r={r}
                    onResolve={handleResolve}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className={s.legend}>
          <span>
            <span className={s.adjBadge}>ADJ</span> Qty rounded to nearest package unit
          </span>
          <span>
            <span className={s.legendDot} style={{ background:"#a78bfa" }} />
            Distributor code auto-resolved
          </span>
          <span>Prices are indicative — verify on distributor site</span>
        </div>

      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span className={s.footerText}>© {new Date().getFullYear()} icpaste.com</span>
          <span className={s.footerText}>Built for hardware buyers</span>
        </div>
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

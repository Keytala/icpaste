"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, OptimizedResult, AdjustmentType } from "@/lib/types";
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

// ── Badge Config ──────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, {
  label: string; bg: string; color: string; border: string;
  title: string; detail: (req: number, opt: number) => string;
}> = {
  package: {
    label:  "PKG",
    bg:     "#fffbeb", color: "#d97706", border: "#fde68a",
    title:  "Package unit adjusted",
    detail: (req, opt) => `${req.toLocaleString()} → ${opt.toLocaleString()} pcs  ·  rounded to reel / tray size`,
  },
  pricestep: {
    label:  "STEP",
    bg:     "#f0fdf4", color: "#15803d", border: "#bbf7d0",
    title:  "Better price tier",
    detail: (req, opt) => `${req.toLocaleString()} → ${opt.toLocaleString()} pcs  ·  cheaper price break reached`,
  },
  both: {
    label:  "PKG+STEP",
    bg:     "#faf5ff", color: "#7c3aed", border: "#e9d5ff",
    title:  "Package + price tier",
    detail: (req, opt) => `${req.toLocaleString()} → ${opt.toLocaleString()} pcs  ·  package unit and price break`,
  },
};

// ── Adj Badge with Tooltip ────────────────────────────────────────────────────
function AdjBadge({ type, saved, requestedQty, optimalQty, currency }: {
  type: AdjustmentType; saved: number;
  requestedQty: number; optimalQty: number; currency: string;
}) {
  if (type === "none" || !BADGE_CONFIG[type]) return null;
  const cfg = BADGE_CONFIG[type];

  return (
    <span className={s.badgeWrapper}>
      {/* Badge pill */}
      <span style={{
        display:      "inline-block",
        fontSize:     "9px",
        fontWeight:   700,
        color:        cfg.color,
        background:   cfg.bg,
        border:       `1px solid ${cfg.border}`,
        padding:      "1px 6px",
        borderRadius: "99px",
        fontFamily:   "Inter, sans-serif",
        cursor:       "help",
        userSelect:   "none",
        lineHeight:   "16px",
      }}>
        {cfg.label}
      </span>

      {/* Tooltip */}
      <span className={s.tooltip}>
        <span className={s.tooltipInner}>
          <span style={{ display:"block", fontWeight:600, marginBottom:3 }}>
            {cfg.title}
          </span>
          <span style={{ display:"block", color:"#94a3b8", fontSize:10 }}>
            {cfg.detail(requestedQty, optimalQty)}
          </span>
          {saved > 0 && (
            <span className={s.tooltipSaving}>
              saves {currency} {saved.toFixed(2)}
            </span>
          )}
        </span>
        <span className={s.tooltipArrow} />
      </span>
    </span>
  );
}

// ── Result Row ────────────────────────────────────────────────────────────────
function ResultRow({ r, onResolve }: {
  r: OptimizedResult;
  onResolve: (mpn: string) => void;
}) {
  const isOutOfStock = r.error === "Out of stock";
  const isNotFound   = r.error && r.error !== "Out of stock";
  const wasResolved  = Boolean(r.originalCode && r.originalCode !== r.mpn);
  const style        = ds(r.distributor);
  const hasFallback  = Boolean(r.stockFallback);

  return (
    <tr className={s.tr} style={isOutOfStock ? { background:"#fffbeb" } : undefined}>

      {/* MPN */}
      <td className={s.td}>
        <div className={s.mpn}>{r.mpn}</div>
        {wasResolved && (
          <span className={s.resolvedBadge}>↑ {r.originalCode}</span>
        )}
      </td>

      {/* Description */}
      <td className={`${s.td} ${s.desc}`} style={{ maxWidth:180 }}>
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

      {/* Buy qty + badge */}
      <td className={`${s.td} ${s.tdRight}`}>
        {isNotFound ? "—" : (
          <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"flex-end", gap:5 }}>
            <span
              className={r.adjustment !== "none" ? s.qtyAdjusted : s.qtyNormal}
              style={{ fontVariantNumeric:"tabular-nums" }}
            >
              {r.optimalQty.toLocaleString()}
            </span>
            <AdjBadge
              type={r.adjustment ?? "none"}
              saved={r.savedVsOriginal ?? 0}
              requestedQty={r.requestedQty}
              optimalQty={r.optimalQty}
              currency={r.currency}
            />
          </span>
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

      {/* Best deal */}
      <td className={`${s.td} ${s.tdRight}`}>
        {isNotFound ? (
          <span className={s.notFound}>Not found</span>
        ) : isOutOfStock ? (
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", flexWrap:"wrap" }}>
            <span className={s.outOfStock}>⚠ Out of stock</span>
            {hasFallback && (
              <button
                className={s.btnResolve}
                onClick={() => onResolve(r.mpn)}
                title={`Switch to ${r.stockFallback!.distributor} — ${r.stockFallback!.stock.toLocaleString()} in stock @ ${r.stockFallback!.currency} ${r.stockFallback!.unitPrice.toFixed(4)}/pz`}
              >
                Resolve ↗
              </button>
            )}
          </div>
        ) : (
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

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, style }: {
  label: string; value: string; sub?: string;
  accent?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div className={s.statCard} style={style}>
      <div className={s.statLabel}>{label}</div>
      <div className={`${s.statValue} ${accent ? s.statValueAccent : ""}`}>{value}</div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
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

  // ── Resolve handler ───────────────────────────────────────────────────────
  function handleResolve(mpn: string) {
    if (!data) return;
    const updatedResults = data.results.map(r => {
      if (r.mpn !== mpn || !r.stockFallback) return r;
      const fb = r.stockFallback;
      return {
        ...r,
        distributor:     fb.distributor,
        optimalQty:      fb.optimalQty,
        rounded:         fb.rounded,
        adjustment:      "none" as AdjustmentType,
        savedVsOriginal: 0,
        unitPrice:       fb.unitPrice,
        totalPrice:      fb.totalPrice,
        currency:        fb.currency,
        stock:           fb.stock,
        productUrl:      fb.productUrl,
        error:           undefined,
        stockFallback:   undefined,
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

  // ── Error ─────────────────────────────────────────────────────────────────
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
  const adjusted   = data.results.filter(r => r.adjustment && r.adjustment !== "none");
  const totalSaved = parseFloat(
    data.results.reduce((sum, r) => sum + (r.savedVsOriginal ?? 0), 0).toFixed(2)
  );

  const distCount = found.reduce((acc, r) => {
    acc[r.distributor] = (acc[r.distributor] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={s.page}>

      {/* ── Header ── */}
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.headerLeft}>
            <button className={s.btnBack} onClick={() => router.push("/")}>← New search</button>
            <div className={s.divider} />
            <span className={s.logo}>ic<span className={s.logoAccent}>paste</span></span>
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

        {/* ── Stats ── */}
        <div className={s.stats}>
          <StatCard
            label="BOM Total"
            value={`${data.currency} ${data.totalBom.toFixed(2)}`}
            sub="estimated cost"
            accent
          />
          <StatCard
            label="Found"
            value={`${found.length} / ${data.results.length}`}
            sub="components with stock"
          />
          {totalSaved > 0 && (
            <StatCard
              label="Optimized savings"
              value={`$${totalSaved.toFixed(2)}`}
              sub={`${adjusted.length} qty adjusted`}
              style={{ borderColor:"#bbf7d0", background:"#f0fdf4" }}
            />
          )}
          {outOfStock.length > 0 && (
            <StatCard
              label="Out of stock"
              value={`${outOfStock.length}`}
              sub="click Resolve to fix"
              style={{ borderColor:"#fde68a", background:"#fffbeb" }}
            />
          )}
          {notFound.length > 0 && (
            <StatCard
              label="Not found"
              value={`${notFound.length}`}
              sub="check MPN manually"
            />
          )}
        </div>

        {/* ── Notices ── */}
        {outOfStock.length > 0 && (
          <div className={s.notice}
            style={{ background:"#fffbeb", borderColor:"#fde68a", color:"#92400e" }}>
            <strong>⚠ {outOfStock.length} component{outOfStock.length > 1 ? "s" : ""} out of stock.</strong>
            {" "}Click <strong>Resolve</strong> to instantly switch to the next best available option.
          </div>
        )}
        {resolved.length > 0 && (
          <div className={s.notice}
            style={{ background:"#faf5ff", borderColor:"#e9d5ff", color:"#7c3aed" }}>
            <strong>Auto-resolved {resolved.length} distributor code{resolved.length > 1 ? "s" : ""}.</strong>
            {" "}Order codes were automatically converted to manufacturer part numbers.
          </div>
        )}

        {/* ── Table ── */}
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

        {/* ── Legend ── */}
        <div className={s.legend}>
          {[
            { label:"PKG",      bg:"#fffbeb", color:"#d97706", border:"#fde68a", text:"Rounded to package unit" },
            { label:"STEP",     bg:"#f0fdf4", color:"#15803d", border:"#bbf7d0", text:"Increased to better price tier" },
            { label:"PKG+STEP", bg:"#faf5ff", color:"#7c3aed", border:"#e9d5ff", text:"Both applied" },
          ].map(l => (
            <span key={l.label} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
              <span style={{
                fontSize:"9px", fontWeight:700, color:l.color, background:l.bg,
                border:`1px solid ${l.border}`, padding:"1px 6px",
                borderRadius:"99px", fontFamily:"Inter, sans-serif",
              }}>{l.label}</span>
              {l.text}
            </span>
          ))}
          <span style={{ marginLeft:"auto", color:"var(--text-3)" }}>
            Hover badge for details
          </span>
        </div>

      </main>

      {/* ── Footer ── */}
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
  return <Suspense><ResultsContent /></Suspense>;
}

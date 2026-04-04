"use client";

import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, OptimizedResult, AdjustmentType, BomRow } from "@/lib/types";
import { Tooltip } from "@/components/Tooltip";
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
  label:  string; bg: string; color: string; border: string;
  title:  string; detail: (req: number, opt: number) => string;
}> = {
  package: {
    label:  "PKG",    bg: "#fffbeb", color: "#d97706", border: "#fde68a",
    title:  "Package unit adjusted",
    detail: (req, opt) => `${req.toLocaleString()} → ${opt.toLocaleString()} pcs  ·  rounded to reel / tray size`,
  },
  pricestep: {
    label:  "STEP",   bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0",
    title:  "Better price tier",
    detail: (req, opt) => `${req.toLocaleString()} → ${opt.toLocaleString()} pcs  ·  cheaper price break reached`,
  },
  both: {
    label:  "PKG+STEP", bg: "#faf5ff", color: "#7c3aed", border: "#e9d5ff",
    title:  "Package + price tier",
    detail: (req, opt) => `${req.toLocaleString()} → ${opt.toLocaleString()} pcs  ·  package unit and price break`,
  },
};

const LEGEND_BADGES = [
  { label: "PKG",      bg: "#fffbeb", color: "#d97706", border: "#fde68a", title: "Package unit adjusted",   detail: "Qty rounded to nearest reel / tray size" },
  { label: "STEP",     bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", title: "Better price tier",       detail: "Qty increased to reach a cheaper price break" },
  { label: "PKG+STEP", bg: "#faf5ff", color: "#7c3aed", border: "#e9d5ff", title: "Package + price tier",    detail: "Both package unit and price break applied" },
];

// ── Adj Badge ─────────────────────────────────────────────────────────────────
function AdjBadge({ type, saved, requestedQty, optimalQty, currency }: {
  type: AdjustmentType; saved: number;
  requestedQty: number; optimalQty: number; currency: string;
}) {
  if (type === "none" || !BADGE_CONFIG[type]) return null;
  const cfg = BADGE_CONFIG[type];
  return (
    <Tooltip
      title={cfg.title}
      detail={cfg.detail(requestedQty, optimalQty)}
      saving={saved > 0 ? `saves ${currency} ${saved.toFixed(2)}` : undefined}
    >
      <span style={{
        display: "inline-block", fontSize: "9px", fontWeight: 700,
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
        padding: "1px 6px", borderRadius: "99px", fontFamily: "Inter, sans-serif",
        cursor: "help", userSelect: "none", lineHeight: "16px",
      }}>
        {cfg.label}
      </span>
    </Tooltip>
  );
}

// ── Result Row ────────────────────────────────────────────────────────────────
function ResultRow({ r, onResolve, prodQty }: {
  r:         OptimizedResult;
  onResolve: (mpn: string) => void;
  prodQty:   number;
}) {
  const isOutOfStock      = r.error === "Out of stock";
  const isNotFound        = Boolean(r.error && r.error !== "Out of stock");
  const isInsufficient    = Boolean(r.error === "Insufficient stock for production qty");
  const wasResolved       = Boolean(r.originalCode && r.originalCode !== r.mpn);
  const style             = ds(r.distributor);
  const hasFallback       = Boolean(r.stockFallback);
  const isProdMode        = prodQty > 1;

  // Qty originale dalla BOM (prima della moltiplicazione)
  const originalBomQty = isProdMode
    ? Math.round(r.requestedQty / prodQty)
    : r.requestedQty;

  return (
    <tr className={s.tr} style={
      isOutOfStock || isInsufficient
        ? { background: "#fffbeb" }
        : undefined
    }>

      {/* MPN */}
      <td className={s.td}>
        <div className={s.mpn}>{r.mpn}</div>
        {wasResolved && (
          <span className={s.resolvedBadge}>↑ {r.originalCode}</span>
        )}
      </td>

      {/* Description */}
      <td className={`${s.td} ${s.desc}`} style={{ maxWidth: 180 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.description || "—"}
        </span>
      </td>

      {/* Requested qty — mostra orig × prodQty se in prod mode */}
      <td className={`${s.td} ${s.tdRight}`}>
        <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
          {r.requestedQty.toLocaleString()}
        </span>
        {isProdMode && (
          <div className={s.qtyOriginal}>
            {originalBomQty.toLocaleString()} × {prodQty}
          </div>
        )}
      </td>

      {/* Buy qty + badge */}
      <td className={`${s.td} ${s.tdRight}`}>
        {isNotFound ? "—" : (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
            <span
              className={r.adjustment && r.adjustment !== "none" ? s.qtyAdjusted : s.qtyNormal}
              style={{ fontVariantNumeric: "tabular-nums" }}
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
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {isNotFound ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
        </span>
      </td>

      {/* Total */}
      <td className={`${s.td} ${s.tdRight} ${s.priceTotal}`}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {isNotFound ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
        </span>
      </td>

      {/* Best deal */}
      <td className={`${s.td} ${s.tdRight}`}>
        {isNotFound ? (
          <span className={s.notFound}>Not found</span>
        ) : isInsufficient ? (
          <span className={s.insufficientStock}>⚠ Insufficient stock</span>
        ) : isOutOfStock ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span className={s.outOfStock}>⚠ Out of stock</span>
            {hasFallback && (
              <button className={s.btnResolve} onClick={() => onResolve(r.mpn)}
                title={`Switch to ${r.stockFallback!.distributor} — ${r.stockFallback!.stock.toLocaleString()} in stock`}>
                Resolve ↗
              </button>
            )}
          </div>
        ) : (
          <a href={r.productUrl} target="_blank" rel="noopener noreferrer"
            className={s.distLink}
            style={{ background: style.bg, color: style.color, borderColor: style.border }}>
            <span className={s.distDot} style={{ background: style.dot }} />
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
  label: string; value: string; sub?: string; accent?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div className={s.statCard} style={style}>
      <div className={s.statLabel}>{label}</div>
      <div className={`${s.statValue} ${accent ? s.statValueAccent : ""}`}>{value}</div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
  );
}

// ── Production Qty Banner ─────────────────────────────────────────────────────
function ProdQtyBanner({ onApply, isLoading, activeProdQty }: {
  onApply:       (qty: number) => void;
  isLoading:     boolean;
  activeProdQty: number;
}) {
  const [value, setValue] = useState(activeProdQty > 1 ? String(activeProdQty) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleApply = useCallback(() => {
    const qty = parseInt(value, 10);
    if (!qty || qty < 1) return;
    onApply(qty);
  }, [value, onApply]);

  const handleReset = useCallback(() => {
    setValue("");
    onApply(1);
  }, [onApply]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleApply();
  }

  return (
    <div className={s.prodBanner}>
      {/* Icon + text */}
      <span className={s.prodBannerIcon}>🏭</span>
      <div className={s.prodBannerText}>
        <div className={s.prodBannerTitle}>Production Run</div>
        <div className={s.prodBannerSub}>
          Multiply BOM quantities by the number of finished units you want to produce.
          All stock checks and price breaks are recalculated automatically.
        </div>
      </div>

      {/* Controls */}
      <div className={s.prodBannerControls}>
        {activeProdQty > 1 && (
          <span className={s.prodActiveBadge}>
            × {activeProdQty} units active
          </span>
        )}
        <span className={s.prodBannerLabel}>Units to produce:</span>
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={100000}
          placeholder="e.g. 500"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={s.prodInput}
        />
        <button
          className={s.btnApply}
          onClick={handleApply}
          disabled={isLoading || !value || parseInt(value) < 1}
        >
          {isLoading ? "…" : "Apply ↗"}
        </button>
        {activeProdQty > 1 && (
          <button className={s.btnReset} onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function ResultsContent() {
  const params  = useSearchParams();
  const router  = useRouter();

  const [data, setData]               = useState<SearchResponse | null>(null);
  const [baseData, setBaseData]       = useState<SearchResponse | null>(null); // dati originali BOM
  const [originalBom, setOriginalBom] = useState<BomRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [apiError, setApiError]       = useState("");
  const [activeProdQty, setActiveProdQty] = useState(1);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const encoded = params.get("bom");
    if (!encoded) { router.push("/"); return; }

    let bom: BomRow[];
    try { bom = JSON.parse(atob(encoded)); }
    catch { router.push("/"); return; }

    setOriginalBom(bom);

    fetch("/api/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ bom }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.error) setApiError(json.error);
        else {
          setData(json as SearchResponse);
          setBaseData(json as SearchResponse);  // salva i dati base
        }
      })
      .catch(() => setApiError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [params, router]);

  // ── Apply production qty ──────────────────────────────────────────────────
  const handleApplyProdQty = useCallback(async (prodQty: number) => {
    if (prodQty === 1) {
      // Reset ai dati originali
      setData(baseData);
      setActiveProdQty(1);
      return;
    }

    setProdLoading(true);

    // Moltiplica le quantità della BOM originale
    const multipliedBom: BomRow[] = originalBom.map(row => ({
      ...row,
      qty: row.qty * prodQty,
    }));

    try {
      const res  = await fetch("/api/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bom: multipliedBom }),
      });
      const json = await res.json();

      if (json.error) {
        setApiError(json.error);
      } else {
        setData(json as SearchResponse);
        setActiveProdQty(prodQty);
      }
    } catch {
      setApiError("Network error. Please try again.");
    } finally {
      setProdLoading(false);
    }
  }, [originalBom, baseData]);

  // ── Resolve out-of-stock ──────────────────────────────────────────────────
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
            <div key={d} className={s.loadingPill} style={{ animationDelay: `${i * 150}ms` }}>
              <span className={s.loadingDot} style={{ animationDelay: `${i * 200}ms` }} />
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
        <p style={{ color: "var(--red)", fontFamily: "Inter, sans-serif" }}>{apiError}</p>
        <button className={s.btnBack} onClick={() => router.push("/")}>← Back</button>
      </div>
    );
  }

  if (!data) return null;

  // ── Derived stats ─────────────────────────────────────────────────────────
  const found       = data.results.filter(r => !r.error);
  const outOfStock  = data.results.filter(r => r.error === "Out of stock");
  const insufficient = data.results.filter(r => r.error === "Insufficient stock for production qty");
  const notFound    = data.results.filter(r => r.error && r.error !== "Out of stock" && r.error !== "Insufficient stock for production qty");
  const resolved    = data.results.filter(r => r.originalCode && r.originalCode !== r.mpn);
  const adjusted    = data.results.filter(r => r.adjustment && r.adjustment !== "none");
  const totalSaved  = parseFloat(
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
                  style={{ background: style.bg, color: style.color, borderColor: style.border }}>
                  <span className={s.distDot} style={{ background: style.dot }} />
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
            label={activeProdQty > 1 ? `BOM Total × ${activeProdQty}` : "BOM Total"}
            value={`${data.currency} ${data.totalBom.toFixed(2)}`}
            sub={activeProdQty > 1 ? `${activeProdQty} production units` : "estimated cost"}
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
              style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}
            />
          )}
          {(outOfStock.length > 0 || insufficient.length > 0) && (
            <StatCard
              label={insufficient.length > 0 ? "Insufficient stock" : "Out of stock"}
              value={`${outOfStock.length + insufficient.length}`}
              sub={insufficient.length > 0 ? "for production qty" : "click Resolve to fix"}
              style={{ borderColor: "#fde68a", background: "#fffbeb" }}
            />
          )}
          {notFound.length > 0 && (
            <StatCard label="Not found" value={`${notFound.length}`} sub="check MPN manually" />
          )}
        </div>

        {/* ── Notices ── */}
        {outOfStock.length > 0 && (
          <div className={s.notice} style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
            <strong>⚠ {outOfStock.length} component{outOfStock.length > 1 ? "s" : ""} out of stock.</strong>
            {" "}Click <strong>Resolve</strong> to instantly switch to the next best available option.
          </div>
        )}
        {insufficient.length > 0 && (
          <div className={s.notice} style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
            <strong>⚠ {insufficient.length} component{insufficient.length > 1 ? "s" : ""} have insufficient stock</strong>
            {" "}for a production run of <strong>{activeProdQty} units</strong>.
            Consider splitting the order or contacting the distributor directly.
          </div>
        )}
        {resolved.length > 0 && (
          <div className={s.notice} style={{ background: "#faf5ff", borderColor: "#e9d5ff", color: "#7c3aed" }}>
            <strong>Auto-resolved {resolved.length} distributor code{resolved.length > 1 ? "s" : ""}.</strong>
            {" "}Order codes were automatically converted to manufacturer part numbers.
          </div>
        )}

        {/* ── Production Qty Banner ── */}
        <ProdQtyBanner
          onApply={handleApplyProdQty}
          isLoading={prodLoading}
          activeProdQty={activeProdQty}
        />

        {/* ── Loading overlay for prod recalculation ── */}
        {prodLoading && (
          <div style={{
            textAlign: "center", padding: "12px",
            fontSize: "13px", color: "var(--text-3)",
            fontFamily: "Inter, sans-serif",
          }}>
            Recalculating for {activeProdQty} units…
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
                  <th className={`${s.th} ${s.thRight}`}>
                    {activeProdQty > 1 ? "Qty × " + activeProdQty : "Requested"}
                  </th>
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
                    prodQty={activeProdQty}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className={s.legend}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {LEGEND_BADGES.map(l => (
              <Tooltip key={l.label} title={l.title} detail={l.detail}>
                <span style={{
                  fontSize: "9px", fontWeight: 700, color: l.color,
                  background: l.bg, border: `1px solid ${l.border}`,
                  padding: "2px 8px", borderRadius: "99px",
                  fontFamily: "Inter, sans-serif", cursor: "help",
                  userSelect: "none", lineHeight: "16px",
                }}>
                  {l.label}
                </span>
              </Tooltip>
            ))}
          </div>
          <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: 11 }}>
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

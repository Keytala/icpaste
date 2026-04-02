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

function distStyle(name: string) {
  return DIST[name] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb", dot: "#9ca3af" };
}

// ── Result Row ────────────────────────────────────────────────────────────────
function ResultRow({ r }: { r: OptimizedResult }) {
  const hasError    = Boolean(r.error);
  const wasResolved = Boolean(r.originalCode && r.originalCode !== r.mpn);
  const ds          = distStyle(r.distributor);

  return (
    <tr className={s.tr}>

      {/* MPN */}
      <td className={s.td}>
        <div className={s.mpn}>{r.mpn}</div>
        {wasResolved && (
          <div>
            <span className={s.resolvedBadge}>↑ {r.originalCode}</span>
          </div>
        )}
      </td>

      {/* Description */}
      <td className={`${s.td} ${s.desc}`} style={{ maxWidth: 200 }}>
        <span style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {r.description || "—"}
        </span>
      </td>

      {/* Requested */}
      <td className={`${s.td} ${s.tdRight}`}>
        <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
          {r.requestedQty.toLocaleString()}
        </span>
      </td>

      {/* Buy qty */}
      <td className={`${s.td} ${s.tdRight}`}>
        <span className={r.rounded ? s.qtyAdjusted : s.qtyNormal}
          style={{ fontVariantNumeric: "tabular-nums" }}>
          {r.optimalQty.toLocaleString()}
        </span>
        {r.rounded && <span className={s.adjBadge}>ADJ</span>}
      </td>

      {/* Unit price */}
      <td className={`${s.td} ${s.tdRight} ${s.priceUnit}`}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {hasError ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
        </span>
      </td>

      {/* Total */}
      <td className={`${s.td} ${s.tdRight} ${s.priceTotal}`}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {hasError ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
        </span>
      </td>

      {/* Best deal */}
      <td className={`${s.td} ${s.tdRight}`}>
        {hasError ? (
          <span className={s.notFound}>Not found</span>
        ) : (
          <a href={r.productUrl} target="_blank" rel="noopener noreferrer"
            className={s.distLink}
            style={{ background: ds.bg, color: ds.color, borderColor: ds.border }}>
            <span className={s.distDot} style={{ background: ds.dot }} />
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bom }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.error) setApiError(json.error);
        else setData(json as SearchResponse);
      })
      .catch(() => setApiError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [params, router]);

  if (loading) {
    return (
      <div className={s.loading}>
        <div className={s.loadingPills}>
          {["Mouser", "Digi-Key", "Farnell"].map((d, i) => (
            <div key={d} className={s.loadingPill}
              style={{ animationDelay: `${i * 150}ms` }}>
              <span className={s.loadingDot}
                style={{ animationDelay: `${i * 200}ms` }} />
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

  const found    = data.results.filter(r => !r.error);
  const notFound = data.results.filter(r => r.error);
  const resolved = data.results.filter(r => r.originalCode && r.originalCode !== r.mpn);

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
              const ds = distStyle(dist);
              return (
                <span key={dist} className={s.distLink}
                  style={{ background: ds.bg, color: ds.color, borderColor: ds.border }}>
                  <span className={s.distDot} style={{ background: ds.dot }} />
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
          {resolved.length > 0 && (
            <div className={s.statCard}>
              <div className={s.statLabel}>Auto-resolved</div>
              <div className={s.statValue}>{resolved.length}</div>
              <div className={s.statSub}>distributor codes → MPN</div>
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

        {/* Auto-resolve notice */}
        {resolved.length > 0 && (
          <div className={`${s.notice} ${s.noticeViolet}`}>
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
                  <ResultRow key={r.originalCode ?? r.mpn} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className={s.legend}>
          <span>
            <span className={s.adjBadge}>ADJ</span>
            {" "}Qty rounded to nearest package unit
          </span>
          <span>
            <span className={s.legendDot} style={{ background: "#a78bfa" }} />
            Distributor code auto-resolved to MPN
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

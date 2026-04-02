"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, OptimizedResult } from "@/lib/types";

// ── Distributor styles ────────────────────────────────────────────────────────
const DIST_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "Mouser":          { bg: "rgba(56,112,248,0.15)",  text: "#93c5fd", dot: "#3b82f6" },
  "Mouser (Mock)":   { bg: "rgba(56,112,248,0.15)",  text: "#93c5fd", dot: "#3b82f6" },
  "Digi-Key":        { bg: "rgba(250,204,21,0.12)",  text: "#fde68a", dot: "#f59e0b" },
  "Digi-Key (Mock)": { bg: "rgba(250,204,21,0.12)",  text: "#fde68a", dot: "#f59e0b" },
  "Farnell":         { bg: "rgba(34,197,94,0.12)",   text: "#86efac", dot: "#22c55e" },
  "Farnell (Mock)":  { bg: "rgba(34,197,94,0.12)",   text: "#86efac", dot: "#22c55e" },
};

function distStyle(name: string) {
  return DIST_STYLE[name] ?? { bg: "rgba(255,255,255,0.06)", text: "#94a3b8", dot: "#64748b" };
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ArrowLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ExternalLink = () => (
  <svg className="w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const AlertCircle = () => (
  <svg className="w-3.5 h-3.5 mr-1.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ── Result Row ────────────────────────────────────────────────────────────────
function ResultRow({ r, index }: { r: OptimizedResult; index: number }) {
  const hasError    = Boolean(r.error);
  const wasResolved = Boolean(r.originalCode && r.originalCode !== r.mpn);
  const ds          = distStyle(r.distributor);

  return (
    <tr className="results-table-row" style={{ animationDelay: `${index * 30}ms` }}>

      {/* MPN */}
      <td className="py-3.5 px-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium text-slate-100">{r.mpn}</span>
          {wasResolved && (
            <span className="text-[10px] font-medium"
              style={{ color: "rgba(167,139,250,0.8)" }}>
              ↑ {r.originalCode}
            </span>
          )}
        </div>
      </td>

      {/* Description */}
      <td className="py-3.5 px-4 hidden lg:table-cell max-w-[200px]">
        <span className="text-xs truncate block" style={{ color: "var(--text-3)" }}>
          {r.description || "—"}
        </span>
      </td>

      {/* Requested */}
      <td className="py-3.5 px-4 text-right">
        <span className="text-sm tabular-nums" style={{ color: "var(--text-2)" }}>
          {r.requestedQty.toLocaleString()}
        </span>
      </td>

      {/* Buy qty */}
      <td className="py-3.5 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className={`text-sm font-medium tabular-nums ${r.rounded ? "text-amber-400" : "text-slate-200"}`}>
            {r.optimalQty.toLocaleString()}
          </span>
          {r.rounded && (
            <span className="tag text-[9px] font-semibold"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
              ADJ
            </span>
          )}
        </div>
      </td>

      {/* Unit price */}
      <td className="py-3.5 px-4 text-right hidden sm:table-cell">
        <span className="text-sm tabular-nums" style={{ color: "var(--text-2)" }}>
          {hasError ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
        </span>
      </td>

      {/* Total */}
      <td className="py-3.5 px-4 text-right">
        <span className="text-sm font-semibold tabular-nums text-slate-100">
          {hasError ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
        </span>
      </td>

      {/* Best deal / error */}
      <td className="py-3.5 px-4 text-right">
        {hasError ? (
          <span className="inline-flex items-center text-xs text-red-400">
            <AlertCircle /> Not found
          </span>
        ) : (
          <a
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center tag text-xs font-semibold
                       hover:opacity-80 transition-opacity"
            style={{ background: ds.bg, color: ds.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
              style={{ background: ds.dot }} />
            {r.distributor}
            <ExternalLink />
          </a>
        )}
      </td>
    </tr>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-sky-400" : "text-slate-100"}`}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>{sub}</p>
      )}
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

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <div className="relative">
          <div className="w-12 h-12 rounded-full"
            style={{ background: "var(--brand-dim)" }} />
          <div className="absolute inset-0 spinner" style={{ width: 48, height: 48 }} />
        </div>
        <div className="text-center">
          <p className="text-slate-300 font-medium mb-1">Searching distributors</p>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            Checking Mouser, Digi-Key and Farnell…
          </p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (apiError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="card px-8 py-6 text-center max-w-sm">
          <p className="text-red-400 font-medium mb-4">{apiError}</p>
          <button className="btn-primary" onClick={() => router.push("/")}>
            ← Back to search
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const found    = data.results.filter(r => !r.error);
  const notFound = data.results.filter(r => r.error);
  const resolved = data.results.filter(r => r.originalCode && r.originalCode !== r.mpn);

  // Distributor breakdown
  const distCount = found.reduce((acc, r) => {
    acc[r.distributor] = (acc[r.distributor] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--border)",
          background:  "rgba(17,17,19,0.85)",
        }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button className="btn-ghost" onClick={() => router.push("/")}>
              <ArrowLeft /> New search
            </button>
            <div className="hidden sm:block w-px h-4"
              style={{ background: "var(--border)" }} />
            <span className="hidden sm:block text-sm font-bold">
              ic<span className="text-sky-400">paste</span>
            </span>
          </div>

          {/* Distributor breakdown pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(distCount).map(([dist, count]) => {
              const ds = distStyle(dist);
              return (
                <span key={dist}
                  className="tag text-xs font-medium"
                  style={{ background: ds.bg, color: ds.text }}>
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5"
                    style={{ background: ds.dot }} />
                  {dist} · {count}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 fade-up">
          <StatCard
            label="BOM Total"
            value={`${data.currency} ${data.totalBom.toFixed(2)}`}
            sub="estimated cost"
            accent
          />
          <StatCard
            label="Components"
            value={`${found.length} / ${data.results.length}`}
            sub="found with stock"
          />
          {resolved.length > 0 && (
            <StatCard
              label="Auto-resolved"
              value={`${resolved.length}`}
              sub="distributor codes → MPN"
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

        {/* ── Auto-resolve notice ── */}
        {resolved.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm fade-up"
            style={{
              background:   "rgba(167,139,250,0.08)",
              border:       "1px solid rgba(167,139,250,0.2)",
              color:        "rgba(196,181,253,0.9)",
            }}>
            <span className="font-semibold">✦ Auto-resolved {resolved.length} distributor code{resolved.length > 1 ? "s" : ""}</span>
            {" "}— order codes were automatically converted to manufacturer part numbers.
          </div>
        )}

        {/* ── Results table ── */}
        <div className="card overflow-hidden fade-up">
          <div className="overflow-x-auto">
            <table className="w-full results-table">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-3)" }}>MPN</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-widest hidden lg:table-cell"
                    style={{ color: "var(--text-3)" }}>Description</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-3)" }}>Req.</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-3)" }}>Buy Qty</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-widest hidden sm:table-cell"
                    style={{ color: "var(--text-3)" }}>Unit Price</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-3)" }}>Total</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-3)" }}>Best Deal</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r, i) => (
                  <ResultRow key={r.originalCode ?? r.mpn} r={r} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap items-center gap-5 mt-4 text-xs"
          style={{ color: "var(--text-3)" }}>
          <span className="flex items-center gap-1.5">
            <span className="tag text-[9px] font-semibold"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>ADJ</span>
            Qty rounded to nearest package unit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Distributor code auto-resolved
          </span>
          <span>Prices are indicative — verify on distributor site before ordering</span>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 pt-6 border-t flex items-center justify-between text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
          <span>© {new Date().getFullYear()} icpaste.com</span>
          <span>Built for hardware buyers</span>
        </footer>
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}

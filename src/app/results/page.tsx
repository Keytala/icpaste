"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, OptimizedResult } from "@/lib/types";

// ── Distributor styles ────────────────────────────────────────────────────────
const DIST_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Mouser":          { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  "Mouser (Mock)":   { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  "Digi-Key":        { bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  "Digi-Key (Mock)": { bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  "Farnell":         { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  "Farnell (Mock)":  { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
};

function ds(name: string) {
  return DIST_STYLE[name] ?? { bg: "#f9fafb", text: "#374151", border: "#e5e7eb", dot: "#9ca3af" };
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ArrowLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ExternalLink = () => (
  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border px-5 py-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-sky-500" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Result Row ────────────────────────────────────────────────────────────────
function ResultRow({ r }: { r: OptimizedResult }) {
  const hasError    = Boolean(r.error);
  const wasResolved = Boolean(r.originalCode && r.originalCode !== r.mpn);
  const style       = ds(r.distributor);

  return (
    <tr className="border-b transition-colors duration-100 hover:bg-gray-50"
      style={{ borderColor: "var(--border)" }}>

      {/* MPN */}
      <td className="py-3.5 px-5">
        <div>
          <span className="font-mono text-sm font-medium text-gray-900">{r.mpn}</span>
          {wasResolved && (
            <div className="mt-0.5">
              <span className="text-[10px] font-medium text-violet-500 bg-violet-50
                               border border-violet-200 px-1.5 py-0.5 rounded-full">
                ↑ {r.originalCode}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Description */}
      <td className="py-3.5 px-5 hidden lg:table-cell max-w-[220px]">
        <span className="text-xs text-gray-400 truncate block">{r.description || "—"}</span>
      </td>

      {/* Requested */}
      <td className="py-3.5 px-5 text-right">
        <span className="text-sm tabular-nums text-gray-500">
          {r.requestedQty.toLocaleString()}
        </span>
      </td>

      {/* Buy qty */}
      <td className="py-3.5 px-5 text-right">
        <div className="inline-flex items-center gap-1.5 justify-end">
          <span className={`text-sm font-semibold tabular-nums
            ${r.rounded ? "text-amber-600" : "text-gray-900"}`}>
            {r.optimalQty.toLocaleString()}
          </span>
          {r.rounded && (
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50
                             border border-amber-200 px-1.5 py-0.5 rounded-full">
              ADJ
            </span>
          )}
        </div>
      </td>

      {/* Unit price */}
      <td className="py-3.5 px-5 text-right hidden sm:table-cell">
        <span className="text-sm tabular-nums text-gray-500">
          {hasError ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
        </span>
      </td>

      {/* Total */}
      <td className="py-3.5 px-5 text-right">
        <span className="text-sm font-bold tabular-nums text-gray-900">
          {hasError ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
        </span>
      </td>

      {/* Best deal */}
      <td className="py-3.5 px-5 text-right">
        {hasError ? (
          <span className="text-xs text-red-500 bg-red-50 border border-red-200
                           px-2.5 py-1 rounded-full font-medium">
            Not found
          </span>
        ) : (
          <a
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-semibold
                       px-3 py-1.5 rounded-full border
                       hover:opacity-80 transition-opacity"
            style={{ background: style.bg, color: style.text, borderColor: style.border }}
          >
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
              style={{ background: style.dot }} />
            {r.distributor}
            <ExternalLink />
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

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ background: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-4">
          {/* Animated dots */}
          <div className="flex items-center gap-2">
            {["Mouser", "Digi-Key", "Farnell"].map((d, i) => (
              <div key={d} className="flex items-center gap-1.5 text-xs font-medium
                                      text-gray-400 bg-gray-50 border border-gray-200
                                      px-3 py-1.5 rounded-full"
                style={{ animationDelay: `${i * 150}ms` }}>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300
                                 animate-pulse" />
                {d}
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-sm">Searching distributors…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (apiError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "var(--bg)" }}>
        <div className="rounded-2xl border px-8 py-6 text-center max-w-sm"
          style={{ borderColor: "var(--border)" }}>
          <p className="text-red-500 font-medium mb-4">{apiError}</p>
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

  const distCount = found.reduce((acc, r) => {
    acc[r.distributor] = (acc[r.distributor] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-md"
        style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={() => router.push("/")}>
              <ArrowLeft /> New search
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <span className="text-sm font-bold text-gray-900">
              ic<span className="text-sky-500">paste</span>
            </span>
          </div>

          {/* Distributor breakdown */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(distCount).map(([dist, count]) => {
              const s = ds(dist);
              return (
                <span key={dist}
                  className="inline-flex items-center text-xs font-medium
                             px-2.5 py-1 rounded-full border"
                  style={{ background: s.bg, color: s.text, borderColor: s.border }}>
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5"
                    style={{ background: s.dot }} />
                  {dist} · {count}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-5 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 fade-up">
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

        {/* Auto-resolve notice */}
        {resolved.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm border fade-up"
            style={{
              background:   "#faf5ff",
              borderColor:  "#e9d5ff",
              color:        "#7c3aed",
            }}>
            <span className="font-semibold">
              Auto-resolved {resolved.length} distributor code{resolved.length > 1 ? "s" : ""}
            </span>
            {" "}— order codes were automatically converted to manufacturer part numbers.
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden fade-up"
          style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  {[
                    { label: "MPN",         align: "left",   hide: "" },
                    { label: "Description", align: "left",   hide: "hidden lg:table-cell" },
                    { label: "Requested",   align: "right",  hide: "" },
                    { label: "Buy Qty",     align: "right",  hide: "" },
                    { label: "Unit Price",  align: "right",  hide: "hidden sm:table-cell" },
                    { label: "Total",       align: "right",  hide: "" },
                    { label: "Best Deal",   align: "right",  hide: "" },
                  ].map(h => (
                    <th key={h.label}
                      className={`py-3 px-5 text-xs font-semibold uppercase tracking-widest
                                  text-gray-400 ${h.hide}
                                  ${h.align === "right" ? "text-right" : "text-left"}`}>
                      {h.label}
                    </th>
                  ))}
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
        <div className="flex flex-wrap items-center gap-5 mt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50
                             border border-amber-200 px-1.5 py-0.5 rounded-full">ADJ</span>
            Qty rounded to nearest package unit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Distributor code auto-resolved to MPN
          </span>
          <span>Prices are indicative — verify on distributor site before ordering</span>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t py-5 px-6" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} icpaste.com</span>
          <span className="text-xs text-gray-400">Built for hardware buyers</span>
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

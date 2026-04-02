"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter }    from "next/navigation";
import { SearchResponse, OptimizedResult } from "@/lib/types";

const IconExternal = () => (
  <svg className="inline w-3.5 h-3.5 ml-1 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const IconBack = () => (
  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const IconInfo = () => (
  <svg className="inline w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
  </svg>
);

const DIST_COLORS: Record<string, string> = {
  "Mouser":   "bg-blue-900/50 text-blue-300",
  "Digi-Key": "bg-yellow-900/50 text-yellow-300",
  "Farnell":  "bg-green-900/50 text-green-300",
};

function distColor(name: string) {
  return DIST_COLORS[name] ?? "bg-gray-800 text-gray-300";
}

// ── Distributor badge label (maps detectedAs to readable name) ────────────────
const DIST_LABELS: Record<string, string> = {
  mouser:  "Mouser code",
  digikey: "Digi-Key code",
  farnell: "Farnell code",
  rs:      "RS code",
};

function ResultRow({ r }: { r: OptimizedResult }) {
  const hasError   = Boolean(r.error);
  const wasResolved = Boolean(r.originalCode && r.originalCode !== r.mpn);

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/60 transition-colors">

      {/* MPN + resolution badge */}
      <td className="py-3 px-4 whitespace-nowrap">
        <span className="font-mono text-sm text-gray-100">{r.mpn}</span>
        {wasResolved && (
          <div className="mt-0.5 flex items-center gap-1">
            <span className="tag-rounded bg-purple-900/40 text-purple-300 text-[10px]">
              ↑ from {r.originalCode}
            </span>
            {r.resolvedNote && (
              <span title={r.resolvedNote} className="cursor-help">
                <IconInfo />
              </span>
            )}
          </div>
        )}
      </td>

      {/* Description */}
      <td className="py-3 px-4 text-sm text-gray-400 max-w-xs truncate hidden md:table-cell">
        {r.description || "—"}
      </td>

      {/* Requested qty */}
      <td className="py-3 px-4 text-sm text-gray-300 text-right whitespace-nowrap">
        {r.requestedQty.toLocaleString()}
      </td>

      {/* Optimal qty */}
      <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
        <span className={r.rounded ? "text-amber-400" : "text-gray-300"}>
          {r.optimalQty.toLocaleString()}
        </span>
        {r.rounded && (
          <span className="ml-1.5 tag-rounded bg-amber-900/40 text-amber-400 text-[10px]">
            adjusted
          </span>
        )}
      </td>

      {/* Unit price */}
      <td className="py-3 px-4 text-sm text-right whitespace-nowrap text-gray-300">
        {hasError ? "—" : `${r.currency} ${r.unitPrice.toFixed(4)}`}
      </td>

      {/* Total */}
      <td className="py-3 px-4 text-sm text-right whitespace-nowrap font-semibold text-gray-100">
        {hasError ? "—" : `${r.currency} ${r.totalPrice.toFixed(2)}`}
      </td>

      {/* Distributor + Link */}
      <td className="py-3 px-4 text-right whitespace-nowrap">
        {hasError ? (
          <span className="text-xs text-red-400">{r.error}</span>
        ) : (
          <a
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center tag-rounded font-medium text-xs
                        ${distColor(r.distributor)}
                        hover:opacity-80 transition-opacity cursor-pointer px-3 py-1`}
          >
            {r.distributor}
            <IconExternal />
          </a>
        )}
      </td>
    </tr>
  );
}

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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Searching distributors…</p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{apiError}</p>
        <button className="btn-primary" onClick={() => router.push("/")}>← Back</button>
      </div>
    );
  }

  if (!data) return null;

  const resolved = data.results.filter(r => r.originalCode && r.originalCode !== r.mpn);
  const notFound = data.results.filter(r => r.error);
  const found    = data.results.filter(r => !r.error);

  return (
    <main className="min-h-screen px-4 py-10 max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
          >
            <IconBack /> New search
          </button>
          <h1 className="text-2xl font-bold">
            ic<span className="text-sky-400">paste</span>
            <span className="text-gray-500 text-lg">.com</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {data.results.length} component{data.results.length !== 1 ? "s" : ""} searched
            &nbsp;·&nbsp;
            {new Date(data.searchedAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="card px-6 py-4 text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estimated BOM Total</p>
          <p className="text-3xl font-bold text-sky-400">
            {data.currency} {data.totalBom.toFixed(2)}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {found.length} found
            {resolved.length > 0 && ` · ${resolved.length} auto-resolved`}
            {notFound.length > 0 && ` · ${notFound.length} not found`}
          </p>
        </div>
      </div>

      {/* Auto-resolution notice */}
      {resolved.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-purple-900/20 border border-purple-800/40 text-sm text-purple-300">
          <span className="font-semibold">Auto-resolved {resolved.length} distributor code{resolved.length > 1 ? "s" : ""}:</span>
          {" "}distributor order codes were automatically converted to manufacturer part numbers.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800">
              {["MPN", "Description", "Requested", "Buy Qty", "Unit Price", "Total", "Best Deal"].map(h => (
                <th key={h}
                  className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500
                    ${["Requested", "Buy Qty", "Unit Price", "Total", "Best Deal"].includes(h) ? "text-right" : ""}
                    ${"Description" === h ? "hidden md:table-cell" : ""}`}>
                  {h}
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

      <div className="flex flex-wrap items-center gap-6 mt-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Qty adjusted to nearest package unit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
          Distributor code auto-resolved to MPN
        </span>
        <span>Prices are indicative — confirm on distributor site</span>
      </div>

      <footer className="mt-16 text-xs text-gray-700 text-center">
        © {new Date().getFullYear()} icpaste.com — Built for hardware buyers
      </footer>
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

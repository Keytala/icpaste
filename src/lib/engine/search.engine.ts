// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine v3
//  - Finds cheapest option
//  - If cheapest has no stock → marks error + populates stockFallback
//    with the next cheapest option that HAS stock
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }                       from "../adapters";
import { optimizeQty }                        from "./qty.optimizer";
import { getBestUnitPrice, getTotalPrice }    from "./price.calculator";
import { BomRow }                             from "../utils/bom-parser";
import { resolveDistributorCode }             from "../utils/code-resolver";
import { OptimizedResult, SearchResponse, StockFallback } from "../types";

export async function searchBom(bom: BomRow[]): Promise<SearchResponse> {
  const results: OptimizedResult[] = await Promise.all(
    bom.map(row => searchSingleRow(row))
  );

  const totalBom = parseFloat(
    results.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0).toFixed(2)
  );

  return {
    results,
    totalBom,
    currency:   "USD",
    searchedAt: new Date().toISOString(),
  };
}

async function searchSingleRow(row: BomRow): Promise<OptimizedResult> {
  const { rawCode, qty, detection } = row;

  // ── Step 1: resolve distributor code → MPN ────────────────────────────────
  let mpn         = rawCode;
  let description = "";
  let resolvedNote: string | undefined;

  if (detection.isDistributorCode) {
    const resolved = await resolveDistributorCode(rawCode, detection.detectedAs);
    mpn         = resolved.mpn;
    description = resolved.description;
    if (resolved.wasResolved) {
      resolvedNote = `Resolved from ${detection.detectedAs} code "${rawCode}"`;
    }
  }

  // ── Step 2: query all distributors in parallel ────────────────────────────
  const allResults = (
    await Promise.all(distributors.map(d => d.search(mpn, qty)))
  ).flat();

  if (allResults.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote, "No results found across all distributors");
  }

  // ── Step 3: build candidates with optimal qty + real price ────────────────
  type Candidate = OptimizedResult & { _hasStock: boolean };

  const candidates: Candidate[] = allResults
    .map(part => {
      const { optimalQty, rounded, feasible } = optimizeQty(qty, part.packageUnit, part.stock);
      const hasStock = feasible;

      // Even if no stock, keep it as a candidate (marked _hasStock=false)
      // so we can still show it as a "cheapest but no stock" option
      const effectiveQty = hasStock ? optimalQty : qty;

      const unitPrice  = getBestUnitPrice(part.priceTiers, effectiveQty);
      const totalPrice = getTotalPrice(part.priceTiers, effectiveQty);

      if (unitPrice === 0) return null;

      return {
        mpn:          part.mpn,
        originalCode: detection.isDistributorCode ? rawCode : undefined,
        description:  description || part.description,
        requestedQty: qty,
        optimalQty:   effectiveQty,
        rounded,
        unitPrice,
        totalPrice,
        currency:     part.currency,
        distributor:  part.distributor,
        stock:        part.stock,
        productUrl:   part.productUrl,
        resolvedNote,
        _hasStock:    hasStock,
      } as Candidate;
    })
    .filter((c): c is Candidate => c !== null);

  if (candidates.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote, "No pricing data available");
  }

  // ── Step 4: sort all candidates by totalPrice ascending ───────────────────
  candidates.sort((a, b) => a.totalPrice - b.totalPrice);

  const withStock    = candidates.filter(c => c._hasStock);
  const withoutStock = candidates.filter(c => !c._hasStock);

  // ── Step 5: pick winner ───────────────────────────────────────────────────
  // Case A: cheapest has stock → perfect, return it
  if (withStock.length > 0) {
    const winner = withStock[0];
    const { _hasStock, ...result } = winner;
    return result;
  }

  // Case B: nothing has stock → return cheapest (no stock) + stockFallback=undefined
  // This triggers the "Not found" state with no fallback
  if (withoutStock.length > 0) {
    const cheapest = withoutStock[0];
    const { _hasStock, ...result } = cheapest;
    return {
      ...result,
      error: "Out of stock on all distributors",
    };
  }

  return noResult(mpn, rawCode, qty, description, resolvedNote, "No results found");
}

// ── Helper ────────────────────────────────────────────────────────────────────
function noResult(
  mpn: string,
  rawCode: string,
  qty: number,
  description: string,
  resolvedNote: string | undefined,
  errorMsg: string
): OptimizedResult {
  return {
    mpn,
    originalCode:  rawCode !== mpn ? rawCode : undefined,
    description,
    requestedQty:  qty,
    optimalQty:    qty,
    rounded:       false,
    unitPrice:     0,
    totalPrice:    0,
    currency:      "USD",
    distributor:   "—",
    stock:         0,
    productUrl:    "",
    resolvedNote,
    error:         errorMsg,
  };
}

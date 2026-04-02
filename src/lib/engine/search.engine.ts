// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine v2
//  Handles both MPN and distributor order codes transparently.
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }                        from "../adapters";
import { optimizeQty }                         from "./qty.optimizer";
import { getBestUnitPrice, getTotalPrice }     from "./price.calculator";
import { BomRow }                              from "../utils/bom-parser";
import { resolveDistributorCode }              from "../utils/code-resolver";
import { OptimizedResult, SearchResponse }     from "../types";

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

  // ── Step 1: resolve distributor code → MPN if needed ─────────────────────
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
    // If resolution failed, mpn === rawCode → adapters will try a keyword search
  }

  // ── Step 2: query all distributors in parallel ────────────────────────────
  const allResults = (
    await Promise.all(distributors.map(d => d.search(mpn, qty)))
  ).flat();

  if (allResults.length === 0) {
    return {
      mpn,
      originalCode:  detection.isDistributorCode ? rawCode : undefined,
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
      error:         "No results found across all distributors",
    };
  }

  // ── Step 3: compute optimal qty and real price for each candidate ─────────
  const candidates = allResults
    .map(part => {
      const { optimalQty, rounded, feasible } = optimizeQty(qty, part.packageUnit, part.stock);
      if (!feasible) return null;

      return {
        mpn:           part.mpn,
        originalCode:  detection.isDistributorCode ? rawCode : undefined,
        description:   description || part.description,
        requestedQty:  qty,
        optimalQty,
        rounded,
        unitPrice:     getBestUnitPrice(part.priceTiers, optimalQty),
        totalPrice:    getTotalPrice(part.priceTiers, optimalQty),
        currency:      part.currency,
        distributor:   part.distributor,
        stock:         part.stock,
        productUrl:    part.productUrl,
        resolvedNote,
      } as OptimizedResult;
    })
    .filter((c): c is OptimizedResult => c !== null);

  if (candidates.length === 0) {
    const fallback = allResults.sort((a, b) => b.stock - a.stock)[0];
    return {
      mpn,
      originalCode:  detection.isDistributorCode ? rawCode : undefined,
      description:   description || fallback.description,
      requestedQty:  qty,
      optimalQty:    qty,
      rounded:       false,
      unitPrice:     getBestUnitPrice(fallback.priceTiers, qty),
      totalPrice:    getTotalPrice(fallback.priceTiers, qty),
      currency:      fallback.currency,
      distributor:   fallback.distributor,
      stock:         fallback.stock,
      productUrl:    fallback.productUrl,
      resolvedNote,
      error:         "Insufficient stock — showing best available",
    };
  }

  candidates.sort((a, b) => a.totalPrice - b.totalPrice);
  return candidates[0];
}

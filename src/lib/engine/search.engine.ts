// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine (Core)
//  Orchestrates all adapters, optimizes qty, picks the best deal.
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }          from "../adapters";
import { optimizeQty }           from "./qty.optimizer";
import { getBestUnitPrice, getTotalPrice } from "./price.calculator";
import { BomRow, OptimizedResult, SearchResponse } from "../types";

export async function searchBom(bom: BomRow[]): Promise<SearchResponse> {
  const results: OptimizedResult[] = await Promise.all(
    bom.map(row => searchSingleMpn(row.mpn, row.qty))
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

async function searchSingleMpn(mpn: string, requestedQty: number): Promise<OptimizedResult> {
  // Query all distributors in parallel
  const allResults = (
    await Promise.all(distributors.map(d => d.search(mpn, requestedQty)))
  ).flat();

  if (allResults.length === 0) {
    return {
      mpn,
      description:  "",
      requestedQty,
      optimalQty:   requestedQty,
      rounded:      false,
      unitPrice:    0,
      totalPrice:   0,
      currency:     "USD",
      distributor:  "—",
      stock:        0,
      productUrl:   "",
      error:        "No results found across all distributors",
    };
  }

  // For each result, compute optimal qty and real total price
  const candidates = allResults
    .map(part => {
      const { optimalQty, rounded, feasible } = optimizeQty(
        requestedQty,
        part.packageUnit,
        part.stock
      );

      if (!feasible) return null; // skip if not enough stock

      const unitPrice  = getBestUnitPrice(part.priceTiers, optimalQty);
      const totalPrice = getTotalPrice(part.priceTiers, optimalQty);

      return {
        mpn:          part.mpn,
        description:  part.description,
        requestedQty,
        optimalQty,
        rounded,
        unitPrice,
        totalPrice,
        currency:     part.currency,
        distributor:  part.distributor,
        stock:        part.stock,
        productUrl:   part.productUrl,
      } as OptimizedResult;
    })
    .filter((c): c is OptimizedResult => c !== null);

  if (candidates.length === 0) {
    // All distributors have insufficient stock — return best available anyway
    const fallback = allResults.sort((a, b) => b.stock - a.stock)[0];
    return {
      mpn,
      description:  fallback.description,
      requestedQty,
      optimalQty:   requestedQty,
      rounded:      false,
      unitPrice:    getBestUnitPrice(fallback.priceTiers, requestedQty),
      totalPrice:   getTotalPrice(fallback.priceTiers, requestedQty),
      currency:     fallback.currency,
      distributor:  fallback.distributor,
      stock:        fallback.stock,
      productUrl:   fallback.productUrl,
      error:        "Insufficient stock — showing best available",
    };
  }

  // Sort by totalPrice ascending → pick the winner
  candidates.sort((a, b) => a.totalPrice - b.totalPrice);
  return candidates[0];
}

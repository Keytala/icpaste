// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine v4
//
//  Logic:
//  1. Find ALL candidates (with and without stock)
//  2. Sort by price ascending
//  3. If cheapest has stock → winner, done
//  4. If cheapest has NO stock:
//     → show it as winner (with error "out of stock")
//     → populate stockFallback with cheapest candidate THAT HAS stock
//     → UI shows "Resolve" button to swap to fallback instantly
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }                       from "../adapters";
import { optimizeQty }                        from "./qty.optimizer";
import { getBestUnitPrice, getTotalPrice }    from "./price.calculator";
import { BomRow }                             from "../utils/bom-parser";
import { resolveDistributorCode }             from "../utils/code-resolver";
import {
  OptimizedResult,
  SearchResponse,
  StockFallback,
  PartResult,
} from "../types";

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

  // ── Resolve distributor code → MPN ───────────────────────────────────────
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

  // ── Query all distributors ────────────────────────────────────────────────
  const allResults = (
    await Promise.all(distributors.map(d => d.search(mpn, qty)))
  ).flat();

  if (allResults.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote,
      "No results found across all distributors");
  }

  // ── Build scored candidates ───────────────────────────────────────────────
  interface Candidate {
    result:    OptimizedResult;
    hasStock:  boolean;
    totalPrice: number;
  }

  const candidates: Candidate[] = allResults
    .map((part: PartResult) => {
      const { optimalQty, rounded, feasible } = optimizeQty(
        qty, part.packageUnit, part.stock
      );

      // Use requested qty for pricing if no stock (for comparison purposes)
      const effectiveQty = feasible ? optimalQty : qty;
      const unitPrice    = getBestUnitPrice(part.priceTiers, effectiveQty);
      const totalPrice   = getTotalPrice(part.priceTiers, effectiveQty);

      if (unitPrice === 0) return null;

      const result: OptimizedResult = {
        mpn:          part.mpn,
        originalCode: detection.isDistributorCode ? rawCode : undefined,
        description:  description || part.description,
        requestedQty: qty,
        optimalQty:   effectiveQty,
        rounded:      feasible ? rounded : false,
        unitPrice,
        totalPrice,
        currency:     part.currency,
        distributor:  part.distributor,
        stock:        part.stock,
        productUrl:   part.productUrl,
        resolvedNote,
      };

      return { result, hasStock: feasible, totalPrice };
    })
    .filter((c): c is Candidate => c !== null);

  if (candidates.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote,
      "No pricing data available");
  }

  // ── Sort by price ─────────────────────────────────────────────────────────
  candidates.sort((a, b) => a.totalPrice - b.totalPrice);

  const withStock    = candidates.filter(c => c.hasStock);
  const withoutStock = candidates.filter(c => !c.hasStock);

  // ── Case A: cheapest has stock → perfect ─────────────────────────────────
  if (withStock.length > 0) {
    return withStock[0].result;
  }

  // ── Case B: nothing has enough stock ─────────────────────────────────────
  // Show cheapest (no stock) as the main result
  // Populate stockFallback with cheapest option that has ANY stock
  const cheapest = withoutStock[0].result;

  // Find fallback: best price among those with partial stock
  const partialStock = allResults
    .filter(p => p.stock > 0)
    .map(part => {
      const { optimalQty, rounded } = optimizeQty(qty, part.packageUnit, part.stock);
      // Use whatever stock is available (even if less than requested)
      const effectiveQty = Math.min(optimalQty, part.stock);
      const unitPrice    = getBestUnitPrice(part.priceTiers, effectiveQty);
      const totalPrice   = getTotalPrice(part.priceTiers, effectiveQty);
      if (unitPrice === 0) return null;
      return { part, effectiveQty, rounded, unitPrice, totalPrice };
    })
    .filter(Boolean)
    .sort((a, b) => a!.totalPrice - b!.totalPrice);

  let stockFallback: StockFallback | undefined;

  if (partialStock.length > 0) {
    const fb = partialStock[0]!;
    stockFallback = {
      distributor: fb.part.distributor,
      optimalQty:  fb.effectiveQty,
      rounded:     fb.rounded,
      unitPrice:   fb.unitPrice,
      totalPrice:  fb.totalPrice,
      currency:    fb.part.currency,
      stock:       fb.part.stock,
      productUrl:  fb.part.productUrl,
    };
  }

  return {
    ...cheapest,
    error:         "Out of stock",
    stockFallback,
  };
}

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

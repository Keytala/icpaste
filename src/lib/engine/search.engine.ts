// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine v6
//  Usa smartOptimizeQty per trovare la combinazione qty+prezzo ottimale
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }          from "../adapters";
import { smartOptimizeQty }      from "./qty.optimizer";
import { BomRow }                from "../utils/bom-parser";
import { resolveDistributorCode } from "../utils/code-resolver";
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

  // ── Query all distributors in parallel ────────────────────────────────────
  const allResults = (
    await Promise.all(distributors.map(d => d.search(mpn, qty)))
  ).flat();

  if (allResults.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote,
      "No results found across all distributors");
  }

  // ── Per ogni risultato applica smartOptimizeQty ───────────────────────────
  interface ScoredResult {
    part:        PartResult;
    optimalQty:  number;
    unitPrice:   number;
    totalPrice:  number;
    feasible:    boolean;
    adjustment:  import("../types").AdjustmentType;
    savedVsOriginal: number;
  }

  const scored: ScoredResult[] = allResults
    .map(part => {
      const opt = smartOptimizeQty(
        qty,
        part.packageUnit,
        part.stock,
        part.priceTiers
      );
      if (opt.unitPrice === 0) return null;
      return { part, ...opt };
    })
    .filter((c): c is ScoredResult => c !== null);

  if (scored.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote,
      "No pricing data available");
  }

  // ── Separa con stock vs senza stock ──────────────────────────────────────
  const withStock    = scored.filter(c => c.feasible);
  const withoutStock = scored.filter(c => !c.feasible);

  // ── Case A: almeno un distributore ha stock → più economico ──────────────
  if (withStock.length > 0) {
    withStock.sort((a, b) => a.totalPrice - b.totalPrice);
    const w = withStock[0];
    return {
      mpn:             w.part.mpn,
      originalCode:    detection.isDistributorCode ? rawCode : undefined,
      description:     description || w.part.description,
      requestedQty:    qty,
      optimalQty:      w.optimalQty,
      rounded:         w.adjustment !== "none",
      adjustment:      w.adjustment,
      savedVsOriginal: w.savedVsOriginal,
      unitPrice:       w.unitPrice,
      totalPrice:      w.totalPrice,
      currency:        w.part.currency,
      distributor:     w.part.distributor,
      stock:           w.part.stock,
      productUrl:      w.part.productUrl,
      resolvedNote,
    };
  }

  // ── Case B: nessuno ha stock → mostra il più economico + fallback ─────────
  withoutStock.sort((a, b) => a.totalPrice - b.totalPrice);
  const cheapest = withoutStock[0];

  // Cerca fallback tra chi ha stock parziale
  const partialStock = allResults
    .filter(p => p.stock > 0)
    .map(part => {
      const opt = smartOptimizeQty(
        Math.min(qty, part.stock),
        part.packageUnit,
        part.stock,
        part.priceTiers
      );
      if (opt.unitPrice === 0) return null;
      return { part, ...opt };
    })
    .filter((c): c is ScoredResult => c !== null)
    .sort((a, b) => a.totalPrice - b.totalPrice);

  let stockFallback: StockFallback | undefined;
  if (partialStock.length > 0) {
    const fb = partialStock[0];
    stockFallback = {
      distributor: fb.part.distributor,
      optimalQty:  fb.optimalQty,
      rounded:     fb.adjustment !== "none",
      unitPrice:   fb.unitPrice,
      totalPrice:  fb.totalPrice,
      currency:    fb.part.currency,
      stock:       fb.part.stock,
      productUrl:  fb.part.productUrl,
    };
  }

  return {
    mpn:             cheapest.part.mpn,
    originalCode:    detection.isDistributorCode ? rawCode : undefined,
    description:     description || cheapest.part.description,
    requestedQty:    qty,
    optimalQty:      cheapest.optimalQty,
    rounded:         cheapest.adjustment !== "none",
    adjustment:      cheapest.adjustment,
    savedVsOriginal: cheapest.savedVsOriginal,
    unitPrice:       cheapest.unitPrice,
    totalPrice:      cheapest.totalPrice,
    currency:        cheapest.part.currency,
    distributor:     cheapest.part.distributor,
    stock:           cheapest.part.stock,
    productUrl:      cheapest.part.productUrl,
    resolvedNote,
    error:           "Out of stock",
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
    originalCode:    rawCode !== mpn ? rawCode : undefined,
    description,
    requestedQty:    qty,
    optimalQty:      qty,
    rounded:         false,
    adjustment:      "none",
    savedVsOriginal: 0,
    unitPrice:       0,
    totalPrice:      0,
    currency:        "USD",
    distributor:     "—",
    stock:           0,
    productUrl:      "",
    resolvedNote,
    error:           errorMsg,
  };
}

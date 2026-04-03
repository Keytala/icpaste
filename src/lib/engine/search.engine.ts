// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine v6 (TypeScript fix)
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }           from "../adapters";
import { smartOptimizeQty }       from "./qty.optimizer";
import { BomRow }                 from "../utils/bom-parser";
import { resolveDistributorCode } from "../utils/code-resolver";
import {
  OptimizedResult,
  SearchResponse,
  StockFallback,
  PartResult,
  AdjustmentType,
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

// ── Tipo interno ──────────────────────────────────────────────────────────────
interface ScoredResult {
  part:            PartResult;
  optimalQty:      number;
  unitPrice:       number;
  totalPrice:      number;
  feasible:        boolean;
  adjustment:      AdjustmentType;
  packageRounded:  boolean;
  priceStepUsed:   boolean;
  savedVsOriginal: number;
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
  const scored: ScoredResult[] = allResults
    .map((part: PartResult): ScoredResult | null => {
      const opt = smartOptimizeQty(
        qty,
        part.packageUnit,
        part.stock,
        part.priceTiers
      );
      if (opt.unitPrice === 0) return null;
      return {
        part,
        optimalQty:      opt.optimalQty,
        unitPrice:       opt.unitPrice,
        totalPrice:      opt.totalPrice,
        feasible:        opt.feasible,
        adjustment:      opt.adjustment,
        packageRounded:  opt.packageRounded,
        priceStepUsed:   opt.priceStepUsed,
        savedVsOriginal: opt.savedVsOriginal,
      };
    })
    .filter((c): c is ScoredResult => c !== null); // ← type guard corretto

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
    return buildResult(w, qty, detection.isDistributorCode ? rawCode : undefined,
      description, resolvedNote);
  }

  // ── Case B: nessuno ha stock → mostra il più economico + fallback ─────────
  if (withoutStock.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote,
      "No pricing data available");
  }

  withoutStock.sort((a, b) => a.totalPrice - b.totalPrice);
  const cheapest = withoutStock[0];

  // Cerca fallback tra chi ha stock parziale
  const partialStock: ScoredResult[] = allResults
    .map((part: PartResult): ScoredResult | null => {
      if (part.stock <= 0) return null;
      const opt = smartOptimizeQty(
        Math.min(qty, part.stock),
        part.packageUnit,
        part.stock,
        part.priceTiers
      );
      if (opt.unitPrice === 0) return null;
      return {
        part,
        optimalQty:      opt.optimalQty,
        unitPrice:       opt.unitPrice,
        totalPrice:      opt.totalPrice,
        feasible:        opt.feasible,
        adjustment:      opt.adjustment,
        packageRounded:  opt.packageRounded,
        priceStepUsed:   opt.priceStepUsed,
        savedVsOriginal: opt.savedVsOriginal,
      };
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
    ...buildResult(cheapest, qty, detection.isDistributorCode ? rawCode : undefined,
      description, resolvedNote),
    error:         "Out of stock",
    stockFallback,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildResult(
  c:            ScoredResult,
  requestedQty: number,
  originalCode: string | undefined,
  description:  string,
  resolvedNote: string | undefined
): OptimizedResult {
  return {
    mpn:             c.part.mpn,
    originalCode,
    description:     description || c.part.description,
    requestedQty,
    optimalQty:      c.optimalQty,
    rounded:         c.adjustment !== "none",
    adjustment:      c.adjustment,
    savedVsOriginal: c.savedVsOriginal,
    unitPrice:       c.unitPrice,
    totalPrice:      c.totalPrice,
    currency:        c.part.currency,
    distributor:     c.part.distributor,
    stock:           c.part.stock,
    productUrl:      c.part.productUrl,
    resolvedNote,
  };
}

function noResult(
  mpn:          string,
  rawCode:      string,
  qty:          number,
  description:  string,
  resolvedNote: string | undefined,
  errorMsg:     string
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

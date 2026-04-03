// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Search Engine v5
//
//  BUG FIX: il prezzo mostrato era calcolato sulla qty richiesta anche per
//  i risultati senza stock. Ora:
//  - candidati CON stock  → prezzo calcolato su optimalQty reale
//  - candidati SENZA stock → esclusi dalla selezione principale
//  - ordinamento separato: prima filtra withStock, poi ordina per prezzo
// ─────────────────────────────────────────────────────────────────────────────

import { distributors }                    from "../adapters";
import { optimizeQty }                     from "./qty.optimizer";
import { getBestUnitPrice, getTotalPrice } from "./price.calculator";
import { BomRow }                          from "../utils/bom-parser";
import { resolveDistributorCode }          from "../utils/code-resolver";
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

  // ── Separa subito: con stock vs senza stock ───────────────────────────────
  // Il BUG era qui: prima si mescolavano tutti i candidati, si calcolava
  // il prezzo con qty sbagliata per quelli senza stock, poi si filtrava.
  // Ora si separano PRIMA e si calcola il prezzo corretto per ognuno.

  interface ScoredResult {
    result:     OptimizedResult;
    totalPrice: number;
  }

  const withStock:    ScoredResult[] = [];
  const withoutStock: ScoredResult[] = [];

  for (const part of allResults) {
    const { optimalQty, rounded, feasible } = optimizeQty(
      qty, part.packageUnit, part.stock
    );

    if (feasible) {
      // ── Ha stock sufficiente: calcola prezzo sulla optimalQty reale ──────
      const unitPrice  = getBestUnitPrice(part.priceTiers, optimalQty);
      const totalPrice = getTotalPrice(part.priceTiers, optimalQty);

      if (unitPrice === 0) continue;

      withStock.push({
        totalPrice,
        result: {
          mpn:          part.mpn,
          originalCode: detection.isDistributorCode ? rawCode : undefined,
          description:  description || part.description,
          requestedQty: qty,
          optimalQty,           // ← qty reale arrotondata al package unit
          rounded,
          unitPrice,            // ← prezzo corretto per optimalQty
          totalPrice,
          currency:     part.currency,
          distributor:  part.distributor,
          stock:        part.stock,
          productUrl:   part.productUrl,
          resolvedNote,
        },
      });

    } else {
      // ── Non ha stock sufficiente: calcola prezzo sulla qty richiesta ─────
      // (usato solo per il fallback, non mostrato come vincitore)
      const unitPrice  = getBestUnitPrice(part.priceTiers, qty);
      const totalPrice = getTotalPrice(part.priceTiers, qty);

      if (unitPrice === 0) continue;

      withoutStock.push({
        totalPrice,
        result: {
          mpn:          part.mpn,
          originalCode: detection.isDistributorCode ? rawCode : undefined,
          description:  description || part.description,
          requestedQty: qty,
          optimalQty:   qty,
          rounded:      false,
          unitPrice,
          totalPrice,
          currency:     part.currency,
          distributor:  part.distributor,
          stock:        part.stock,
          productUrl:   part.productUrl,
          resolvedNote,
        },
      });
    }
  }

  // ── Case A: almeno un distributore ha stock → prendi il più economico ────
  if (withStock.length > 0) {
    withStock.sort((a, b) => a.totalPrice - b.totalPrice);
    return withStock[0].result;
  }

  // ── Case B: nessuno ha stock sufficiente ─────────────────────────────────
  if (withoutStock.length === 0) {
    return noResult(mpn, rawCode, qty, description, resolvedNote,
      "No pricing data available");
  }

  // Mostra il più economico (senza stock) come risultato principale
  withoutStock.sort((a, b) => a.totalPrice - b.totalPrice);
  const cheapestNoStock = withoutStock[0].result;

  // ── Cerca il fallback: distributore con stock parziale al prezzo più basso
  const partialStockCandidates = allResults
    .filter(p => p.stock > 0)
    .map(part => {
      // Usa lo stock disponibile anche se minore della qty richiesta
      const availableQty = Math.min(
        Math.ceil(qty / (part.packageUnit || 1)) * (part.packageUnit || 1),
        part.stock
      );
      const unitPrice  = getBestUnitPrice(part.priceTiers, availableQty);
      const totalPrice = getTotalPrice(part.priceTiers, availableQty);
      if (unitPrice === 0) return null;
      const { rounded } = optimizeQty(qty, part.packageUnit, part.stock);
      return { part, availableQty, rounded, unitPrice, totalPrice };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.totalPrice - b.totalPrice);

  let stockFallback: StockFallback | undefined;

  if (partialStockCandidates.length > 0) {
    const fb = partialStockCandidates[0];
    stockFallback = {
      distributor: fb.part.distributor,
      optimalQty:  fb.availableQty,
      rounded:     fb.rounded,
      unitPrice:   fb.unitPrice,
      totalPrice:  fb.totalPrice,
      currency:    fb.part.currency,
      stock:       fb.part.stock,
      productUrl:  fb.part.productUrl,
    };
  }

  return {
    ...cheapestNoStock,
    error: "Out of stock",
    stockFallback,
  };
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

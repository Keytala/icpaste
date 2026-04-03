// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Smart Quantity Optimizer v2
//
//  Logica:
//  1. PACKAGE UNIT: arrotonda al multiplo di packageUnit più vicino
//  2. PRICE STEP:   se il prossimo scaglione di prezzo ha un totale
//                   inferiore o uguale, proponi quello scaglione
//  3. BEST DEAL:    confronta tutte le opzioni e restituisce quella
//                   con il costo totale più basso
//
//  Tipi di aggiustamento (per la UI):
//  - "none"       → nessun aggiustamento
//  - "package"    → arrotondato al package unit (reel, tray, ecc.)
//  - "pricestep"  → aumentato per raggiungere uno scaglione più economico
//  - "both"       → entrambi applicati
// ─────────────────────────────────────────────────────────────────────────────

import { PriceTier } from "../types";

export type AdjustmentType = "none" | "package" | "pricestep" | "both";

export interface OptimizationResult {
  optimalQty:     number;
  unitPrice:      number;
  totalPrice:     number;
  feasible:       boolean;   // stock >= optimalQty
  adjustment:     AdjustmentType;
  packageRounded: boolean;   // qty fu arrotondata al package unit
  priceStepUsed:  boolean;   // qty fu aumentata per uno scaglione migliore
  savedVsOriginal: number;   // risparmio in $ rispetto alla qty originale
}

/**
 * Calcola la quantità ottimale considerando:
 * - package unit (reel, tray, cut tape)
 * - price breaks (scaglioni di prezzo)
 * - stock disponibile
 */
export function smartOptimizeQty(
  requestedQty: number,
  packageUnit:  number,
  stock:        number,
  priceTiers:   PriceTier[]
): OptimizationResult {

  const unit = Math.max(packageUnit, 1);

  // ── Step 1: calcola qty base (arrotondata al package unit) ───────────────
  const packageQty = Math.ceil(requestedQty / unit) * unit;

  // ── Step 2: raccogli tutte le opzioni candidate ───────────────────────────
  // Opzione A: qty originale (senza arrotondamento)
  // Opzione B: qty arrotondata al package unit
  // Opzione C: ogni scaglione di prezzo superiore alla qty richiesta

  const candidates: {
    qty:            number;
    packageRounded: boolean;
    priceStepUsed:  boolean;
  }[] = [];

  // Opzione A: qty esatta richiesta (se è multiplo del package unit)
  if (requestedQty % unit === 0) {
    candidates.push({ qty: requestedQty, packageRounded: false, priceStepUsed: false });
  }

  // Opzione B: arrotondamento al package unit
  if (packageQty !== requestedQty) {
    candidates.push({ qty: packageQty, packageRounded: true, priceStepUsed: false });
  }

  // Opzione C: scaglioni di prezzo superiori alla qty richiesta
  // (consideriamo solo scaglioni che sono anche multipli del package unit)
  const sortedTiers = [...priceTiers].sort((a, b) => a.qty - b.qty);

  for (const tier of sortedTiers) {
    if (tier.qty <= requestedQty) continue; // scaglioni già coperti

    // Arrotonda lo scaglione al multiplo di packageUnit
    const tierQty = Math.ceil(tier.qty / unit) * unit;

    // Non aggiungere duplicati
    if (candidates.some(c => c.qty === tierQty)) continue;

    candidates.push({
      qty:            tierQty,
      packageRounded: tierQty !== tier.qty,
      priceStepUsed:  true,
    });
  }

  // Assicurati che la qty originale sia sempre tra i candidati
  if (!candidates.some(c => c.qty === requestedQty)) {
    candidates.push({ qty: requestedQty, packageRounded: false, priceStepUsed: false });
  }

  // ── Step 3: calcola prezzo totale per ogni candidato ─────────────────────
  interface ScoredCandidate {
    qty:            number;
    unitPrice:      number;
    totalPrice:     number;
    packageRounded: boolean;
    priceStepUsed:  boolean;
    feasible:       boolean;
  }

  const scored: ScoredCandidate[] = candidates
    .map(c => {
      const unitPrice  = getBestUnitPrice(sortedTiers, c.qty);
      const totalPrice = parseFloat((unitPrice * c.qty).toFixed(4));
      return {
        ...c,
        unitPrice,
        totalPrice,
        feasible: stock >= c.qty,
      };
    })
    .filter(c => c.unitPrice > 0);

  if (scored.length === 0) {
    // Fallback: usa qty richiesta senza ottimizzazione
    const unitPrice = getBestUnitPrice(sortedTiers, requestedQty);
    return {
      optimalQty:      requestedQty,
      unitPrice,
      totalPrice:      parseFloat((unitPrice * requestedQty).toFixed(4)),
      feasible:        stock >= requestedQty,
      adjustment:      "none",
      packageRounded:  false,
      priceStepUsed:   false,
      savedVsOriginal: 0,
    };
  }

  // ── Step 4: trova il candidato con il prezzo totale più basso ────────────
  // Priorità: candidati feasible (con stock) prima, poi per totalPrice
  const feasible   = scored.filter(c => c.feasible);
  const infeasible = scored.filter(c => !c.feasible);

  const pool = feasible.length > 0 ? feasible : infeasible;
  pool.sort((a, b) => a.totalPrice - b.totalPrice);

  const winner = pool[0];

  // ── Step 5: calcola il risparmio rispetto alla qty originale ─────────────
  const originalUnitPrice  = getBestUnitPrice(sortedTiers, requestedQty);
  const originalTotalPrice = parseFloat((originalUnitPrice * requestedQty).toFixed(4));
  const savedVsOriginal    = parseFloat((originalTotalPrice - winner.totalPrice).toFixed(4));

  // ── Step 6: determina il tipo di aggiustamento ───────────────────────────
  let adjustment: AdjustmentType = "none";
  if (winner.packageRounded && winner.priceStepUsed) adjustment = "both";
  else if (winner.packageRounded) adjustment = "package";
  else if (winner.priceStepUsed)  adjustment = "pricestep";

  return {
    optimalQty:      winner.qty,
    unitPrice:       winner.unitPrice,
    totalPrice:      winner.totalPrice,
    feasible:        winner.feasible,
    adjustment,
    packageRounded:  winner.packageRounded,
    priceStepUsed:   winner.priceStepUsed,
    savedVsOriginal,
  };
}

// ── Helper interno ────────────────────────────────────────────────────────────
function getBestUnitPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
  let best = sorted[0].price;
  for (const tier of sorted) {
    if (qty >= tier.qty) best = tier.price;
  }
  return best;
}

// ── Backward compat (usata da altri moduli) ───────────────────────────────────
export function optimizeQty(
  requestedQty: number,
  packageUnit:  number,
  stock:        number
): { optimalQty: number; rounded: boolean; feasible: boolean } {
  const unit       = Math.max(packageUnit, 1);
  const optimalQty = Math.ceil(requestedQty / unit) * unit;
  return {
    optimalQty,
    rounded:  optimalQty !== requestedQty,
    feasible: stock >= optimalQty,
  };
}

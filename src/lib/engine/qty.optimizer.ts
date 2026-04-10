import { PriceTier, AdjustmentType } from "../types";

export interface OptimizationResult {
  optimalQty:      number;
  unitPrice:       number;
  totalPrice:      number;
  feasible:        boolean;
  adjustment:      AdjustmentType;
  packageRounded:  boolean;
  priceStepUsed:   boolean;
  savedVsOriginal: number;
}

function getBestUnitPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
  let best = sorted[0].price;
  for (const tier of sorted) {
    if (qty >= tier.qty) best = tier.price;
  }
  return best;
}

export function smartOptimizeQty(
  requestedQty: number,
  packageUnit:  number,
  stock:        number,
  priceTiers:   PriceTier[]
): OptimizationResult {

  // Sanity check
  if (!priceTiers || priceTiers.length === 0) {
    return {
      optimalQty:      requestedQty,
      unitPrice:       0,
      totalPrice:      0,
      feasible:        false,
      adjustment:      "none",
      packageRounded:  false,
      priceStepUsed:   false,
      savedVsOriginal: 0,
    };
  }

  const unit       = Math.max(packageUnit, 1);
  const packageQty = Math.ceil(requestedQty / unit) * unit;

  // Candidati
  const candidates: { qty: number; packageRounded: boolean; priceStepUsed: boolean }[] = [];

  // A: qty esatta (se multiplo del package unit)
  candidates.push({ qty: requestedQty, packageRounded: false, priceStepUsed: false });

  // B: arrotondamento al package unit
  if (packageQty !== requestedQty) {
    candidates.push({ qty: packageQty, packageRounded: true, priceStepUsed: false });
  }

  // C: scaglioni di prezzo superiori
  const sortedTiers = [...priceTiers].sort((a, b) => a.qty - b.qty);
  for (const tier of sortedTiers) {
    if (tier.qty <= requestedQty) continue;
    const tierQty = Math.ceil(tier.qty / unit) * unit;
    if (!candidates.some(c => c.qty === tierQty)) {
      candidates.push({ qty: tierQty, packageRounded: tierQty !== tier.qty, priceStepUsed: true });
    }
  }

  // Calcola prezzo per ogni candidato
  const scored = candidates
    .map(c => {
      const unitPrice  = getBestUnitPrice(sortedTiers, c.qty);
      const totalPrice = parseFloat((unitPrice * c.qty).toFixed(4));
      return { ...c, unitPrice, totalPrice, feasible: stock >= c.qty };
    })
    .filter(c => c.unitPrice > 0);

  if (scored.length === 0) {
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

  // Priorità: feasible prima, poi per prezzo totale
  const feasible   = scored.filter(c => c.feasible);
  const infeasible = scored.filter(c => !c.feasible);
  const pool       = feasible.length > 0 ? feasible : infeasible;
  pool.sort((a, b) => a.totalPrice - b.totalPrice);
  const winner = pool[0];

  // Risparmio vs qty originale
  const origPrice      = getBestUnitPrice(sortedTiers, requestedQty);
  const origTotal      = parseFloat((origPrice * requestedQty).toFixed(4));
  const savedVsOriginal = parseFloat((origTotal - winner.totalPrice).toFixed(4));

  // Tipo aggiustamento
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

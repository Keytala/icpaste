// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Quantity Optimizer
//  Rounds requested qty up to the nearest packageUnit multiple,
//  only if stock is sufficient.
// ─────────────────────────────────────────────────────────────────────────────

export interface QtyOptimizationResult {
  optimalQty: number;
  rounded:    boolean;   // true if qty was adjusted from requested
  feasible:   boolean;   // false if stock cannot satisfy even 1 packageUnit
}

/**
 * Given a requested quantity and a distributor's package unit (e.g. reel of 4000),
 * returns the smallest multiple of packageUnit that satisfies requestedQty.
 *
 * Example:
 *   requestedQty=6800, packageUnit=4000, stock=12000
 *   → optimalQty=8000, rounded=true, feasible=true
 *
 *   requestedQty=500, packageUnit=1, stock=2000
 *   → optimalQty=500, rounded=false, feasible=true
 */
export function optimizeQty(
  requestedQty: number,
  packageUnit:  number,
  stock:        number
): QtyOptimizationResult {
  const unit = packageUnit < 1 ? 1 : packageUnit;

  // Round up to nearest multiple of packageUnit
  const multiplier = Math.ceil(requestedQty / unit);
  const optimalQty = multiplier * unit;

  const rounded  = optimalQty !== requestedQty;
  const feasible = stock >= optimalQty;

  return { optimalQty, rounded, feasible };
}

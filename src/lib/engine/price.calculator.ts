// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Price Calculator
//  Finds the best unit price for a given quantity using price break tiers.
// ─────────────────────────────────────────────────────────────────────────────

import { PriceTier } from "../types";

/**
 * Given a sorted list of price tiers and a quantity,
 * returns the best applicable unit price.
 *
 * Example tiers: [{qty:1, price:0.35}, {qty:100, price:0.28}, {qty:1000, price:0.22}]
 * qty=500 → 0.28 (best tier where tier.qty <= qty)
 */
export function getBestUnitPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;

  // Sort ascending by qty to be safe
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);

  let bestPrice = sorted[0].price; // fallback: first tier

  for (const tier of sorted) {
    if (qty >= tier.qty) {
      bestPrice = tier.price;
    }
  }

  return bestPrice;
}

/**
 * Returns total cost for a given qty and price tiers.
 */
export function getTotalPrice(tiers: PriceTier[], qty: number): number {
  const unit = getBestUnitPrice(tiers, qty);
  return parseFloat((unit * qty).toFixed(4));
}

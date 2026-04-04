// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Shared Types v4
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceTier {
  qty:   number;
  price: number;
}

export interface PartResult {
  distributor:  string;
  mpn:          string;
  description:  string;
  stock:        number;
  packageUnit:  number;
  priceTiers:   PriceTier[];
  productUrl:   string;
  currency:     string;
}

export type AdjustmentType = "none" | "package" | "pricestep" | "both";

export interface OptimizedResult {
  mpn:              string;
  originalCode?:    string;
  description:      string;
  requestedQty:     number;
  optimalQty:       number;
  rounded:          boolean;        // backward compat
  adjustment:       AdjustmentType; // tipo preciso di aggiustamento
  savedVsOriginal:  number;         // risparmio in $ vs qty originale
  unitPrice:        number;
  totalPrice:       number;
  currency:         string;
  distributor:      string;
  stock:            number;
  productUrl:       string;
  resolvedNote?:    string;
  error?:           string;
  stockFallback?:   StockFallback;
}

export interface StockFallback {
  distributor:  string;
  optimalQty:   number;
  rounded:      boolean;
  unitPrice:    number;
  totalPrice:   number;
  currency:     string;
  stock:        number;
  productUrl:   string;
}

export interface SearchResponse {
  results:    OptimizedResult[];
  totalBom:   number;
  currency:   string;
  searchedAt: string;
}
export type { BomRow } from "../utils/bom-parser";

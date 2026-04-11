// ─────────────────────────────────────────────────────────────────────────────
//  icpaste v2 — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceTier {
  qty:   number;
  price: number;
}

export interface BomRow {
  mpn: string;
  qty: number;
}

export type Adjustment = "none" | "package" | "pricestep" | "both";

export interface ResultRow {
  mpn:          string;
  description:  string;
  requestedQty: number;
  optimalQty:   number;
  unitPrice:    number;
  totalPrice:   number;
  currency:     string;
  distributor:  string;
  stock:        number;
  productUrl:   string;
  adjustment:   Adjustment;
  saved:        number;
  error?:       string;
  fallback?: {
    distributor: string;
    optimalQty:  number;
    unitPrice:   number;
    totalPrice:  number;
    stock:       number;
    productUrl:  string;
    currency:    string;
  };
}

export interface SearchResponse {
  results:    ResultRow[];
  totalBom:   number;
  searchedAt: string;
}

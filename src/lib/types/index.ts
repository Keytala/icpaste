// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Shared Types (v3)
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

export interface OptimizedResult {
  mpn:              string;
  originalCode?:    string;
  description:      string;
  requestedQty:     number;
  optimalQty:       number;
  rounded:          boolean;
  unitPrice:        number;
  totalPrice:       number;
  currency:         string;
  distributor:      string;
  stock:            number;
  productUrl:       string;
  resolvedNote?:    string;
  error?:           string;

  // ── Stock fallback ────────────────────────────────────────────────────────
  // Populated when best price has no stock — contains the next best option
  // with actual availability. User can "resolve" to swap to this.
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

// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Shared Types (v2)
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
  mpn:           string;
  originalCode?: string;       // set if user typed a distributor code
  description:   string;
  requestedQty:  number;
  optimalQty:    number;
  rounded:       boolean;
  unitPrice:     number;
  totalPrice:    number;
  currency:      string;
  distributor:   string;
  stock:         number;
  productUrl:    string;
  resolvedNote?: string;       // human-readable resolution note for the UI
  error?:        string;
}

export interface SearchResponse {
  results:    OptimizedResult[];
  totalBom:   number;
  currency:   string;
  searchedAt: string;
}

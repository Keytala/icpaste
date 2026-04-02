// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single price break tier returned by a distributor */
export interface PriceTier {
  qty:   number;
  price: number; // unit price in EUR (or local currency)
}

/** Normalized result returned by every distributor adapter */
export interface PartResult {
  distributor:  string;       // e.g. "Mouser"
  mpn:          string;       // Manufacturer Part Number
  description:  string;
  stock:        number;       // units available
  packageUnit:  number;       // minimum order / reel size (e.g. 4000)
  priceTiers:   PriceTier[];  // sorted ascending by qty
  productUrl:   string;       // direct link (with affiliate param if set)
  currency:     string;       // e.g. "EUR"
}

/** A single row in the user's BOM input */
export interface BomRow {
  mpn: string;
  qty: number;
}

/** The optimized result for a single BOM row */
export interface OptimizedResult {
  mpn:            string;
  description:    string;
  requestedQty:   number;
  optimalQty:     number;      // rounded up to nearest packageUnit
  rounded:        boolean;     // true if qty was adjusted
  unitPrice:      number;
  totalPrice:     number;
  currency:       string;
  distributor:    string;
  stock:          number;
  productUrl:     string;
  error?:         string;      // set if no results found
}

/** Full API response for /api/search */
export interface SearchResponse {
  results:    OptimizedResult[];
  totalBom:   number;           // sum of all totalPrice
  currency:   string;
  searchedAt: string;           // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Farnell / element14 Adapter
//
//  API Docs: https://partner.element14.com/docs/read/Product_Search_API
//  Auth:     API Key (query param)
//  Endpoint: GET https://api.element14.com/catalog/products
//
//  Env vars:
//    FARNELL_API_KEY        → la tua API key Farnell
//    FARNELL_STORE          → default "it.farnell.com"
//    FARNELL_AFFILIATE_PARAM → opzionale
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.element14.com/catalog/products";
const STORE           = process.env.FARNELL_STORE          ?? "it.farnell.com";
const AFFILIATE_PARAM = process.env.FARNELL_AFFILIATE_PARAM ?? "";

// ── Farnell API response types ────────────────────────────────────────────────
interface FarnellPriceBreak {
  from:   number;
  to:     number | string;
  cost:   number;
}

interface FarnellProduct {
  sku:               string;
  displayName:       string;
  translatedManufacturerPartNumberList?: { manufacturerPartNumber: string }[];
  stock:             { level: number };
  unitOfMeasure:     string;
  packSize:          number;
  minimumOrderQty:   number;
  prices:            FarnellPriceBreak[];
  productURL:        string;
  currency:          string;
}

interface FarnellApiResponse {
  keywordSearchReturn?: {
    products:      FarnellProduct[];
    numberOfResults: number;
  };
  manufacturerPartNumberSearchReturn?: {
    products:      FarnellProduct[];
    numberOfResults: number;
  };
}

// ── Costruisci URL prodotto Farnell ───────────────────────────────────────────
function buildFarnellUrl(product: FarnellProduct): string {
  const base = product.productURL
    ? `https://${STORE}${product.productURL}`
    : `https://${STORE}/search?st=${encodeURIComponent(product.sku)}`;
  return AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;
}

// ── Farnell Adapter ───────────────────────────────────────────────────────────
export const FarnellAdapter: DistributorAdapter = {
  name: "Farnell",

  async search(mpn: string, _qty: number): Promise<PartResult[]> {
    const apiKey = process.env.FARNELL_API_KEY;
    if (!apiKey || apiKey === "placeholder") return [];

    try {
      // Farnell supporta ricerca per MPN diretto
      const params = new URLSearchParams({
        callInfo:    JSON.stringify({
          apiKey,
          responseDataFormat: "json",
          storeInfo: { id: STORE, type: "global", locale: "it_IT" },
        }),
        term:        `manuPartNum:${mpn}`,
        start:       "0",
        numberOfResults: "10",
        resultsSettings: JSON.stringify({
          offset:       0,
          numberOfResults: 10,
          refinements:  {},
          sortBy:       "unitPrice",
          sortOrder:    "asc",
        }),
      });

      const response = await fetch(`${BASE_URL}?${params.toString()}`, {
        method:  "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        console.error(`[Farnell] HTTP ${response.status}`);
        return [];
      }

      const json = await response.json() as FarnellApiResponse;

      // Prova prima MPN search, poi keyword search
      const products =
        json.manufacturerPartNumberSearchReturn?.products ??
        json.keywordSearchReturn?.products ??
        [];

      return products
        .filter(p => p.prices && p.prices.length > 0)
        .map((p): PartResult => {
          const priceTiers: PriceTier[] = p.prices
            .map(pb => ({
              qty:   pb.from,
              price: pb.cost,
            }))
            .filter(t => t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          // packageUnit: usa packSize se > 1, altrimenti minimumOrderQty
          const packageUnit = p.packSize > 1
            ? p.packSize
            : (p.minimumOrderQty || 1);

          // Recupera MPN dal prodotto se disponibile
          const productMpn =
            p.translatedManufacturerPartNumberList?.[0]?.manufacturerPartNumber
            ?? mpn;

          return {
            mpn:         productMpn,
            description: p.displayName ?? "",
            stock:       p.stock?.level ?? 0,
            packageUnit,
            priceTiers,
            productUrl:  buildFarnellUrl(p),
            currency:    p.currency ?? "EUR",
            distributor: "Farnell",
          };
        });

    } catch (err) {
      console.error(`[Farnell] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

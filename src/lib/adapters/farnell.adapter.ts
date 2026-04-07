// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Farnell / element14 Adapter
//
//  FIX: il parametro corretto è "userinfo.apiKey" non "callInfo.apiKey"
//  URL corretto: https://api.element14.com/catalog/products/
//                                                          ^ slash finale!
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.element14.com/catalog/products";
const STORE           = process.env.FARNELL_STORE           ?? "it.farnell.com";
const AFFILIATE_PARAM = process.env.FARNELL_AFFILIATE_PARAM ?? "";

interface FarnellPriceBreak {
  from:  number;
  to:    number | string;
  cost:  number;
}

interface FarnellProduct {
  sku:         string;
  displayName: string;
  translatedManufacturerPartNumberList?: { manufacturerPartNumber: string }[];
  stock:       { level: number };
  packSize:    number;
  minimumOrderQty: number;
  prices:      FarnellPriceBreak[];
  productURL:  string;
  currency:    string;
}

interface FarnellApiResponse {
  keywordSearchReturn?: {
    products:        FarnellProduct[];
    numberOfResults: number;
  };
  manufacturerPartNumberSearchReturn?: {
    products:        FarnellProduct[];
    numberOfResults: number;
  };
}

function buildFarnellUrl(product: FarnellProduct): string {
  const base = product.productURL
    ? `https://${STORE}${product.productURL}`
    : `https://${STORE}/search?st=${encodeURIComponent(product.sku)}`;
  return AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;
}

export const FarnellAdapter: DistributorAdapter = {
  name: "Farnell",

  async search(mpn: string, _qty: number): Promise<PartResult[]> {
    const apiKey = process.env.FARNELL_API_KEY;
    if (!apiKey || apiKey === "placeholder") return [];

    try {
      // ── Fix: "userinfo.apiKey" è il parametro corretto ───────────────────
      const params = new URLSearchParams({
        "term":                            `manuPartNum:${mpn}`,
        "storeInfo.id":                    STORE,
        "storeInfo.type":                  "global",
        "storeInfo.locale":                "it_IT",
        "resultsSettings.offset":          "0",
        "resultsSettings.numberOfResults": "10",
        "resultsSettings.sortBy":          "unitPrice",
        "resultsSettings.sortOrder":       "asc",
        "callInfo.responseDataFormat":     "json",
        "userinfo.apiKey":                 apiKey,   // ← FIX: era callInfo.apiKey
      });

      const response = await fetch(`${BASE_URL}?${params.toString()}`, {
        method:  "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Farnell] HTTP ${response.status}:`, errText.slice(0, 200));
        return [];
      }

      const json = await response.json() as FarnellApiResponse;

      const products =
        json.manufacturerPartNumberSearchReturn?.products ??
        json.keywordSearchReturn?.products ??
        [];

      return products
        .filter(p => p.prices && p.prices.length > 0)
        .map((p): PartResult => {
          const priceTiers: PriceTier[] = p.prices
            .map(pb => ({ qty: pb.from, price: pb.cost }))
            .filter(t => t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          const packageUnit = p.packSize > 1
            ? p.packSize
            : (p.minimumOrderQty || 1);

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

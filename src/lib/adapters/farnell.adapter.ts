// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Farnell / element14 Adapter
//  Docs: https://partner.element14.com/docs/read/Product_Search_API_REST
//  Auth: API Key (query param)
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL  = "https://api.element14.com/catalog/products";
const API_KEY   = process.env.FARNELL_API_KEY ?? "";
const AFFILIATE = process.env.FARNELL_AFFILIATE_PARAM ?? "";
const STORE     = "uk.farnell.com"; // change to your region store

export const FarnellAdapter: DistributorAdapter = {
  name: "Farnell",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    if (!API_KEY) {
      console.warn("[Farnell] FARNELL_API_KEY not set — skipping");
      return [];
    }

    try {
      const params = new URLSearchParams({
        callInfo_omitXmlSchema:   "false",
        response_responseGroup:   "prices,inventory",
        callInfo_apiKey:          API_KEY,
        callInfo_responseDataFormat: "json",
        "query.manuPartNum":      mpn,
        "storeInfo.id":           STORE,
        "resultsSettings.offset": "0",
        "resultsSettings.numberOfResults": "10",
      });

      const res = await fetch(`${BASE_URL}?${params.toString()}`, {
        next: { revalidate: 300 },
      });

      if (!res.ok) return [];

      const data     = await res.json();
      const products = data?.keywordSearchReturn?.products ?? [];

      return products
        .filter((p: any) => (p.inv ?? 0) > 0)
        .map((p: any): PartResult => {
          const stock       = parseInt(p.inv ?? "0");
          const packageUnit = parseInt(p.minOrderQty ?? "1") || 1;

          const priceTiers: PriceTier[] = (p.prices ?? []).map((pb: any) => ({
            qty:   parseInt(pb.from ?? "1"),
            price: parseFloat(pb.cost ?? "0"),
          }));

          const productUrl = p.sku
            ? `https://uk.farnell.com/search?st=${encodeURIComponent(mpn)}${AFFILIATE}`
            : `https://uk.farnell.com/search?st=${encodeURIComponent(mpn)}${AFFILIATE}`;

          return {
            distributor: "Farnell",
            mpn:         p.translatedManufacturerPartNumber ?? mpn,
            description: p.displayName ?? "",
            stock,
            packageUnit,
            priceTiers,
            productUrl,
            currency:    "GBP",
          };
        });
    } catch (err) {
      console.error("[Farnell] search error:", err);
      return [];
    }
  },
};

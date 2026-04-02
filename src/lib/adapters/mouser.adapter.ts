// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Mouser Adapter
//  Docs: https://api.mouser.com/api/docs/ui/index
//  Auth: API Key (query param)
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL       = "https://api.mouser.com/api/v1";
const API_KEY        = process.env.MOUSER_API_KEY ?? "";
const AFFILIATE      = process.env.MOUSER_AFFILIATE_PARAM ?? "";

export const MouserAdapter: DistributorAdapter = {
  name: "Mouser",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    if (!API_KEY) {
      console.warn("[Mouser] MOUSER_API_KEY not set — skipping");
      return [];
    }

    try {
      const res = await fetch(
        `${BASE_URL}/search/partnumber?apiKey=${API_KEY}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            SearchByPartRequest: {
              mouserPartNumber:  mpn,
              partSearchOptions: "Exact",
            },
          }),
          next: { revalidate: 300 }, // cache 5 min on Vercel
        }
      );

      if (!res.ok) return [];

      const data = await res.json();
      const parts = data?.SearchResults?.Parts ?? [];

      return parts
        .filter((p: any) => p.Availability && parseInt(p.Availability) > 0)
        .map((p: any): PartResult => {
          const stock       = parseInt(p.Availability?.replace(/[^0-9]/g, "") ?? "0");
          const packageUnit = parseInt(p.Min ?? "1") || 1;
          const priceTiers: PriceTier[] = (p.PriceBreaks ?? []).map((pb: any) => ({
            qty:   parseInt(pb.Quantity),
            price: parseFloat(pb.Price?.replace(",", ".") ?? "0"),
          }));

          const productUrl = p.ProductDetailUrl
            ? `${p.ProductDetailUrl}${AFFILIATE}`
            : `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(mpn)}${AFFILIATE}`;

          return {
            distributor: "Mouser",
            mpn:         p.ManufacturerPartNumber ?? mpn,
            description: p.Description ?? "",
            stock,
            packageUnit,
            priceTiers,
            productUrl,
            currency:    "USD",
          };
        });
    } catch (err) {
      console.error("[Mouser] search error:", err);
      return [];
    }
  },
};

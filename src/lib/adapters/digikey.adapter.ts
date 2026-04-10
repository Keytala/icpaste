/* eslint-disable @typescript-eslint/no-explicit-any */
// v3 — force rebuild
import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.digikey.com";
const AFFILIATE_PARAM = process.env.DIGIKEY_AFFILIATE_PARAM ?? "";
const LOCALE_SITE     = process.env.DIGIKEY_LOCALE_SITE     ?? "IT";
const LOCALE_LANGUAGE = process.env.DIGIKEY_LOCALE_LANGUAGE ?? "it";
const LOCALE_CURRENCY = process.env.DIGIKEY_LOCALE_CURRENCY ?? "EUR";

async function getToken(id: string, secret: string): Promise<string> {
  const r = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     id,
      client_secret: secret,
      grant_type:    "client_credentials",
    }),
  });
  const j = await r.json();
  return j.access_token;
}

export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    const id     = process.env.DIGIKEY_CLIENT_ID;
    const secret = process.env.DIGIKEY_CLIENT_SECRET;

    if (!id || !secret || id === "placeholder" || secret === "placeholder") {
      return [];
    }

    try {
      const token = await getToken(id, secret);

      const res = await fetch(`${BASE_URL}/products/v4/search/keyword`, {
        method: "POST",
        headers: {
          "Content-Type":              "application/json",
          "Accept":                    "application/json",
          "Authorization":             `Bearer ${token}`,
          "X-DIGIKEY-Client-Id":       id,
          "X-DIGIKEY-Locale-Site":     LOCALE_SITE,
          "X-DIGIKEY-Locale-Language": LOCALE_LANGUAGE,
          "X-DIGIKEY-Locale-Currency": LOCALE_CURRENCY,
        },
        body: JSON.stringify({
          Keywords:          mpn,
          RecordCount:       10,
          RecordStartPos:    0,
          RequestedQuantity: qty,
          SearchOptions:     ["ManufacturerPartSearch"],
          SortOptions:       [{ Field: "UnitPrice", SortOrder: "Ascending" }],
        }),
      });

      if (!res.ok) return [];

      const json: any = await res.json();
      const output: PartResult[] = [];

      for (const p of (json?.Products ?? [])) {
        for (const v of (p?.ProductVariations ?? [])) {
          const pricing: any[] = v?.StandardPricing ?? [];
          if (!pricing.length) continue;

          const priceTiers: PriceTier[] = pricing
            .map((pb: any) => ({
              qty:   Number(pb.BreakQuantity),
              price: Number(pb.UnitPrice),
            }))
            .filter((t: any) => t.qty > 0 && t.price > 0)
            .sort((a: any, b: any) => a.qty - b.qty);

          if (!priceTiers.length) continue;

          output.push({
            mpn:         String(p?.ManufacturerProductNumber ?? mpn),
            description: String(p?.Description?.ProductDescription ?? ""),
            stock:       Number(v?.QuantityAvailableforPackageType ?? 0),
            packageUnit: Number(v?.StandardPackage ?? 1) > 1
                           ? Number(v.StandardPackage)
                           : Number(v?.MinimumOrderQuantity ?? 1),
            priceTiers,
            productUrl:  AFFILIATE_PARAM
                           ? `${p?.ProductUrl}${AFFILIATE_PARAM}`
                           : String(p?.ProductUrl ?? ""),
            currency:    String(p?.Currency ?? LOCALE_CURRENCY),
            distributor: "Digi-Key",
          });
        }
      }

      return output;

    } catch (err) {
      console.error(`[DigiKey] Error:`, err);
      return [];
    }
  },
};

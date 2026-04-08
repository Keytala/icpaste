/* eslint-disable @typescript-eslint/no-explicit-any */
import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.digikey.com";
const AFFILIATE_PARAM = process.env.DIGIKEY_AFFILIATE_PARAM ?? "";
const LOCALE_SITE     = process.env.DIGIKEY_LOCALE_SITE     ?? "IT";
const LOCALE_LANGUAGE = process.env.DIGIKEY_LOCALE_LANGUAGE ?? "it";
const LOCALE_CURRENCY = process.env.DIGIKEY_LOCALE_CURRENCY ?? "EUR";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getToken(id: string, secret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const r = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
  });
  const j = await r.json();
  cachedToken = j.access_token;
  tokenExpiry = Date.now() + j.expires_in * 1000;
  return cachedToken!;
}

export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    const id = process.env.DIGIKEY_CLIENT_ID;
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

      if (!res.ok) {
        if (res.status === 401) {
          cachedToken = null;
          tokenExpiry = 0;
        }
        return [];
      }

      const json: any = await res.json();
      const output: PartResult[] = [];

      for (const p of json?.Products ?? []) {
        for (const v of p?.ProductVariations ?? []) {
          const pricing: any[] = v?.StandardPricing ?? [];
          if (!pricing.length) continue;

          const priceTiers: PriceTier[] = pricing
            .map((pb: any) => ({
              qty:   Number(pb.BreakQuantity),
              price: Number(pb.UnitPrice),
            }))
            .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
            .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

          if (!priceTiers.length) continue;

          const stock      = Number(v?.QuantityAvailableforPackageType ?? p?.QuantityAvailable ?? 0);
          const stdPkg     = Number(v?.StandardPackage ?? 0);
          const moq        = Number(v?.MinimumOrderQuantity ?? 1);
          const pkgUnit    = stdPkg > 1 ? stdPkg : moq || 1;
          const base       = String(p?.ProductUrl ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(mpn)}`);
          const productUrl = AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;

          const result: PartResult = {
            mpn:         String(p?.ManufacturerProductNumber ?? mpn),
            description: String(p?.Description?.ProductDescription ?? ""),
            stock,
            packageUnit: pkgUnit,
            priceTiers,
            productUrl,
            currency:    String(p?.Currency ?? LOCALE_CURRENCY),
            distributor: "Digi-Key",
          };

          output.push(result);
        }
      }

      return output;

    } catch (err) {
      console.error(`[DigiKey] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

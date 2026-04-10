/* eslint-disable @typescript-eslint/no-explicit-any */
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
  if (!r.ok) throw new Error(`[DigiKey] Token HTTP ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("[DigiKey] No access_token in response");
  return String(j.access_token);
}

export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    const id     = process.env.DIGIKEY_CLIENT_ID;
    const secret = process.env.DIGIKEY_CLIENT_SECRET;

    if (!id || !secret || id === "placeholder" || secret === "placeholder") {
      return [];
    }

    let token: string;
    try {
      token = await getToken(id, secret);
    } catch (e) {
      console.error("[DigiKey] Token error:", e);
      return [];
    }

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/products/v4/search/keyword`, {
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
    } catch (e) {
      console.error("[DigiKey] Fetch error:", e);
      return [];
    }

    if (!res.ok) {
      console.error(`[DigiKey] HTTP ${res.status}`);
      return [];
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      console.error("[DigiKey] JSON parse error:", e);
      return [];
    }

    const output: PartResult[] = [];
    const products: any[] = Array.isArray(json?.Products) ? json.Products : [];

    for (const p of products) {
      if (!p || typeof p !== "object") continue;
      const variations: any[] = Array.isArray(p.ProductVariations) ? p.ProductVariations : [];

      for (const v of variations) {
        if (!v || typeof v !== "object") continue;
        const pricing: any[] = Array.isArray(v.StandardPricing) ? v.StandardPricing : [];
        if (pricing.length === 0) continue;

        const priceTiers: PriceTier[] = [];
        for (const pb of pricing) {
          const q  = Number(pb?.BreakQuantity ?? 0);
          const pr = Number(pb?.UnitPrice     ?? 0);
          if (q > 0 && pr > 0) priceTiers.push({ qty: q, price: pr });
        }
        priceTiers.sort((a, b) => a.qty - b.qty);
        if (priceTiers.length === 0) continue;

        const stock   = Number(v.QuantityAvailableforPackageType ?? p.QuantityAvailable ?? 0);
        const stdPkg  = Number(v.StandardPackage ?? 0);
        const moq     = Number(v.MinimumOrderQuantity ?? 1);
        const pkgUnit = stdPkg > 1 ? stdPkg : (moq > 0 ? moq : 1);

        const rawUrl     = typeof p.ProductUrl === "string" ? p.ProductUrl : "";
        const productUrl = rawUrl
          ? (AFFILIATE_PARAM ? `${rawUrl}${AFFILIATE_PARAM}` : rawUrl)
          : `https://www.digikey.it/products/it?keywords=${encodeURIComponent(mpn)}`;

        output.push({
          mpn:         String(p.ManufacturerProductNumber ?? mpn),
          description: String(p.Description?.ProductDescription ?? ""),
          stock,
          packageUnit: pkgUnit,
          priceTiers,
          productUrl,
          currency:    String(p.Currency ?? LOCALE_CURRENCY),
          distributor: "Digi-Key",
        });
      }
    }

    console.log(`[DigiKey] ${mpn} → ${output.length} results`);
    return output;
  },
};

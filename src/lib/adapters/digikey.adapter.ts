import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.digikey.com";
const TOKEN_URL       = `${BASE_URL}/v1/oauth2/token`;
const AFFILIATE_PARAM = process.env.DIGIKEY_AFFILIATE_PARAM  ?? "";
const LOCALE_SITE     = process.env.DIGIKEY_LOCALE_SITE      ?? "IT";
const LOCALE_LANGUAGE = process.env.DIGIKEY_LOCALE_LANGUAGE  ?? "it";
const LOCALE_CURRENCY = process.env.DIGIKEY_LOCALE_CURRENCY  ?? "EUR";

let cachedToken: string | null = null;
let tokenExpiry: number        = 0;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const response = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "client_credentials",
    }),
  });

  if (!response.ok) throw new Error(`[DigiKey] Token error ${response.status}`);

  const json  = await response.json();
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in * 1000);
  return cachedToken!;
}

export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    const clientId     = process.env.DIGIKEY_CLIENT_ID;
    const clientSecret = process.env.DIGIKEY_CLIENT_SECRET;

    if (!clientId || !clientSecret ||
        clientId     === "placeholder" ||
        clientSecret === "placeholder") return [];

    try {
      const token = await getAccessToken(clientId, clientSecret);

      const response = await fetch(`${BASE_URL}/products/v4/search/keyword`, {
        method:  "POST",
        headers: {
          "Content-Type":              "application/json",
          "Accept":                    "application/json",
          "Authorization":             `Bearer ${token}`,
          "X-DIGIKEY-Client-Id":       clientId,
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

      if (!response.ok) {
        if (response.status === 401) { cachedToken = null; tokenExpiry = 0; }
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.json();
      const products  = json?.Products ?? [];
      const results: PartResult[] = [];

      for (const p of products) {
        const variations = p?.ProductVariations ?? [];

        for (const v of variations) {
          // ── Leggi StandardPricing dalla variazione ────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pricing: any[] = v?.StandardPricing ?? [];
          if (!pricing || pricing.length === 0) continue;

          const priceTiers: PriceTier[] = pricing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((pb: any) => ({
              qty:   Number(pb.BreakQuantity),
              price: Number(pb.UnitPrice),
            }))
            .filter(t => t.qty > 0 && t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          if (priceTiers.length === 0) continue;

          const stock       = Number(v?.QuantityAvailableforPackageType ?? p?.QuantityAvailable ?? 0);
          const stdPackage  = Number(v?.StandardPackage ?? 0);
          const moq         = Number(v?.MinimumOrderQuantity ?? 1);
          const packageUnit = stdPackage > 1 ? stdPackage : (moq || 1);

          const base = p?.ProductUrl
            ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(p?.ManufacturerProductNumber ?? mpn)}`;
          const productUrl = AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;

          results.push({
            mpn:         String(p?.ManufacturerProductNumber ?? mpn),
            description: String(p?.Description?.ProductDescription ?? ""),
            stock,
            packageUnit,
            priceTiers,
            productUrl,
            currency:    String(p?.Currency ?? LOCALE_CURRENCY),
            distributor: "Digi-Key",
          });
        }
      }

      return results;

    } catch (err) {
      console.error(`[DigiKey] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

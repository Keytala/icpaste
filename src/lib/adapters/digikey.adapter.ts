// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Digi-Key Adapter (fix endpoint v4)
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.digikey.com";
const TOKEN_URL       = `${BASE_URL}/v1/oauth2/token`;
const AFFILIATE_PARAM = process.env.DIGIKEY_AFFILIATE_PARAM  ?? "";
const LOCALE_SITE     = process.env.DIGIKEY_LOCALE_SITE      ?? "IT";
const LOCALE_LANGUAGE = process.env.DIGIKEY_LOCALE_LANGUAGE  ?? "it";
const LOCALE_CURRENCY = process.env.DIGIKEY_LOCALE_CURRENCY  ?? "EUR";

// ── Token cache ───────────────────────────────────────────────────────────────
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

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[DigiKey] Token error ${response.status}: ${err}`);
  }

  const json  = await response.json();
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in * 1000);
  return cachedToken!;
}

// ── DigiKey API types ─────────────────────────────────────────────────────────
interface DigiKeyPriceBreak {
  BreakQuantity: number;
  UnitPrice:     number;
}

interface DigiKeyProduct {
  ManufacturerProductNumber: string;
  Description:               { ProductDescription: string };
  QuantityAvailable:         number;
  MinimumOrderQuantity:      number;
  StandardPackage:           number;
  StandardPricing:           DigiKeyPriceBreak[];
  ProductUrl:                string;
  Currency:                  string;
}

interface DigiKeySearchResponse {
  Products:         DigiKeyProduct[];
  TotalResultCount: number;
}

function buildDigikeyUrl(product: DigiKeyProduct): string {
  const base = product.ProductUrl
    ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(product.ManufacturerProductNumber)}`;
  return AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;
}

export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    const clientId     = process.env.DIGIKEY_CLIENT_ID;
    const clientSecret = process.env.DIGIKEY_CLIENT_SECRET;

    if (!clientId || !clientSecret ||
        clientId === "placeholder" || clientSecret === "placeholder") return [];

    try {
      const token = await getAccessToken(clientId, clientSecret);

      // ── Fix: usa l'endpoint corretto v4 ──────────────────────────────────
      const response = await fetch(
        `${BASE_URL}/products/v4/search/keyword`,
        {
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
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[DigiKey] HTTP ${response.status}:`, errText.slice(0, 200));
        if (response.status === 401) { cachedToken = null; tokenExpiry = 0; }
        return [];
      }

      const json     = await response.json() as DigiKeySearchResponse;
      const products = json.Products ?? [];

      return products
        .filter(p => p.StandardPricing && p.StandardPricing.length > 0)
        .map((p): PartResult => {
          const priceTiers: PriceTier[] = p.StandardPricing
            .map(pb => ({ qty: pb.BreakQuantity, price: pb.UnitPrice }))
            .filter(t => t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          const packageUnit = p.StandardPackage > 1
            ? p.StandardPackage
            : (p.MinimumOrderQuantity || 1);

          return {
            mpn:         p.ManufacturerProductNumber,
            description: p.Description?.ProductDescription ?? "",
            stock:       p.QuantityAvailable ?? 0,
            packageUnit,
            priceTiers,
            productUrl:  buildDigikeyUrl(p),
            currency:    p.Currency ?? LOCALE_CURRENCY,
            distributor: "Digi-Key",
          };
        });

    } catch (err) {
      console.error(`[DigiKey] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

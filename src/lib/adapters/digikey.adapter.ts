// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Digi-Key Adapter
//
//  FIX: StandardPricing è undefined sul root — i prezzi sono dentro
//       ProductVariations[0].standardPricing (lowercase 's' nella risposta!)
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
// NOTA: la risposta API usa PascalCase per alcuni campi e camelCase per altri!
interface DigiKeyPriceBreak {
  BreakQuantity: number;
  UnitPrice:     number;
  TotalPrice:    number;
}

interface DigiKeyVariation {
  DigiKeyProductNumber: string;
  PackageType:          { Id: number; Name: string };
  QuantityAvailable:    number;
  // ← la risposta usa "standardPricing" lowercase!
  standardPricing:      DigiKeyPriceBreak[];
  StandardPricing:      DigiKeyPriceBreak[];   // per sicurezza gestiamo entrambi
}

interface DigiKeyProduct {
  ManufacturerProductNumber: string;
  Description:               { ProductDescription: string };
  QuantityAvailable:         number;
  MinimumOrderQuantity:      number;
  StandardPackage:           number;
  UnitPrice:                 number;
  // Root pricing — spesso undefined in v4
  StandardPricing:           DigiKeyPriceBreak[] | undefined;
  standardPricing:           DigiKeyPriceBreak[] | undefined;
  ProductVariations:         DigiKeyVariation[];
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

// ── Estrai price tiers — gestisce PascalCase e camelCase ─────────────────────
function extractPriceTiers(product: DigiKeyProduct): PriceTier[] {

  // Helper per convertire array di price breaks in PriceTier[]
  const convert = (breaks: DigiKeyPriceBreak[]): PriceTier[] =>
    breaks
      .map(pb => ({ qty: pb.BreakQuantity, price: pb.UnitPrice }))
      .filter(t => t.qty > 0 && t.price > 0)
      .sort((a, b) => a.qty - b.qty);

  // 1. Prova root StandardPricing (PascalCase)
  if (product.StandardPricing?.length) {
    const tiers = convert(product.StandardPricing);
    if (tiers.length > 0) return tiers;
  }

  // 2. Prova root standardPricing (camelCase)
  if (product.standardPricing?.length) {
    const tiers = convert(product.standardPricing);
    if (tiers.length > 0) return tiers;
  }

  // 3. Cerca nelle variazioni — prova sia PascalCase che camelCase
  if (product.ProductVariations?.length) {
    for (const variation of product.ProductVariations) {
      // Prova PascalCase
      const pricing = variation.StandardPricing ?? variation.standardPricing;
      if (pricing?.length) {
        const tiers = convert(pricing);
        if (tiers.length > 0) return tiers;
      }
    }
  }

  // 4. Ultimo fallback: UnitPrice del root come tier singolo
  if (product.UnitPrice > 0) {
    return [{ qty: 1, price: product.UnitPrice }];
  }

  return [];
}

// ── DigiKey Adapter ───────────────────────────────────────────────────────────
export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    const clientId     = process.env.DIGIKEY_CLIENT_ID;
    const clientSecret = process.env.DIGIKEY_CLIENT_SECRET;

    if (!clientId || !clientSecret ||
        clientId === "placeholder" || clientSecret === "placeholder") return [];

    try {
      const token = await getAccessToken(clientId, clientSecret);

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
        .map((p): PartResult | null => {
          const priceTiers = extractPriceTiers(p);
          if (priceTiers.length === 0) return null;

          const packageUnit = (p.StandardPackage ?? 0) > 1
            ? p.StandardPackage
            : (p.MinimumOrderQuantity || 1);

          const stock =
            p.QuantityAvailable ??
            p.ProductVariations?.[0]?.QuantityAvailable ??
            0;

          return {
            mpn:         p.ManufacturerProductNumber,
            description: p.Description?.ProductDescription ?? "",
            stock,
            packageUnit,
            priceTiers,
            productUrl:  buildDigikeyUrl(p),
            currency:    p.Currency ?? LOCALE_CURRENCY,
            distributor: "Digi-Key",
          };
        })
        .filter((p): p is PartResult => p !== null);

    } catch (err) {
      console.error(`[DigiKey] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

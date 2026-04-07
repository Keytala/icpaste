// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Digi-Key Adapter
//
//  FIX: StandardPricing è dentro ProductVariations[0], non sul prodotto root
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
  TotalPrice:    number;
}

interface DigiKeyVariation {
  DigiKeyProductNumber: string;
  PackageType:          { Id: number; Name: string };
  StandardPricing:      DigiKeyPriceBreak[];
  QuantityAvailable?:   number;
}

interface DigiKeyProduct {
  ManufacturerProductNumber: string;
  Description:               { ProductDescription: string };
  QuantityAvailable:         number;
  MinimumOrderQuantity:      number;
  StandardPackage:           number;
  UnitPrice:                 number;
  StandardPricing:           DigiKeyPriceBreak[];   // spesso vuoto nel root
  ProductVariations:         DigiKeyVariation[];    // ← qui ci sono i prezzi reali
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

// ── Estrai i price tiers — prima da root, poi da Variations ──────────────────
function extractPriceTiers(product: DigiKeyProduct): PriceTier[] {
  // 1. Prova prima StandardPricing sul prodotto root
  if (product.StandardPricing && product.StandardPricing.length > 0) {
    const tiers = product.StandardPricing
      .map(pb => ({ qty: pb.BreakQuantity, price: pb.UnitPrice }))
      .filter(t => t.price > 0)
      .sort((a, b) => a.qty - b.qty);
    if (tiers.length > 0) return tiers;
  }

  // 2. Fallback: prendi i prezzi dalla prima variazione disponibile
  //    (DigiKey v4 mette i prezzi dentro ProductVariations[0].StandardPricing)
  if (product.ProductVariations && product.ProductVariations.length > 0) {
    for (const variation of product.ProductVariations) {
      if (variation.StandardPricing && variation.StandardPricing.length > 0) {
        const tiers = variation.StandardPricing
          .map(pb => ({ qty: pb.BreakQuantity, price: pb.UnitPrice }))
          .filter(t => t.price > 0)
          .sort((a, b) => a.qty - b.qty);
        if (tiers.length > 0) return tiers;
      }
    }
  }

  // 3. Ultimo fallback: usa UnitPrice del root come tier unico
  if (product.UnitPrice && product.UnitPrice > 0) {
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

          // packageUnit: StandardPackage > 1, altrimenti MinimumOrderQuantity
          const packageUnit = (p.StandardPackage ?? 0) > 1
            ? p.StandardPackage
            : (p.MinimumOrderQuantity || 1);

          // Stock: usa QuantityAvailable del root o della prima variazione
          const stock = p.QuantityAvailable
            ?? p.ProductVariations?.[0]?.QuantityAvailable
            ?? 0;

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

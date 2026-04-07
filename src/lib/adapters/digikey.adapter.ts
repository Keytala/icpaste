// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Digi-Key Adapter (fix definitivo)
//
//  Struttura reale API v4:
//  - Product.QuantityAvailable        → stock totale root (ok)
//  - Product.ProductVariations[n]
//      .StandardPricing               → price breaks (PascalCase ✅)
//      .QuantityAvailableforPackageType → stock per variazione
//      .MinimumOrderQuantity          → MOQ
//      .StandardPackage               → package unit (es. 40 per tubo)
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

// ── DigiKey API types (struttura reale v4) ────────────────────────────────────
interface DigiKeyPriceBreak {
  BreakQuantity: number;
  UnitPrice:     number;
  TotalPrice:    number;
}

interface DigiKeyVariation {
  DigiKeyProductNumber:           string;
  PackageType:                    { Id: number; Name: string };
  StandardPricing:                DigiKeyPriceBreak[];
  MyPricing:                      DigiKeyPriceBreak[];
  QuantityAvailableforPackageType: number;   // ← stock per variazione
  MinimumOrderQuantity:           number;
  StandardPackage:                number;    // ← package unit
  DigiReelFee:                    number;
}

interface DigiKeyProduct {
  ManufacturerProductNumber: string;
  Description:               { ProductDescription: string };
  QuantityAvailable:         number;
  UnitPrice:                 number;
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

// ── Adapter ───────────────────────────────────────────────────────────────────
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

      // ── Per ogni prodotto, espandi le variazioni come risultati separati ───
      // Ogni variazione è un package type diverso (Tubo, Reel, Tray, ecc.)
      const results: PartResult[] = [];

      for (const p of products) {
        const variations = p.ProductVariations ?? [];

        for (const v of variations) {
          // Salta se non ha prezzi
          if (!v.StandardPricing || v.StandardPricing.length === 0) continue;

          const priceTiers: PriceTier[] = v.StandardPricing
            .map(pb => ({ qty: pb.BreakQuantity, price: pb.UnitPrice }))
            .filter(t => t.qty > 0 && t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          if (priceTiers.length === 0) continue;

          // Stock: usa QuantityAvailableforPackageType della variazione
          const stock = v.QuantityAvailableforPackageType ?? p.QuantityAvailable ?? 0;

          // Package unit: StandardPackage della variazione
          const packageUnit = (v.StandardPackage ?? 0) > 1
            ? v.StandardPackage
            : (v.MinimumOrderQuantity || 1);

          results.push({
            mpn:         p.ManufacturerProductNumber,
            description: p.Description?.ProductDescription ?? "",
            stock,
            packageUnit,
            priceTiers,
            productUrl:  buildDigikeyUrl(p),
            currency:    p.Currency ?? LOCALE_CURRENCY,
            distributor: "Digi-Key",
          });
        }

        // Fallback: se nessuna variazione ha prezzi, usa UnitPrice root
        if (results.filter(r => r.mpn === p.ManufacturerProductNumber).length === 0) {
          if (p.UnitPrice > 0) {
            results.push({
              mpn:         p.ManufacturerProductNumber,
              description: p.Description?.ProductDescription ?? "",
              stock:       p.QuantityAvailable ?? 0,
              packageUnit: 1,
              priceTiers:  [{ qty: 1, price: p.UnitPrice }],
              productUrl:  buildDigikeyUrl(p),
              currency:    p.Currency ?? LOCALE_CURRENCY,
              distributor: "Digi-Key",
            });
          }
        }
      }

      return results;

    } catch (err) {
      console.error(`[DigiKey] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

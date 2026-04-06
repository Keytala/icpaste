// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Digi-Key Adapter
//
//  API Docs: https://developer.digikey.com
//  Auth:     OAuth2 Client Credentials (machine-to-machine)
//  Token:    POST https://api.digikey.com/v1/oauth2/token
//  Search:   POST https://api.digikey.com/products/v4/search/keyword
//
//  Env vars:
//    DIGIKEY_CLIENT_ID      → il tuo Client ID
//    DIGIKEY_CLIENT_SECRET  → il tuo Client Secret
//    DIGIKEY_AFFILIATE_PARAM → opzionale
//    DIGIKEY_LOCALE_SITE    → default IT
//    DIGIKEY_LOCALE_LANGUAGE → default it
//    DIGIKEY_LOCALE_CURRENCY → default EUR
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.digikey.com";
const TOKEN_URL       = `${BASE_URL}/v1/oauth2/token`;
const SEARCH_URL      = `${BASE_URL}/products/v4/search/keyword`;
const AFFILIATE_PARAM = process.env.DIGIKEY_AFFILIATE_PARAM ?? "";

const LOCALE_SITE     = process.env.DIGIKEY_LOCALE_SITE     ?? "IT";
const LOCALE_LANGUAGE = process.env.DIGIKEY_LOCALE_LANGUAGE ?? "it";
const LOCALE_CURRENCY = process.env.DIGIKEY_LOCALE_CURRENCY ?? "EUR";

// ── Token cache — evita di richiedere un token ad ogni chiamata ───────────────
let cachedToken: string | null   = null;
let tokenExpiry: number          = 0;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  // Usa il token cached se ancora valido (con 60s di margine)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

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
    throw new Error(`[DigiKey] Token error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in * 1000);
  return cachedToken!;
}

// ── DigiKey API response types ────────────────────────────────────────────────
interface DigiKeyPriceBreak {
  BreakQuantity: number;
  UnitPrice:     number;
  TotalPrice:    number;
}

interface DigiKeyProduct {
  ManufacturerProductNumber: string;
  Description:               { ProductDescription: string };
  QuantityAvailable:         number;
  MinimumOrderQuantity:      number;
  StandardPackage:           number;
  UnitPrice:                 number;
  StandardPricing:           DigiKeyPriceBreak[];
  ProductUrl:                string;
  Currency:                  string;
}

interface DigiKeySearchResponse {
  Products:       DigiKeyProduct[];
  TotalResultCount: number;
}

// ── Costruisci URL prodotto DigiKey ───────────────────────────────────────────
function buildDigikeyUrl(product: DigiKeyProduct): string {
  const base = product.ProductUrl ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(product.ManufacturerProductNumber)}`;
  return AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;
}

// ── DigiKey Adapter ───────────────────────────────────────────────────────────
export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, _qty: number): Promise<PartResult[]> {
    const clientId     = process.env.DIGIKEY_CLIENT_ID;
    const clientSecret = process.env.DIGIKEY_CLIENT_SECRET;

    if (!clientId || !clientSecret ||
        clientId === "placeholder" || clientSecret === "placeholder") {
      return [];
    }

    try {
      // 1. Ottieni access token
      const token = await getAccessToken(clientId, clientSecret);

      // 2. Cerca il prodotto
      const response = await fetch(SEARCH_URL, {
        method:  "POST",
        headers: {
          "Content-Type":        "application/json",
          "Accept":              "application/json",
          "Authorization":       `Bearer ${token}`,
          "X-DIGIKEY-Client-Id": clientId,
          "X-DIGIKEY-Locale-Site":     LOCALE_SITE,
          "X-DIGIKEY-Locale-Language": LOCALE_LANGUAGE,
          "X-DIGIKEY-Locale-Currency": LOCALE_CURRENCY,
        },
        body: JSON.stringify({
          Keywords:         mpn,
          RecordCount:      10,
          RecordStartPos:   0,
          Filters:          {},
          Sort:             { SortOption: "SortByUnitPrice", Direction: "Ascending", SortParameterId: 0 },
          RequestedQuantity: _qty,
          SearchOptions:    ["ManufacturerPartSearch"],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[DigiKey] HTTP ${response.status}:`, errText);
        // Se token scaduto, resetta la cache
        if (response.status === 401) {
          cachedToken = null;
          tokenExpiry = 0;
        }
        return [];
      }

      const json = await response.json() as DigiKeySearchResponse;
      const products = json.Products ?? [];

      return products
        .filter(p => p.StandardPricing && p.StandardPricing.length > 0)
        .map((p): PartResult => {
          const priceTiers: PriceTier[] = p.StandardPricing
            .map(pb => ({
              qty:   pb.BreakQuantity,
              price: pb.UnitPrice,
            }))
            .filter(t => t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          // packageUnit: usa StandardPackage se > 1, altrimenti MinimumOrderQuantity
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

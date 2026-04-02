// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Digi-Key Adapter
//  Docs: https://developer.digikey.com/products/product-information-v4
//  Auth: OAuth2 Client Credentials (2-legged)
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const TOKEN_URL   = "https://api.digikey.com/v1/oauth2/token";
const SEARCH_URL  = "https://api.digikey.com/products/v4/search/keyword";
const CLIENT_ID   = process.env.DIGIKEY_CLIENT_ID ?? "";
const CLIENT_SEC  = process.env.DIGIKEY_CLIENT_SECRET ?? "";
const AFFILIATE   = process.env.DIGIKEY_AFFILIATE_PARAM ?? "";

// ── Simple in-memory token cache ─────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: number        = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SEC,
  });

  const res  = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`[DigiKey] Token error: ${res.status}`);

  const json    = await res.json();
  cachedToken   = json.access_token;
  tokenExpiry   = Date.now() + (json.expires_in - 60) * 1000; // 1 min buffer
  return cachedToken!;
}

export const DigikeyAdapter: DistributorAdapter = {
  name: "Digi-Key",

  async search(mpn: string, qty: number): Promise<PartResult[]> {
    if (!CLIENT_ID || !CLIENT_SEC) {
      console.warn("[DigiKey] credentials not set — skipping");
      return [];
    }

    try {
      const token = await getAccessToken();

      const res = await fetch(SEARCH_URL, {
        method:  "POST",
        headers: {
          "Content-Type":        "application/json",
          "Authorization":       `Bearer ${token}`,
          "X-DIGIKEY-Client-Id": CLIENT_ID,
          "X-DIGIKEY-Locale-Site":     "US",
          "X-DIGIKEY-Locale-Language": "en",
          "X-DIGIKEY-Locale-Currency": "USD",
        },
        body: JSON.stringify({
          Keywords:       mpn,
          Limit:          10,
          Offset:         0,
          FilterOptionsRequest: {
            ManufacturerFilter: [],
            MinimumQuantityAvailable: 1,
          },
        }),
        next: { revalidate: 300 },
      });

      if (!res.ok) return [];

      const data     = await res.json();
      const products = data?.Products ?? [];

      return products
        .filter((p: any) => (p.QuantityAvailable ?? 0) > 0)
        .map((p: any): PartResult => {
          const stock       = p.QuantityAvailable ?? 0;
          const packageUnit = p.MinimumOrderQuantity ?? 1;

          const priceTiers: PriceTier[] = (p.StandardPricing ?? []).map((pb: any) => ({
            qty:   pb.BreakQuantity,
            price: pb.UnitPrice,
          }));

          const productUrl = p.ProductUrl
            ? `${p.ProductUrl}${AFFILIATE}`
            : `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(mpn)}${AFFILIATE}`;

          return {
            distributor: "Digi-Key",
            mpn:         p.ManufacturerProductNumber ?? mpn,
            description: p.Description?.ProductDescription ?? "",
            stock,
            packageUnit,
            priceTiers,
            productUrl,
            currency:    "USD",
          };
        });
    } catch (err) {
      console.error("[DigiKey] search error:", err);
      return [];
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Mouser Adapter
//
//  API Docs: https://api.mouser.com/api-hub/
//  Auth:     API Key (header o query param)
//  Endpoint: POST https://api.mouser.com/api/v1/search/keyword
//
//  Env vars:
//    MOUSER_API_KEY         → la tua API key Mouser
//    MOUSER_AFFILIATE_PARAM → es. ?ref=XXXXX (opzionale)
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult, PriceTier } from "../types";

const BASE_URL        = "https://api.mouser.com/api/v1";
const AFFILIATE_PARAM = process.env.MOUSER_AFFILIATE_PARAM ?? "";

// ── Mouser API response types ─────────────────────────────────────────────────
interface MouserPriceBreak {
  Quantity: number;
  Price:    string;   // es. "0,3200 €" o "$0.3200"
  Currency: string;
}

interface MouserPart {
  ManufacturerPartNumber: string;
  Description:            string;
  Availability:           string;   // es. "12,400 In Stock"
  Min:                    string;   // quantità minima
  Mult:                   string;   // multiplo
  PriceBreaks:            MouserPriceBreak[];
  MouserPartNumber:       string;
  ProductDetailUrl:       string;
}

interface MouserApiResponse {
  SearchResults: {
    NumberOfResult: number;
    Parts:          MouserPart[];
  };
  Errors?: { Message: string }[];
}

// ── Parse prezzo Mouser (es. "0,3200 €" → 0.32) ──────────────────────────────
function parseMouserPrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Rimuovi simboli valuta e spazi, sostituisci virgola con punto
  const cleaned = priceStr
    .replace(/[€$£¥\s]/g, "")
    .replace(",", ".");
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

// ── Parse stock Mouser (es. "12,400 In Stock" → 12400) ───────────────────────
function parseMouserStock(availStr: string): number {
  if (!availStr) return 0;
  const match = availStr.match(/[\d,]+/);
  if (!match) return 0;
  return parseInt(match[0].replace(/,/g, ""), 10);
}

// ── Costruisci URL prodotto Mouser ────────────────────────────────────────────
function buildMouserUrl(part: MouserPart): string {
  const base = part.ProductDetailUrl
    ? `https://www.mouser.com${part.ProductDetailUrl}`
    : `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(part.ManufacturerPartNumber)}`;
  return AFFILIATE_PARAM ? `${base}${AFFILIATE_PARAM}` : base;
}

// ── Mouser Adapter ────────────────────────────────────────────────────────────
export const MouserAdapter: DistributorAdapter = {
  name: "Mouser",

  async search(mpn: string, _qty: number): Promise<PartResult[]> {
    const apiKey = process.env.MOUSER_API_KEY;
    if (!apiKey || apiKey === "placeholder") return [];

    try {
      const response = await fetch(
        `${BASE_URL}/search/keyword?apiKey=${apiKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            SearchByKeywordRequest: {
              keyword:       mpn,
              records:       10,
              startingRecord: 0,
              searchOptions: "6",   // 6 = cerca per MPN esatto
              searchWithYourSignUpLanguage: "false",
            },
          }),
        }
      );

      if (!response.ok) {
        console.error(`[Mouser] HTTP ${response.status}`);
        return [];
      }

      const json = await response.json() as MouserApiResponse;

      if (json.Errors && json.Errors.length > 0) {
        console.error("[Mouser] API error:", json.Errors[0].Message);
        return [];
      }

      const parts = json.SearchResults?.Parts ?? [];

      return parts
        .filter(p => p.PriceBreaks && p.PriceBreaks.length > 0)
        .map((p): PartResult => {
          const priceTiers: PriceTier[] = p.PriceBreaks
            .map(pb => ({
              qty:   pb.Quantity,
              price: parseMouserPrice(pb.Price),
            }))
            .filter(t => t.price > 0)
            .sort((a, b) => a.qty - b.qty);

          const currency = p.PriceBreaks[0]?.Currency ?? "USD";
          const stock    = parseMouserStock(p.Availability);
          const minQty   = parseInt(p.Min  || "1", 10) || 1;
          const multQty  = parseInt(p.Mult || "1", 10) || 1;
          const packageUnit = Math.max(minQty, multQty);

          return {
            mpn:         p.ManufacturerPartNumber,
            description: p.Description,
            stock,
            packageUnit,
            priceTiers,
            productUrl:  buildMouserUrl(p),
            currency,
            distributor: "Mouser",
          };
        });

    } catch (err) {
      console.error(`[Mouser] Error searching ${mpn}:`, err);
      return [];
    }
  },
};

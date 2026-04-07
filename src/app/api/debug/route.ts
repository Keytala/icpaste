import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mousserKey    = process.env.MOUSER_API_KEY;
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;

  // ── Mouser ────────────────────────────────────────────────────────────────
  let mouserResult: unknown = "not tested";
  if (mousserKey && mousserKey !== "placeholder") {
    try {
      const res  = await fetch(
        `https://api.mouser.com/api/v1/search/keyword?apiKey=${mousserKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            SearchByKeywordRequest: {
              keyword:        "LM358N",
              records:        3,
              startingRecord: 0,
              searchOptions:  "2",
              searchWithYourSignUpLanguage: "false",
            },
          }),
        }
      );
      const json = await res.json();
      mouserResult = {
        status:        res.status,
        numberOfResult: json?.SearchResults?.NumberOfResult,
        firstPart: json?.SearchResults?.Parts?.[0] ? {
          mpn:         json.SearchResults.Parts[0].ManufacturerPartNumber,
          stock:       json.SearchResults.Parts[0].Availability,
          min:         json.SearchResults.Parts[0].Min,
          mult:        json.SearchResults.Parts[0].Mult,
          priceBreaks: json.SearchResults.Parts[0].PriceBreaks?.slice(0, 3),
        } : "no parts",
      };
    } catch (e: unknown) {
      mouserResult = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── DigiKey — risposta completa del primo prodotto ────────────────────────
  let digikeyResult: unknown = "not tested";
  if (digikeyId && digikeySecret &&
      digikeyId !== "placeholder" && digikeySecret !== "placeholder") {
    try {
      // Token
      const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     digikeyId,
          client_secret: digikeySecret,
          grant_type:    "client_credentials",
        }),
      });
      const tokenJson = await tokenRes.json();
      const token     = tokenJson.access_token;

      // Search
      const searchRes = await fetch(
        "https://api.digikey.com/products/v4/search/keyword",
        {
          method:  "POST",
          headers: {
            "Content-Type":              "application/json",
            "Accept":                    "application/json",
            "Authorization":             `Bearer ${token}`,
            "X-DIGIKEY-Client-Id":       digikeyId,
            "X-DIGIKEY-Locale-Site":     "IT",
            "X-DIGIKEY-Locale-Language": "it",
            "X-DIGIKEY-Locale-Currency": "EUR",
          },
          body: JSON.stringify({
            Keywords:          "LM358N",
            RecordCount:       3,
            RecordStartPos:    0,
            RequestedQuantity: 100,
            SearchOptions:     ["ManufacturerPartSearch"],
          }),
        }
      );
      const json = await searchRes.json();

      // Mostra struttura completa del primo prodotto
      const firstProduct = json?.Products?.[0];
      digikeyResult = {
        status:         searchRes.status,
        totalResults:   json?.TotalResultCount,
        productsCount:  json?.Products?.length,
        firstProduct:   firstProduct ? {
          mpn:              firstProduct.ManufacturerProductNumber,
          description:      firstProduct.Description,
          quantityAvailable: firstProduct.QuantityAvailable,
          minimumOrderQty:  firstProduct.MinimumOrderQuantity,
          standardPackage:  firstProduct.StandardPackage,
          unitPrice:        firstProduct.UnitPrice,
          currency:         firstProduct.Currency,
          productUrl:       firstProduct.ProductUrl,
          // Mostra la struttura dei price breaks
          standardPricing:  firstProduct.StandardPricing?.slice(0, 4),
          // Mostra anche ProductVariations per capire la struttura
          variationsCount:  firstProduct.ProductVariations?.length,
          firstVariation:   firstProduct.ProductVariations?.[0] ? {
            digiKeyPartNumber: firstProduct.ProductVariations[0].DigiKeyProductNumber,
            packageType:       firstProduct.ProductVariations[0].PackageType,
            standardPricing:   firstProduct.ProductVariations[0].StandardPricing?.slice(0, 3),
          } : null,
        } : "no products",
        // Mostra eventuali errori
        errors: json?.Errors ?? null,
      };
    } catch (e: unknown) {
      digikeyResult = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    mouser:  mouserResult,
    digikey: digikeyResult,
  });
}

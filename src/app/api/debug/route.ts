import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;

  if (!digikeyId || !digikeySecret) {
    return NextResponse.json({ error: "DigiKey credentials missing" });
  }

  try {
    // ── 1. Token ─────────────────────────────────────────────────────────────
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

    // ── 2. Search ─────────────────────────────────────────────────────────────
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
    const p    = json?.Products?.[0];

    if (!p) {
      return NextResponse.json({ error: "No products returned", raw: json });
    }

    // ── 3. Mostra struttura completa del primo prodotto ───────────────────────
    return NextResponse.json({
      status:           searchRes.status,
      totalResults:     json.TotalResultCount,
      firstProduct: {
        mpn:              p.ManufacturerProductNumber,
        quantityAvailable: p.QuantityAvailable,
        minimumOrderQty:  p.MinimumOrderQuantity,
        standardPackage:  p.StandardPackage,
        unitPrice:        p.UnitPrice,
        currency:         p.Currency,

        // Root StandardPricing
        rootStandardPricing: p.StandardPricing ?? "undefined",

        // ProductVariations
        variationsCount:  p.ProductVariations?.length ?? 0,
        variations: (p.ProductVariations ?? []).map((v: {
          DigiKeyProductNumber: string;
          PackageType:          { Name: string };
          QuantityAvailable:    number;
          StandardPricing:      { BreakQuantity: number; UnitPrice: number }[];
        }) => ({
          partNumber:      v.DigiKeyProductNumber,
          packageType:     v.PackageType?.Name,
          qty:             v.QuantityAvailable,
          standardPricing: v.StandardPricing,
        })),
      },
    });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;

  if (!digikeyId || !digikeySecret) {
    return NextResponse.json({ error: "DigiKey credentials missing" });
  }

  try {
    // ── Token ─────────────────────────────────────────────────────────────────
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

    // ── Search ────────────────────────────────────────────────────────────────
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
    const v    = p?.ProductVariations?.[0];

    // ── Mostra TUTTE le chiavi del prodotto e della variazione ────────────────
    return NextResponse.json({
      productKeys:   p ? Object.keys(p) : [],
      variationKeys: v ? Object.keys(v) : [],
      // Mostra il valore esatto di ogni campo pricing
      pricing: {
        "p.StandardPricing":          p?.StandardPricing,
        "p.standardPricing":          p?.standardPricing,
        "v.StandardPricing":          v?.StandardPricing,
        "v.standardPricing":          v?.standardPricing,
        "v.MyPricing":                v?.MyPricing,
        "p.UnitPrice":                p?.UnitPrice,
        // Dump completo della variazione per vedere tutti i campi
        fullVariation:                v,
      },
    });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;
  const useMock       = process.env.NEXT_PUBLIC_USE_MOCK;
  const mousserKey    = process.env.MOUSER_API_KEY;

  // ── Mostra variabili ambiente ─────────────────────────────────────────────
  const env = {
    NEXT_PUBLIC_USE_MOCK: useMock,
    MOUSER_API_KEY:       mousserKey    ? `set (${mousserKey.slice(0,8)}...)` : "❌ missing",
    DIGIKEY_CLIENT_ID:    digikeyId     ? `set (${digikeyId.slice(0,8)}...)` : "❌ missing",
    DIGIKEY_CLIENT_SECRET:digikeySecret ? `set (${digikeySecret.slice(0,8)}...)` : "❌ missing",
    // Controlla se USE_MOCK viene calcolato correttamente
    USE_MOCK_COMPUTED:
      useMock === "true"              ? "true (env var)" :
      !mousserKey                     ? "true (no mouser key)" :
      mousserKey === "placeholder"    ? "true (placeholder)" :
      "false → using REAL adapters",
  };

  // ── Test DigiKey da zero, senza usare l'adapter ───────────────────────────
  let digikeyRaw: unknown = "not tested";
  if (digikeyId && digikeySecret) {
    try {
      // Token
      const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     digikeyId,
          client_secret: digikeySecret,
          grant_type:    "client_credentials",
        }),
      });
      const { access_token } = await tokenRes.json();

      // Search
      const res = await fetch("https://api.digikey.com/products/v4/search/keyword", {
        method: "POST",
        headers: {
          "Content-Type":              "application/json",
          "Accept":                    "application/json",
          "Authorization":             `Bearer ${access_token}`,
          "X-DIGIKEY-Client-Id":       digikeyId,
          "X-DIGIKEY-Locale-Site":     "IT",
          "X-DIGIKEY-Locale-Language": "it",
          "X-DIGIKEY-Locale-Currency": "EUR",
        },
        body: JSON.stringify({
          Keywords:          "LM358N",
          RecordCount:       2,
          RecordStartPos:    0,
          RequestedQuantity: 100,
          SearchOptions:     ["ManufacturerPartSearch"],
        }),
      });

      const json = await res.json();
      const p    = json?.Products?.[0];
      const v    = p?.ProductVariations?.[0];

      digikeyRaw = {
        status:           res.status,
        productsCount:    json?.Products?.length ?? 0,
        firstMpn:         p?.ManufacturerProductNumber,
        variationsCount:  p?.ProductVariations?.length ?? 0,
        // Mostra esattamente le chiavi della variazione
        variationKeys:    v ? Object.keys(v) : [],
        // Mostra i prezzi con il nome esatto del campo
        pricingFieldName: v ? (
          v.StandardPricing  ? "StandardPricing (found!)" :
          v.standardPricing  ? "standardPricing (found!)" :
          "NOT FOUND in variation"
        ) : "no variation",
        pricingData:      v?.StandardPricing ?? v?.standardPricing ?? null,
        stock:            v?.QuantityAvailableforPackageType ?? p?.QuantityAvailable ?? 0,
        packageUnit:      v?.StandardPackage ?? v?.MinimumOrderQuantity ?? 1,
      };

    } catch (e: unknown) {
      digikeyRaw = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── Test adapter direttamente ─────────────────────────────────────────────
  let adapterTest: unknown = "not tested";
  try {
    const { DigikeyAdapter } = await import("@/lib/adapters/digikey.adapter");
    const results = await DigikeyAdapter.search("LM358N", 100);
    adapterTest = {
      count:       results.length,
      firstResult: results[0] ?? null,
    };
  } catch (e: unknown) {
    adapterTest = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ env, digikeyRaw, adapterTest });
}

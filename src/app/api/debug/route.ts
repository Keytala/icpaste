/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const id     = process.env.DIGIKEY_CLIENT_ID!;
  const secret = process.env.DIGIKEY_CLIENT_SECRET!;

  try {
    // ── Step 1: Token ─────────────────────────────────────────────────────
    const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id, client_secret: secret, grant_type: "client_credentials",
      }),
    });
    const { access_token } = await tokenRes.json();

    // ── Step 2: Search ────────────────────────────────────────────────────
    const res = await fetch("https://api.digikey.com/products/v4/search/keyword", {
      method: "POST",
      headers: {
        "Content-Type":              "application/json",
        "Accept":                    "application/json",
        "Authorization":             `Bearer ${access_token}`,
        "X-DIGIKEY-Client-Id":       id,
        "X-DIGIKEY-Locale-Site":     "IT",
        "X-DIGIKEY-Locale-Language": "it",
        "X-DIGIKEY-Locale-Currency": "EUR",
      },
      body: JSON.stringify({
        Keywords: "LM358N", RecordCount: 2, RecordStartPos: 0,
        RequestedQuantity: 100, SearchOptions: ["ManufacturerPartSearch"],
      }),
    });

    const json: any = await res.json();

    // ── Step 3: Simula esattamente il loop dell'adapter ───────────────────
    const results: any[] = [];
    const debugSteps: any[] = [];

    for (const p of (json?.Products ?? [])) {
      const variations = p?.ProductVariations ?? [];
      debugSteps.push({
        mpn:            p?.ManufacturerProductNumber,
        variationsCount: variations.length,
      });

      for (const v of variations) {
        const pricing: any[] = v?.StandardPricing ?? [];

        debugSteps.push({
          step:           "variation",
          pricingLength:  pricing.length,
          pricingIsArray: Array.isArray(pricing),
          firstPrice:     pricing[0] ?? null,
          stock:          v?.QuantityAvailableforPackageType,
          packageUnit:    v?.StandardPackage,
        });

        if (!pricing.length) {
          debugSteps.push({ step: "SKIPPED — no pricing" });
          continue;
        }

        const priceTiers = pricing
          .map((pb: any) => ({ qty: Number(pb.BreakQuantity), price: Number(pb.UnitPrice) }))
          .filter((t: any) => t.qty > 0 && t.price > 0)
          .sort((a: any, b: any) => a.qty - b.qty);

        debugSteps.push({
          step:           "priceTiers built",
          priceTiersCount: priceTiers.length,
          firstTier:      priceTiers[0] ?? null,
        });

        if (!priceTiers.length) {
          debugSteps.push({ step: "SKIPPED — priceTiers empty after filter" });
          continue;
        }

        results.push({
          mpn:         p?.ManufacturerProductNumber,
          stock:       Number(v?.QuantityAvailableforPackageType ?? 0),
          packageUnit: Number(v?.StandardPackage ?? 1),
          priceTiers:  priceTiers.slice(0, 2),
        });

        debugSteps.push({ step: "ADDED to results ✅" });
      }
    }

    // ── Step 4: Controlla se PartResult type causa problemi ───────────────
    // Importa il tipo e verifica che il push non fallisca silenziosamente
    const { DigikeyAdapter } = await import("@/lib/adapters/digikey.adapter");
    const adapterResults = await DigikeyAdapter.search("LM358N", 100);

    return NextResponse.json({
      rawLoopResults:   results.length,
      adapterResults:   adapterResults.length,
      debugSteps,
      // Se i due count sono diversi il problema è nel tipo PartResult
      mismatch:         results.length !== adapterResults.length,
      adapterFirst:     adapterResults[0] ?? null,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.slice(0, 300) });
  }
}

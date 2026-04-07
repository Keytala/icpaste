import { NextResponse } from "next/server";
import { DigikeyAdapter } from "@/lib/adapters/digikey.adapter";
import { distributors }   from "@/lib/adapters";

export const runtime = "nodejs";

export async function GET() {
  try {
    // ── 1. Test adapter DigiKey direttamente ──────────────────────────────
    const digikeyResults = await DigikeyAdapter.search("LM358N", 100);

    // ── 2. Lista distributori attivi ──────────────────────────────────────
    const activeDistributors = distributors.map(d => d.name);

    // ── 3. Test tutti i distributori attivi ───────────────────────────────
    const allResults = await Promise.all(
      distributors.map(async d => {
        const results = await d.search("LM358N", 100);
        return {
          distributor: d.name,
          count:       results.length,
          firstResult: results[0] ? {
            mpn:         results[0].mpn,
            stock:       results[0].stock,
            packageUnit: results[0].packageUnit,
            priceTiers:  results[0].priceTiers.slice(0, 3),
            currency:    results[0].currency,
          } : null,
        };
      })
    );

    return NextResponse.json({
      activeDistributors,
      digikeyDirectTest: {
        count:       digikeyResults.length,
        firstResult: digikeyResults[0] ?? null,
      },
      allDistributors: allResults,
    });

  } catch (e: unknown) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.slice(0, 500) : null,
    });
  }
}

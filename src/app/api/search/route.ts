/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { BomRow, ResultRow, SearchResponse, PriceTier } from "@/lib/types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITY — Price calculator
// ─────────────────────────────────────────────────────────────────────────────

function getBestPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
  let best = sorted[0].price;
  for (const t of sorted) {
    if (qty >= t.qty) best = t.price;
  }
  return best;
}

function calcOptimal(
  requestedQty: number,
  packageUnit:  number,
  stock:        number,
  tiers:        PriceTier[]
): {
  qty:        number;
  unitPrice:  number;
  totalPrice: number;
  feasible:   boolean;
  adjustment: "none" | "package" | "pricestep" | "both";
  saved:      number;
} {
  const unit   = Math.max(packageUnit, 1);
  const pkgQty = Math.ceil(requestedQty / unit) * unit;

  // Candidati: qty originale, arrotondata al package, scaglioni superiori
  const candidates = new Set<number>();
  candidates.add(requestedQty);
  candidates.add(pkgQty);
  for (const t of tiers) {
    if (t.qty > requestedQty) {
      candidates.add(Math.ceil(t.qty / unit) * unit);
    }
  }

  const scored = Array.from(candidates)
    .map(q => ({
      qty:      q,
      price:    getBestPrice(tiers, q),
      total:    parseFloat((getBestPrice(tiers, q) * q).toFixed(2)),
      feasible: stock >= q,
      isPkg:    q === pkgQty && q !== requestedQty,
      isStep:   tiers.some(t => t.qty > requestedQty && Math.ceil(t.qty / unit) * unit === q),
    }))
    .filter(c => c.price > 0);

  if (!scored.length) {
    const p = getBestPrice(tiers, requestedQty);
    return {
      qty: requestedQty, unitPrice: p,
      totalPrice: parseFloat((p * requestedQty).toFixed(2)),
      feasible: stock >= requestedQty, adjustment: "none", saved: 0,
    };
  }

  // Preferisci feasible, poi più economico
  const feasible = scored.filter(c => c.feasible);
  const pool     = feasible.length ? feasible : scored;
  pool.sort((a, b) => a.total - b.total);
  const w = pool[0];

  const origTotal = parseFloat((getBestPrice(tiers, requestedQty) * requestedQty).toFixed(2));
  const saved     = parseFloat((origTotal - w.total).toFixed(2));

  let adjustment: "none" | "package" | "pricestep" | "both" = "none";
  if (w.isPkg && w.isStep) adjustment = "both";
  else if (w.isPkg)        adjustment = "package";
  else if (w.isStep)       adjustment = "pricestep";

  return {
    qty:        w.qty,
    unitPrice:  w.price,
    totalPrice: w.total,
    feasible:   w.feasible,
    adjustment,
    saved:      saved > 0 ? saved : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  DISTRIBUTORS
//  Per aggiungere un nuovo distributore:
//  1. Crea una funzione async search[NomeDistributore](mpn, qty)
//  2. Aggiungila all'array DISTRIBUTORS in fondo a questa sezione
//  3. Fine — il sistema la chiamerà automaticamente
// ─────────────────────────────────────────────────────────────────────────────

// ── Mouser ────────────────────────────────────────────────────────────────────
async function searchMouser(mpn: string, qty: number): Promise<any[]> {
  const key = process.env.MOUSER_API_KEY;
  if (!key || key === "placeholder") return [];

  try {
    const res = await fetch(
      `https://api.mouser.com/api/v1/search/keyword?apiKey=${key}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          SearchByKeywordRequest: {
            keyword:        mpn,
            records:        10,
            startingRecord: 0,
            searchOptions:  "2",
            searchWithYourSignUpLanguage: "false",
          },
        }),
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const parts: any[] = json?.SearchResults?.Parts ?? [];

    return parts
      .filter((p: any) => p?.PriceBreaks?.length > 0)
      .map((p: any) => {
        const tiers: PriceTier[] = (p.PriceBreaks ?? [])
          .map((pb: any) => ({
            qty:   Number(pb.Quantity),
            price: parseFloat(String(pb.Price ?? "0").replace(/[^0-9.]/g, "")),
          }))
          .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
          .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

        const avail = String(p.Availability ?? "");
        const stock = parseInt(avail.replace(/[^0-9]/g, "") || "0", 10);
        const url   = p.ProductDetailUrl
          ? `https://www.mouser.com${p.ProductDetailUrl}`
          : `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(mpn)}`;

        return {
          distributor: "Mouser",
          mpn:         String(p.ManufacturerPartNumber ?? mpn),
          description: String(p.Description ?? ""),
          stock,
          packageUnit: Math.max(
            parseInt(String(p.Mult ?? "1"), 10) || 1,
            parseInt(String(p.Min  ?? "1"), 10) || 1
          ),
          priceTiers:  tiers,
          productUrl:  url,
          currency:    String(p.PriceBreaks?.[0]?.Currency ?? "USD"),
        };
      });
  } catch (e) {
    console.error("[Mouser] Error:", e);
    return [];
  }
}

// ── Digi-Key ──────────────────────────────────────────────────────────────────
async function searchDigikey(mpn: string, qty: number): Promise<any[]> {
  const id     = process.env.DIGIKEY_CLIENT_ID;
  const secret = process.env.DIGIKEY_CLIENT_SECRET;
  if (!id || !secret || id === "placeholder") return [];

  try {
    // Token
    const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     id,
        client_secret: secret,
        grant_type:    "client_credentials",
      }),
    });
    if (!tokenRes.ok) return [];
    const { access_token } = await tokenRes.json();
    if (!access_token) return [];

    // Search
    const searchRes = await fetch("https://api.digikey.com/products/v4/search/keyword", {
      method:  "POST",
      headers: {
        "Content-Type":              "application/json",
        "Accept":                    "application/json",
        "Authorization":             `Bearer ${access_token}`,
        "X-DIGIKEY-Client-Id":       id,
        "X-DIGIKEY-Locale-Site":     process.env.DIGIKEY_LOCALE_SITE     ?? "IT",
        "X-DIGIKEY-Locale-Language": process.env.DIGIKEY_LOCALE_LANGUAGE ?? "it",
        "X-DIGIKEY-Locale-Currency": process.env.DIGIKEY_LOCALE_CURRENCY ?? "EUR",
      },
      body: JSON.stringify({
        Keywords:          mpn,
        RecordCount:       10,
        RecordStartPos:    0,
        RequestedQuantity: qty,
        SearchOptions:     ["ManufacturerPartSearch"],
        SortOptions:       [{ Field: "UnitPrice", SortOrder: "Ascending" }],
      }),
    });
    if (!searchRes.ok) return [];
    const json = await searchRes.json();

    const results: any[] = [];
    for (const p of (json?.Products ?? [])) {
      for (const v of (p?.ProductVariations ?? [])) {
        const pricing: any[] = v?.StandardPricing ?? [];
        if (!pricing.length) continue;

        const tiers: PriceTier[] = pricing
          .map((pb: any) => ({
            qty:   Number(pb.BreakQuantity),
            price: Number(pb.UnitPrice),
          }))
          .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
          .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);
        if (!tiers.length) continue;

        const stock   = Number(v.QuantityAvailableforPackageType ?? p.QuantityAvailable ?? 0);
        const stdPkg  = Number(v.StandardPackage ?? 0);
        const moq     = Number(v.MinimumOrderQuantity ?? 1);
        const pkgUnit = stdPkg > 1 ? stdPkg : (moq > 0 ? moq : 1);
        const url     = String(p.ProductUrl ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(mpn)}`);

        results.push({
          distributor: "Digi-Key",
          mpn:         String(p.ManufacturerProductNumber ?? mpn),
          description: String(p.Description?.ProductDescription ?? ""),
          stock,
          packageUnit: pkgUnit,
          priceTiers:  tiers,
          productUrl:  url,
          currency:    String(p.Currency ?? "EUR"),
        });
      }
    }
    return results;
  } catch (e) {
    console.error("[DigiKey] Error:", e);
    return [];
  }
}

// ── Farnell ───────────────────────────────────────────────────────────────────
async function searchFarnell(mpn: string, _qty: number): Promise<any[]> {
  const key = process.env.FARNELL_API_KEY;
  if (!key || key === "placeholder") return [];

  try {
    const params = new URLSearchParams({
      "term":                            `manuPartNum:${mpn}`,
      "storeInfo.id":                    process.env.FARNELL_STORE ?? "it.farnell.com",
      "storeInfo.type":                  "global",
      "storeInfo.locale":                "it_IT",
      "resultsSettings.offset":          "0",
      "resultsSettings.numberOfResults": "10",
      "resultsSettings.sortBy":          "unitPrice",
      "resultsSettings.sortOrder":       "asc",
      "callInfo.responseDataFormat":     "json",
      "userinfo.apiKey":                 key,
    });

    const res = await fetch(
      `https://api.element14.com/catalog/products?${params.toString()}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return [];
    const json = await res.json();

    const products: any[] =
      json?.manufacturerPartNumberSearchReturn?.products ??
      json?.keywordSearchReturn?.products ?? [];

    return products
      .filter((p: any) => p?.prices?.length > 0)
      .map((p: any) => {
        const tiers: PriceTier[] = (p.prices ?? [])
          .map((pb: any) => ({ qty: Number(pb.from), price: Number(pb.cost) }))
          .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
          .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

        const store = process.env.FARNELL_STORE ?? "it.farnell.com";
        const url   = p.productURL
          ? `https://${store}${p.productURL}`
          : `https://${store}/search?st=${encodeURIComponent(p.sku ?? mpn)}`;

        return {
          distributor: "Farnell",
          mpn:         String(p.translatedManufacturerPartNumberList?.[0]?.manufacturerPartNumber ?? mpn),
          description: String(p.displayName ?? ""),
          stock:       Number(p.stock?.level ?? 0),
          packageUnit: Number(p.packSize ?? 1) > 1 ? Number(p.packSize) : Number(p.minimumOrderQty ?? 1),
          priceTiers:  tiers,
          productUrl:  url,
          currency:    String(p.currency ?? "EUR"),
        };
      });
  } catch (e) {
    console.error("[Farnell] Error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTRY — aggiungi qui i nuovi distributori
//  Formato: { name: string, fn: (mpn, qty) => Promise<any[]> }
// ─────────────────────────────────────────────────────────────────────────────

const DISTRIBUTORS = [
  { name: "Mouser",   fn: searchMouser   },
  { name: "Digi-Key", fn: searchDigikey  },
  { name: "Farnell",  fn: searchFarnell  },
  // { name: "TME",   fn: searchTME      },  // ← aggiungi così
  // { name: "RS",    fn: searchRS       },  // ← aggiungi così
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ROUTE
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bom: BomRow[] = Array.isArray(body.bom) ? body.bom : [];

    if (!bom.length) {
      return NextResponse.json({ error: "Empty BOM" }, { status: 400 });
    }
    if (bom.length > 1000) {
      return NextResponse.json({ error: "Max 1000 rows" }, { status: 400 });
    }

    const results: ResultRow[] = await Promise.all(
      bom.map(async (row): Promise<ResultRow> => {
        const { mpn, qty } = row;

        // Chiama tutti i distributori in parallelo
        const allParts = (
          await Promise.all(
            DISTRIBUTORS.map(d => d.fn(mpn, qty).catch(() => []))
          )
        ).flat();

        console.log(`[Search] ${mpn} qty=${qty} → ${allParts.length} total results`);

        if (!allParts.length) {
          return {
            mpn, description: "", requestedQty: qty, optimalQty: qty,
            unitPrice: 0, totalPrice: 0, currency: "USD",
            distributor: "—", stock: 0, productUrl: "",
            adjustment: "none", saved: 0, error: "Not found",
          };
        }

        // Ottimizza quantità per ogni parte
        const optimized = allParts
          .map(p => {
            const opt = calcOptimal(qty, p.packageUnit, p.stock, p.priceTiers);
            return { ...p, ...opt };
          })
          .filter(p => p.unitPrice > 0);

        if (!optimized.length) {
          return {
            mpn, description: "", requestedQty: qty, optimalQty: qty,
            unitPrice: 0, totalPrice: 0, currency: "USD",
            distributor: "—", stock: 0, productUrl: "",
            adjustment: "none", saved: 0, error: "No pricing data",
          };
        }

        // Separa con stock e senza stock
        const withStock    = optimized.filter(p => p.feasible);
        const withoutStock = optimized.filter(p => !p.feasible);

        // Case A: almeno uno ha stock → prendi il più economico
        if (withStock.length > 0) {
          withStock.sort((a, b) => a.totalPrice - b.totalPrice);
          const w = withStock[0];
          return {
            mpn:          w.mpn,
            description:  w.description,
            requestedQty: qty,
            optimalQty:   w.qty,
            unitPrice:    w.unitPrice,
            totalPrice:   w.totalPrice,
            currency:     w.currency,
            distributor:  w.distributor,
            stock:        w.stock,
            productUrl:   w.productUrl,
            adjustment:   w.adjustment,
            saved:        w.saved,
          };
        }

        // Case B: nessuno ha stock → mostra il più economico + fallback
        withoutStock.sort((a, b) => a.totalPrice - b.totalPrice);
        const cheapest = withoutStock[0];

        // Cerca fallback tra chi ha stock parziale
        const partialStock = allParts
          .filter(p => p.stock > 0)
          .map(p => {
            const opt = calcOptimal(
              Math.min(qty, p.stock),
              p.packageUnit,
              p.stock,
              p.priceTiers
            );
            return { ...p, ...opt };
          })
          .filter(p => p.unitPrice > 0)
          .sort((a, b) => a.totalPrice - b.totalPrice);

        return {
          mpn:          cheapest.mpn,
          description:  cheapest.description,
          requestedQty: qty,
          optimalQty:   cheapest.qty,
          unitPrice:    cheapest.unitPrice,
          totalPrice:   cheapest.totalPrice,
          currency:     cheapest.currency,
          distributor:  cheapest.distributor,
          stock:        cheapest.stock,
          productUrl:   cheapest.productUrl,
          adjustment:   cheapest.adjustment,
          saved:        cheapest.saved,
          error:        "Out of stock",
          fallback:     partialStock.length > 0 ? {
            distributor: partialStock[0].distributor,
            optimalQty:  partialStock[0].qty,
            unitPrice:   partialStock[0].unitPrice,
            totalPrice:  partialStock[0].totalPrice,
            stock:       partialStock[0].stock,
            productUrl:  partialStock[0].productUrl,
            currency:    partialStock[0].currency,
          } : undefined,
        };
      })
    );

    const totalBom = parseFloat(
      results.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2)
    );

    const response: SearchResponse = {
      results,
      totalBom,
      searchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (err) {
    console.error("[Search] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

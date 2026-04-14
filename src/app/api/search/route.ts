/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { parseBom }                  from "@/lib/bom-parser";
import type { BomRow, ResultRow, SearchResponse, PriceTier } from "@/lib/types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getBestPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
  let best = sorted[0].price;
  for (const t of sorted) { if (qty >= t.qty) best = t.price; }
  return best;
}

function calcOptimal(requestedQty: number, packageUnit: number, stock: number, tiers: PriceTier[]) {
  const unit   = Math.max(packageUnit, 1);
  const pkgQty = Math.ceil(requestedQty / unit) * unit;

  const candidates = new Set<number>();
  candidates.add(requestedQty);
  candidates.add(pkgQty);
  for (const t of tiers) {
    if (t.qty > requestedQty) candidates.add(Math.ceil(t.qty / unit) * unit);
  }

  const scored = Array.from(candidates).map(q => ({
    qty:      q,
    price:    getBestPrice(tiers, q),
    total:    parseFloat((getBestPrice(tiers, q) * q).toFixed(2)),
    feasible: stock >= q,
    isPkg:    q === pkgQty && q !== requestedQty,
    isStep:   tiers.some(t => t.qty > requestedQty && Math.ceil(t.qty / unit) * unit === q),
  })).filter(c => c.price > 0);

  if (!scored.length) {
    const p = getBestPrice(tiers, requestedQty);
    return { qty: requestedQty, unitPrice: p, totalPrice: parseFloat((p * requestedQty).toFixed(2)), feasible: stock >= requestedQty, adjustment: "none" as const, saved: 0 };
  }

  const feasible = scored.filter(c => c.feasible);
  const pool     = feasible.length ? feasible : scored;
  pool.sort((a, b) => a.total - b.total);
  const w = pool[0];

  const origTotal = parseFloat((getBestPrice(tiers, requestedQty) * requestedQty).toFixed(2));
  const saved     = parseFloat((origTotal - w.total).toFixed(2));

  const adjustment =
    w.isPkg && w.isStep ? "both"      :
    w.isPkg             ? "package"   :
    w.isStep            ? "pricestep" : "none";

  return {
    qty:        w.qty,
    unitPrice:  w.price,
    totalPrice: w.total,
    feasible:   w.feasible,
    adjustment: adjustment as "none" | "package" | "pricestep" | "both",
    saved:      saved > 0 ? saved : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOUSER
// ─────────────────────────────────────────────────────────────────────────────

async function searchMouser(mpn: string, qty: number): Promise<any[]> {
  const key = process.env.MOUSER_API_KEY;
  if (!key || key === "placeholder") return [];
  try {
    const res = await fetch(`https://api.mouser.com/api/v1/search/keyword?apiKey=${key}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SearchByKeywordRequest: {
          keyword: mpn, records: 10, startingRecord: 0,
          searchOptions: "2", searchWithYourSignUpLanguage: "false",
        },
      }),
    });
    if (!res.ok) return [];
    const json  = await res.json();
    const parts: any[] = json?.SearchResults?.Parts ?? [];
    return parts.filter((p: any) => p?.PriceBreaks?.length > 0).map((p: any) => {
      const tiers: PriceTier[] = (p.PriceBreaks ?? [])
        .map((pb: any) => ({ qty: Number(pb.Quantity), price: parseFloat(String(pb.Price ?? "0").replace(/[^0-9.]/g, "")) }))
        .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
        .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);
      const stock = parseInt(String(p.Availability ?? "").replace(/[^0-9]/g, "") || "0", 10);
      const url   = p.ProductDetailUrl ? `https://www.mouser.com${p.ProductDetailUrl}` : `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(mpn)}`;
      return {
        distributor: "Mouser", mpn: String(p.ManufacturerPartNumber ?? mpn),
        description: String(p.Description ?? ""), stock,
        packageUnit: Math.max(parseInt(String(p.Mult ?? "1"), 10) || 1, parseInt(String(p.Min ?? "1"), 10) || 1),
        priceTiers: tiers, productUrl: url, currency: String(p.PriceBreaks?.[0]?.Currency ?? "USD"),
      };
    });
  } catch (e) { console.error("[Mouser]", e); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DIGI-KEY
// ─────────────────────────────────────────────────────────────────────────────

async function searchDigikey(mpn: string, qty: number): Promise<any[]> {
  const id     = process.env.DIGIKEY_CLIENT_ID;
  const secret = process.env.DIGIKEY_CLIENT_SECRET;
  if (!id || !secret || id === "placeholder") return [];
  try {
    const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
    });
    if (!tokenRes.ok) return [];
    const { access_token } = await tokenRes.json();
    if (!access_token) return [];

    const searchRes = await fetch("https://api.digikey.com/products/v4/search/keyword", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "Accept": "application/json",
        "Authorization": `Bearer ${access_token}`, "X-DIGIKEY-Client-Id": id,
        "X-DIGIKEY-Locale-Site": process.env.DIGIKEY_LOCALE_SITE ?? "IT",
        "X-DIGIKEY-Locale-Language": process.env.DIGIKEY_LOCALE_LANGUAGE ?? "it",
        "X-DIGIKEY-Locale-Currency": process.env.DIGIKEY_LOCALE_CURRENCY ?? "EUR",
      },
      body: JSON.stringify({
        Keywords: mpn, RecordCount: 10, RecordStartPos: 0,
        RequestedQuantity: qty, SearchOptions: ["ManufacturerPartSearch"],
        SortOptions: [{ Field: "UnitPrice", SortOrder: "Ascending" }],
      }),
    });
    if (!searchRes.ok) return [];
    const json    = await searchRes.json();
    const output: any[] = [];
    for (const p of (json?.Products ?? [])) {
      for (const v of (p?.ProductVariations ?? [])) {
        const pricing: any[] = v?.StandardPricing ?? [];
        if (!pricing.length) continue;
        const tiers: PriceTier[] = pricing
          .map((pb: any) => ({ qty: Number(pb.BreakQuantity), price: Number(pb.UnitPrice) }))
          .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
          .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);
        if (!tiers.length) continue;
        const stock   = Number(v.QuantityAvailableforPackageType ?? p.QuantityAvailable ?? 0);
        const stdPkg  = Number(v.StandardPackage ?? 0);
        const moq     = Number(v.MinimumOrderQuantity ?? 1);
        const pkgUnit = stdPkg > 1 ? stdPkg : (moq > 0 ? moq : 1);
        output.push({
          distributor: "Digi-Key", mpn: String(p.ManufacturerProductNumber ?? mpn),
          description: String(p.Description?.ProductDescription ?? ""), stock, packageUnit: pkgUnit,
          priceTiers: tiers, productUrl: String(p.ProductUrl ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(mpn)}`),
          currency: String(p.Currency ?? "EUR"),
        });
      }
    }
    return output;
  } catch (e) { console.error("[DigiKey]", e); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FARNELL
// ─────────────────────────────────────────────────────────────────────────────

async function searchFarnell(mpn: string, _qty: number): Promise<any[]> {
  const key = process.env.FARNELL_API_KEY;
  if (!key || key === "placeholder") return [];
  try {
    const store  = process.env.FARNELL_STORE ?? "it.farnell.com";
    const params = new URLSearchParams({
      "term": `manuPartNum:${mpn}`, "storeInfo.id": store,
      "storeInfo.type": "global", "storeInfo.locale": "it_IT",
      "resultsSettings.offset": "0", "resultsSettings.numberOfResults": "10",
      "resultsSettings.sortBy": "unitPrice", "resultsSettings.sortOrder": "asc",
      "callInfo.responseDataFormat": "json", "userinfo.apiKey": key,
    });
    const res = await fetch(`https://api.element14.com/catalog/products?${params}`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return [];
    const json     = await res.json();
    const products: any[] = json?.manufacturerPartNumberSearchReturn?.products ?? json?.keywordSearchReturn?.products ?? [];
    return products.filter((p: any) => p?.prices?.length > 0).map((p: any) => {
      const tiers: PriceTier[] = (p.prices ?? [])
        .map((pb: any) => ({ qty: Number(pb.from), price: Number(pb.cost) }))
        .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
        .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);
      const url = p.productURL ? `https://${store}${p.productURL}` : `https://${store}/search?st=${encodeURIComponent(p.sku ?? mpn)}`;
      return {
        distributor: "Farnell", mpn: String(p.translatedManufacturerPartNumberList?.[0]?.manufacturerPartNumber ?? mpn),
        description: String(p.displayName ?? ""), stock: Number(p.stock?.level ?? 0),
        packageUnit: Number(p.packSize ?? 1) > 1 ? Number(p.packSize) : Number(p.minimumOrderQty ?? 1),
        priceTiers: tiers, productUrl: url, currency: String(p.currency ?? "EUR"),
      };
    });
  } catch (e) { console.error("[Farnell]", e); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTRY — aggiungere un distributore:
//  1. crea la funzione searchXXX sopra
//  2. aggiungila qui sotto
// ─────────────────────────────────────────────────────────────────────────────

const DISTRIBUTORS = [
  searchMouser,
  searchDigikey,
  searchFarnell,
  // searchTME,
  // searchRS,
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ROUTE
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let bom: BomRow[] = [];
    if (Array.isArray(body.bom))       bom = body.bom;
    else if (typeof body.raw === "string") bom = parseBom(body.raw);

    if (!bom.length)    return NextResponse.json({ error: "Empty BOM" },    { status: 400 });
    if (bom.length > 1000) return NextResponse.json({ error: "Max 1000 rows" }, { status: 400 });

    const results: ResultRow[] = await Promise.all(
      bom.map(async ({ mpn, qty }): Promise<ResultRow> => {

        // Chiama tutti i distributori in parallelo
        const allParts = (await Promise.all(
          DISTRIBUTORS.map(fn => fn(mpn, qty).catch(() => []))
        )).flat();

       const mouserCount  = allParts.filter((p: any) => p.distributor === "Mouser").length;

      const digikeyCount = allParts.filter((p: any) => p.distributor === "Digi-Key").length;
    
      const farnellCount = allParts.filter((p: any) => p.distributor === "Farnell").length;

      console.log(`[Search] ${mpn} qty=${qty} Mouser:${mouserCount} DigiKey:${digikeyCount} Farnell:${farnellCount} total:${allParts.length}`);

        if (!allParts.length) {
          return { mpn, description: "", requestedQty: qty, optimalQty: qty, unitPrice: 0, totalPrice: 0, currency: "USD", distributor: "—", stock: 0, productUrl: "", adjustment: "none", saved: 0, error: "Not found" };
        }

        const optimized = allParts
          .map(p => ({ ...p, ...calcOptimal(qty, p.packageUnit, p.stock, p.priceTiers) }))
          .filter(p => p.unitPrice > 0);

        if (!optimized.length) {
          return { mpn, description: "", requestedQty: qty, optimalQty: qty, unitPrice: 0, totalPrice: 0, currency: "USD", distributor: "—", stock: 0, productUrl: "", adjustment: "none", saved: 0, error: "No pricing data" };
        }

        // Case A: ha stock → il più economico
        const withStock = optimized.filter(p => p.feasible);
        if (withStock.length) {
          withStock.sort((a, b) => a.totalPrice - b.totalPrice);
          const w = withStock[0];
          return { mpn: w.mpn, description: w.description, requestedQty: qty, optimalQty: w.qty, unitPrice: w.unitPrice, totalPrice: w.totalPrice, currency: w.currency, distributor: w.distributor, stock: w.stock, productUrl: w.productUrl, adjustment: w.adjustment, saved: w.saved };
        }

        // Case B: nessuno ha stock → più economico + fallback
        const noStock = [...optimized].sort((a, b) => a.totalPrice - b.totalPrice);
        const cheapest = noStock[0];

        const fallback = allParts
          .filter(p => p.stock > 0)
          .map(p => ({ ...p, ...calcOptimal(Math.min(qty, p.stock), p.packageUnit, p.stock, p.priceTiers) }))
          .filter(p => p.unitPrice > 0)
          .sort((a, b) => a.totalPrice - b.totalPrice)[0];

        return {
          mpn: cheapest.mpn, description: cheapest.description, requestedQty: qty,
          optimalQty: cheapest.qty, unitPrice: cheapest.unitPrice, totalPrice: cheapest.totalPrice,
          currency: cheapest.currency, distributor: cheapest.distributor, stock: cheapest.stock,
          productUrl: cheapest.productUrl, adjustment: cheapest.adjustment, saved: cheapest.saved,
          error: "Out of stock",
          fallback: fallback ? {
            distributor: fallback.distributor, optimalQty: fallback.qty,
            unitPrice: fallback.unitPrice, totalPrice: fallback.totalPrice,
            stock: fallback.stock, productUrl: fallback.productUrl, currency: fallback.currency,
          } : undefined,
        };
      })
    );

    const totalBom = parseFloat(results.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2));
    const response: SearchResponse = { results, totalBom, searchedAt: new Date().toISOString() };
    return NextResponse.json(response);

  } catch (err) {
    console.error("[Search] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

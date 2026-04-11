/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
//  icpaste v2 — Search API
//
//  ✅ Per aggiungere un nuovo distributore:
//     1. Crea una funzione async search[Nome](mpn, qty): Promise<RawPart[]>
//     2. Aggiungila all'array DISTRIBUTORS in fondo al file
//     Fatto! Zero altre modifiche necessarie.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { BomRow, ResultRow, SearchResponse, PriceTier, Adjustment } from "@/lib/types";

export const runtime = "nodejs";

// ── Tipo interno raw (prima dell'ottimizzazione) ──────────────────────────────
interface RawPart {
  distributor: string;
  mpn:         string;
  description: string;
  stock:       number;
  packageUnit: number;
  priceTiers:  PriceTier[];
  productUrl:  string;
  currency:    string;
}

// ── Helpers prezzi ────────────────────────────────────────────────────────────

function getBestPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
  let best = sorted[0].price;
  for (const t of sorted) { if (qty >= t.qty) best = t.price; }
  return best;
}

function optimizeQty(
  requestedQty: number,
  packageUnit:  number,
  stock:        number,
  tiers:        PriceTier[]
): {
  qty:        number;
  unitPrice:  number;
  totalPrice: number;
  feasible:   boolean;
  adjustment: Adjustment;
  saved:      number;
} {
  const unit = Math.max(packageUnit, 1);

  // Genera candidati: qty originale + arrotondata al package + scaglioni
  const candidates = new Set<number>();
  candidates.add(requestedQty);
  const pkgQty = Math.ceil(requestedQty / unit) * unit;
  candidates.add(pkgQty);
  for (const t of tiers) {
    if (t.qty > requestedQty) {
      candidates.add(Math.ceil(t.qty / unit) * unit);
    }
  }

  // Calcola costo per ogni candidato
  const scored = Array.from(candidates)
    .map(q => ({
      qty:      q,
      price:    getBestPrice(tiers, q),
      total:    parseFloat((getBestPrice(tiers, q) * q).toFixed(4)),
      feasible: stock >= q,
      isPkg:    q !== requestedQty && q === pkgQty,
      isStep:   q !== requestedQty && q !== pkgQty,
    }))
    .filter(c => c.price > 0);

  if (!scored.length) {
    const p = getBestPrice(tiers, requestedQty);
    return { qty: requestedQty, unitPrice: p, totalPrice: parseFloat((p * requestedQty).toFixed(2)), feasible: stock >= requestedQty, adjustment: "none", saved: 0 };
  }

  // Preferisci feasible, poi più economico per totale
  const feasible = scored.filter(c => c.feasible);
  const pool     = feasible.length ? feasible : scored;
  pool.sort((a, b) => a.total - b.total);
  const w = pool[0];

  const origPrice = getBestPrice(tiers, requestedQty);
  const origTotal = parseFloat((origPrice * requestedQty).toFixed(4));
  const saved     = parseFloat(Math.max(0, origTotal - w.total).toFixed(4));

  let adjustment: Adjustment = "none";
  if      (w.isPkg && w.isStep) adjustment = "both";
  else if (w.isPkg)             adjustment = "package";
  else if (w.isStep)            adjustment = "pricestep";

  return {
    qty:        w.qty,
    unitPrice:  w.price,
    totalPrice: parseFloat((w.price * w.qty).toFixed(2)),
    feasible:   w.feasible,
    adjustment,
    saved,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  DISTRIBUTORI
//  Per aggiungere un nuovo distributore, aggiungi una funzione qui sotto
//  e aggiungila all'array DISTRIBUTORS in fondo.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mouser ────────────────────────────────────────────────────────────────────
async function searchMouser(mpn: string, qty: number): Promise<RawPart[]> {
  const key = process.env.MOUSER_API_KEY;
  if (!key || key === "placeholder") return [];

  try {
    const res = await fetch(
      `https://api.mouser.com/api/v1/search/keyword?apiKey=${key}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
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
    const json: any = await res.json();
    const parts: any[] = json?.SearchResults?.Parts ?? [];

    return parts
      .filter((p: any) => p?.PriceBreaks?.length > 0)
      .map((p: any): RawPart => {
        const tiers: PriceTier[] = (p.PriceBreaks ?? [])
          .map((pb: any) => ({
            qty:   Number(pb.Quantity),
            price: parseFloat(String(pb.Price ?? "0").replace(/[^0-9.]/g, "")),
          }))
          .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
          .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

        const avail = String(p.Availability ?? "0");
        const stock = parseInt(avail.replace(/[^0-9]/g, "") || "0", 10);
        const min   = parseInt(p.Min  ?? "1", 10) || 1;
        const mult  = parseInt(p.Mult ?? "1", 10) || 1;

        return {
          distributor: "Mouser",
          mpn:         String(p.ManufacturerPartNumber ?? mpn),
          description: String(p.Description ?? ""),
          stock,
          packageUnit: Math.max(min, mult, 1),
          priceTiers:  tiers,
          productUrl:  p.ProductDetailUrl
            ? `https://www.mouser.com${p.ProductDetailUrl}`
            : `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(mpn)}`,
          currency:    String(p.PriceBreaks?.[0]?.Currency ?? "USD"),
        };
      });
  } catch { return []; }
}

// ── Digi-Key ──────────────────────────────────────────────────────────────────
async function searchDigikey(mpn: string, qty: number): Promise<RawPart[]> {
  const id     = process.env.DIGIKEY_CLIENT_ID;
  const secret = process.env.DIGIKEY_CLIENT_SECRET;
  if (!id || !secret || id === "placeholder") return [];

  try {
    // Token — nessun cache, ogni chiamata è fresca (serverless safe)
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
    const json: any = await searchRes.json();

    const results: RawPart[] = [];
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

        results.push({
          distributor: "Digi-Key",
          mpn:         String(p.ManufacturerProductNumber ?? mpn),
          description: String(p.Description?.ProductDescription ?? ""),
          stock,
          packageUnit: pkgUnit,
          priceTiers:  tiers,
          productUrl:  String(p.ProductUrl ?? `https://www.digikey.it/products/it?keywords=${encodeURIComponent(mpn)}`),
          currency:    String(p.Currency ?? "EUR"),
        });
      }
    }
    return results;
  } catch { return []; }
}

// ── Farnell ───────────────────────────────────────────────────────────────────
async function searchFarnell(mpn: string, _qty: number): Promise<RawPart[]> {
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
    const json: any = await res.json();

    const products: any[] =
      json?.manufacturerPartNumberSearchReturn?.products ??
      json?.keywordSearchReturn?.products ?? [];

    return products
      .filter((p: any) => p?.prices?.length > 0)
      .map((p: any): RawPart => {
        const tiers: PriceTier[] = (p.prices ?? [])
          .map((pb: any) => ({ qty: Number(pb.from), price: Number(pb.cost) }))
          .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
          .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

        const store   = process.env.FARNELL_STORE ?? "it.farnell.com";
        const pkgSize = Number(p.packSize ?? 0);
        const moq     = Number(p.minimumOrderQty ?? 1);

        return {
          distributor: "Farnell",
          mpn:         String(p.translatedManufacturerPartNumberList?.[0]?.manufacturerPartNumber ?? mpn),
          description: String(p.displayName ?? ""),
          stock:       Number(p.stock?.level ?? 0),
          packageUnit: pkgSize > 1 ? pkgSize : (moq > 0 ? moq : 1),
          priceTiers:  tiers,
          productUrl:  p.productURL
            ? `https://${store}${p.productURL}`
            : `https://${store}/search?st=${encodeURIComponent(mpn)}`,
          currency:    String(p.currency ?? "EUR"),
        };
      });
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTRO DISTRIBUTORI
//  ✅ Per aggiungere un nuovo distributore:
//     1. Scrivi la funzione search[Nome] sopra
//     2. Aggiungila qui sotto
//  Nient'altro da toccare!
// ─────────────────────────────────────────────────────────────────────────────

const DISTRIBUTORS: Array<(mpn: string, qty: number) => Promise<RawPart[]>> = [
  searchMouser,
  searchDigikey,
  searchFarnell,
  // searchTME,      ← aggiungi qui quando pronto
  // searchRSComponents,
  // searchLCSC,
];

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTE HANDLER
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
      bom.map(async ({ mpn, qty }): Promise<ResultRow> => {

        // Interroga tutti i distributori in parallelo
        const allParts = (
          await Promise.all(
            DISTRIBUTORS.map(fn => fn(mpn, qty).catch(() => []))
          )
        ).flat() as RawPart[];

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
            const opt = optimizeQty(qty, p.packageUnit, p.stock, p.priceTiers);
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

        // Separa feasible (stock ok) da non feasible
        const feasible    = optimized.filter(p => p.feasible);
        const notFeasible = optimized.filter(p => !p.feasible);

        // Case A: almeno uno ha stock → prendi il più economico
        if (feasible.length > 0) {
          feasible.sort((a, b) => a.totalPrice - b.totalPrice);
          const w = feasible[0];
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
        notFeasible.sort((a, b) => a.totalPrice - b.totalPrice);
        const cheapest = notFeasible[0];

        // Cerca fallback tra chi ha stock parziale
        const withPartialStock = allParts
          .filter(p => p.stock > 0)
          .map(p => {
            const partialQty = Math.min(qty, p.stock);
            const opt = optimizeQty(partialQty, p.packageUnit, p.stock, p.priceTiers);
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
          fallback:     withPartialStock.length > 0 ? {
            distributor: withPartialStock[0].distributor,
            optimalQty:  withPartialStock[0].qty,
            unitPrice:   withPartialStock[0].unitPrice,
            totalPrice:  withPartialStock[0].totalPrice,
            stock:       withPartialStock[0].stock,
            productUrl:  withPartialStock[0].productUrl,
            currency:    withPartialStock[0].currency,
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
    console.error("[Search]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

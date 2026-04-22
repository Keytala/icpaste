/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { parseBom }                  from "@/lib/bom-parser";
import type { BomRow, PriceTier, ResultRow, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG — distributori da mostrare e link affiliati
//  Per aggiungere un distributore: aggiungi il nome in ALLOWED_SELLERS
//  Per aggiungere un link affiliato: aggiungi il parametro in AFFILIATE_PARAMS
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_SELLERS: string[] = [
  "Mouser",
  "Digi-Key",
  "Farnell",
  "TME",
  "RS Components",
  "Arrow",
  "Avnet",
  "LCSC",
  "element14",
  "Newark",
];

const AFFILIATE_PARAMS: Record<string, string> = {
  "Mouser":        process.env.MOUSER_AFFILIATE_PARAM        ?? "",
  "Digi-Key":      process.env.DIGIKEY_AFFILIATE_PARAM       ?? "",
  "Farnell":       process.env.FARNELL_AFFILIATE_PARAM       ?? "",
  "TME":           process.env.TME_AFFILIATE_PARAM           ?? "",
  "RS Components": process.env.RS_AFFILIATE_PARAM            ?? "",
  "Arrow":         process.env.ARROW_AFFILIATE_PARAM         ?? "",
};

// ─────────────────────────────────────────────────────────────────────────────
//  NEXAR TOKEN — OAuth2 Client Credentials
// ─────────────────────────────────────────────────────────────────────────────

const NEXAR_TOKEN_URL = "https://identity.nexar.com/connect/token";
const NEXAR_API_URL   = "https://api.nexar.com/graphql";

async function getNexarToken(): Promise<string | null> {
  const id     = process.env.NEXAR_CLIENT_ID;
  const secret = process.env.NEXAR_CLIENT_SECRET;
  if (!id || !secret || id === "placeholder") return null;

  try {
    const res = await fetch(NEXAR_TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     id,
        client_secret: secret,
      }),
    });
    if (!res.ok) { console.error("[Nexar] Token error:", res.status); return null; }
    const json = await res.json();
    return json.access_token ?? null;
  } catch (e) {
    console.error("[Nexar] Token fetch failed:", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  NEXAR GRAPHQL QUERY
// ─────────────────────────────────────────────────────────────────────────────

const NEXAR_QUERY = `
  query SearchMpn($mpn: String!, $qty: Int!) {
    supSearchMpn(q: $mpn, limit: 5) {
      hits
      results {
        part {
          mpn
          shortDescription
          sellers(authorizedOnly: false) {
            company { name }
            offers {
              inventoryLevel
              moq
              orderMultiple
              packaging
              factoryPackQuantity
              clickUrl
              prices(currency: "USD") {
                quantity
                price
                currency
              }
            }
          }
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  SEARCH NEXAR — ritorna parti da tutti i distributori in una sola chiamata
// ─────────────────────────────────────────────────────────────────────────────

async function searchNexar(mpn: string, qty: number): Promise<any[]> {
  const token = await getNexarToken();
  if (!token) {
    console.warn("[Nexar] No token — check NEXAR_CLIENT_ID and NEXAR_CLIENT_SECRET");
    return [];
  }

  try {
    const res = await fetch(NEXAR_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        query:     NEXAR_QUERY,
        variables: { mpn, qty },
      }),
    });

    if (!res.ok) { console.error("[Nexar] API error:", res.status); return []; }

    const json    = await res.json();
    const results: any[] = json?.data?.supSearchMpn?.results ?? [];
    const parts:   any[] = [];

    for (const result of results) {
      const part    = result?.part;
      if (!part) continue;

      const sellers: any[] = part.sellers ?? [];

      for (const seller of sellers) {
        const sellerName: string = seller?.company?.name ?? "";

        // Filtra solo i distributori nella lista
        const allowed = ALLOWED_SELLERS.find(s =>
          sellerName.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(sellerName.toLowerCase())
        );
        if (!allowed) continue;

        const offers: any[] = seller.offers ?? [];

        for (const offer of offers) {
          const prices: any[] = offer.prices ?? [];
          if (!prices.length) continue;

          // Costruisci price tiers
          const tiers: PriceTier[] = prices
            .map((p: any) => ({
              qty:   Number(p.quantity ?? 0),
              price: Number(p.price    ?? 0),
            }))
            .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
            .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

          if (!tiers.length) continue;

          const stock       = Number(offer.inventoryLevel    ?? 0);
          const moq         = Number(offer.moq               ?? 1);
          const orderMult   = Number(offer.orderMultiple     ?? 1);
          const factoryPack = Number(offer.factoryPackQuantity ?? 0);

          // Package unit: usa factoryPackQuantity se > 1, altrimenti orderMultiple, altrimenti moq
          const pkgUnit = factoryPack > 1 ? factoryPack : orderMult > 1 ? orderMult : (moq > 0 ? moq : 1);

          // URL con affiliazione
          const baseUrl    = String(offer.clickUrl ?? `https://octopart.com/search?q=${encodeURIComponent(mpn)}`);
          const affParam   = AFFILIATE_PARAMS[allowed] ?? "";
          const productUrl = affParam ? `${baseUrl}${affParam}` : baseUrl;

          parts.push({
            distributor: allowed,
            mpn:         String(part.mpn ?? mpn),
            description: String(part.shortDescription ?? ""),
            stock,
            packageUnit: pkgUnit,
            priceTiers:  tiers,
            productUrl,
            currency:    String(prices[0]?.currency ?? "USD"),
          });
        }
      }
    }

    console.log(`[Nexar] ${mpn} → ${parts.length} offers from ${[...new Set(parts.map((p: any) => p.distributor))].length} sellers`);
    return parts;

  } catch (e) {
    console.error("[Nexar] Search failed:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PRICE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function bestPrice(tiers: PriceTier[], qty: number): number {
  if (!tiers.length) return 0;
  const s = [...tiers].sort((a, b) => a.qty - b.qty);
  let p = s[0].price;
  for (const t of s) { if (qty >= t.qty) p = t.price; }
  return p;
}

function optimize(requestedQty: number, pkgUnit: number, stock: number, tiers: PriceTier[]) {
  const unit   = Math.max(pkgUnit, 1);
  const pkgQty = Math.ceil(requestedQty / unit) * unit;

  const candidates: number[] = [requestedQty];
  if (pkgQty !== requestedQty) candidates.push(pkgQty);
  for (const t of tiers) {
    if (t.qty > requestedQty) {
      const tQty = Math.ceil(t.qty / unit) * unit;
      if (!candidates.includes(tQty)) candidates.push(tQty);
    }
  }

  const scored = candidates
    .map(q => ({
      qty:      q,
      price:    bestPrice(tiers, q),
      total:    parseFloat((bestPrice(tiers, q) * q).toFixed(2)),
      feasible: stock >= q,
      isPkg:    q === pkgQty && q !== requestedQty,
      isStep:   tiers.some(t => t.qty > requestedQty && Math.ceil(t.qty / unit) * unit === q),
    }))
    .filter(c => c.price > 0);

  if (!scored.length) {
    const p = bestPrice(tiers, requestedQty);
    return {
      qty: requestedQty, unitPrice: p,
      totalPrice: parseFloat((p * requestedQty).toFixed(2)),
      feasible: stock >= requestedQty,
      adjustment: "none" as ResultRow["adjustment"],
      saved: 0,
    };
  }

  const feasible = scored.filter(c => c.feasible);
  const pool     = (feasible.length ? feasible : scored).sort((a, b) => a.total - b.total);
  const w        = pool[0];

  const origTotal = parseFloat((bestPrice(tiers, requestedQty) * requestedQty).toFixed(2));
  const saved     = Math.max(0, parseFloat((origTotal - w.total).toFixed(2)));
  const adj       = w.isPkg && w.isStep ? "both" : w.isPkg ? "package" : w.isStep ? "pricestep" : "none";

  return {
    qty: w.qty, unitPrice: w.price, totalPrice: w.total,
    feasible: w.feasible,
    adjustment: adj as ResultRow["adjustment"],
    saved,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ROUTE — POST /api/search
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let bom: BomRow[] = [];
    if (Array.isArray(body.bom))           bom = body.bom;
    else if (typeof body.raw === "string") bom = parseBom(body.raw);

    if (!bom.length)       return NextResponse.json({ error: "Empty BOM" },     { status: 400 });
    if (bom.length > 1000) return NextResponse.json({ error: "Max 1000 rows" }, { status: 400 });

    const results: ResultRow[] = await Promise.all(
      bom.map(async ({ mpn, qty }): Promise<ResultRow> => {

        const allParts = await searchNexar(mpn, qty).catch(() => []);

        const noResult = (error: string): ResultRow => ({
          mpn, description: "", requestedQty: qty, optimalQty: qty,
          unitPrice: 0, totalPrice: 0, currency: "USD",
          distributor: "—", stock: 0, productUrl: "",
          adjustment: "none", saved: 0, error,
        });

        if (!allParts.length) return noResult("Not found");

        // Ottimizza quantità per ogni offerta
        const optimized = allParts
          .map(p => ({ ...p, ...optimize(qty, p.packageUnit, p.stock, p.priceTiers) }))
          .filter(p => p.unitPrice > 0);

        if (!optimized.length) return noResult("No pricing data");

        // Preferisci feasible (con stock), poi più economico
        const withStock = optimized.filter(p => p.feasible);

        if (withStock.length) {
          withStock.sort((a, b) => a.totalPrice - b.totalPrice);
          const w = withStock[0];
          return {
            mpn: w.mpn, description: w.description, requestedQty: qty,
            optimalQty: w.qty, unitPrice: w.unitPrice, totalPrice: w.totalPrice,
            currency: w.currency, distributor: w.distributor, stock: w.stock,
            productUrl: w.productUrl, adjustment: w.adjustment, saved: w.saved,
          };
        }

        // Nessuno ha stock — mostra il più economico + fallback con stock parziale
        const cheapest = [...optimized].sort((a, b) => a.totalPrice - b.totalPrice)[0];

        const fallback = allParts
          .filter(p => p.stock > 0)
          .map(p => ({ ...p, ...optimize(Math.min(qty, p.stock), p.packageUnit, p.stock, p.priceTiers) }))
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

    return NextResponse.json({
      results,
      totalBom,
      searchedAt: new Date().toISOString(),
    } as SearchResponse);

  } catch (err) {
    console.error("[Search]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

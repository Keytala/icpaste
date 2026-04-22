/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { parseBom }                  from "@/lib/bom-parser";
import type { BomRow, PriceTier, ResultRow, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
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

  const scored = candidates.map(q => ({
    qty:      q,
    price:    bestPrice(tiers, q),
    total:    parseFloat((bestPrice(tiers, q) * q).toFixed(2)),
    feasible: stock >= q,
    isPkg:    q === pkgQty && q !== requestedQty,
    isStep:   tiers.some(t => t.qty > requestedQty && Math.ceil(t.qty / unit) * unit === q),
  })).filter(c => c.price > 0);

  if (!scored.length) {
    const p = bestPrice(tiers, requestedQty);
    return {
      qty: requestedQty, unitPrice: p,
      totalPrice: parseFloat((p * requestedQty).toFixed(2)),
      feasible: stock >= requestedQty,
      adjustment: "none" as const, saved: 0,
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
//  NEXAR API — una sola chiamata per tutti i distributori
// ─────────────────────────────────────────────────────────────────────────────

const NEXAR_TOKEN_URL = "https://identity.nexar.com/connect/token";
const NEXAR_API_URL   = "https://api.nexar.com/graphql/";

// Distributori supportati — aggiungi/rimuovi a piacere
const ALLOWED_SELLERS = [
  "Mouser", "Digi-Key", "Farnell", "TME",
  "RS Components", "Arrow", "Avnet", "LCSC", "Newark",
];

// Link affiliati — aggiungi il tuo codice quando disponibile
const AFFILIATE: Record<string, string> = {
  "Mouser":        process.env.MOUSER_AFFILIATE_PARAM        ?? "",
  "Digi-Key":      process.env.DIGIKEY_AFFILIATE_PARAM       ?? "",
  "Farnell":       process.env.FARNELL_AFFILIATE_PARAM       ?? "",
  "TME":           process.env.TME_AFFILIATE_PARAM           ?? "",
  "RS Components": process.env.RS_AFFILIATE_PARAM            ?? "",
};

let nexarToken:  string | null = null;
let nexarExpiry: number        = 0;

async function getNexarToken(): Promise<string | null> {
  const id     = process.env.NEXAR_CLIENT_ID;
  const secret = process.env.NEXAR_CLIENT_SECRET;
  if (!id || !secret || id === "placeholder") return null;

  // Riusa il token se ancora valido (con 60s di margine)
  if (nexarToken && Date.now() < nexarExpiry - 60_000) return nexarToken;

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
    const json   = await res.json();
    nexarToken   = String(json.access_token);
    nexarExpiry  = Date.now() + (Number(json.expires_in ?? 3600)) * 1000;
    return nexarToken;
  } catch (e) {
    console.error("[Nexar] Token exception:", e);
    return null;
  }
}

async function searchNexar(mpn: string, _qty: number): Promise<any[]> {
  const token = await getNexarToken();
  if (!token) return [];

  const query = `
    query SearchMpn($mpn: String!) {
      supSearchMpn(q: $mpn, limit: 5) {
        hits {
          part {
            mpn
            shortDescription
            sellers(authorizedOnly: false) {
              company { name }
              offers {
                inventoryLevel
                moq
                packaging
                clickUrl
                prices {
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

  try {
    const res = await fetch(NEXAR_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: { mpn } }),
    });

    if (!res.ok) { console.error("[Nexar] Search error:", res.status); return []; }

    const json = await res.json();
    if (json.errors) { console.error("[Nexar] GraphQL errors:", json.errors); return []; }

    const hits: any[] = json?.data?.supSearchMpn?.hits ?? [];
    const parts: any[] = [];

    for (const hit of hits) {
      const part    = hit?.part;
      const mpnFull = String(part?.mpn ?? mpn);
      const desc    = String(part?.shortDescription ?? "");
      const sellers: any[] = part?.sellers ?? [];

      for (const seller of sellers) {
        const sellerName: string = String(seller?.company?.name ?? "");

        // Filtra solo i distributori supportati
        const matchedDist = ALLOWED_SELLERS.find(d =>
          sellerName.toLowerCase().includes(d.toLowerCase())
        );
        if (!matchedDist) continue;

        for (const offer of (seller?.offers ?? [])) {
          const prices: any[] = offer?.prices ?? [];
          if (!prices.length) continue;

          const tiers: PriceTier[] = prices
            .map((p: any) => ({
              qty:   Number(p.quantity ?? 0),
              price: Number(p.price    ?? 0),
            }))
            .filter((t: PriceTier) => t.qty > 0 && t.price > 0)
            .sort((a: PriceTier, b: PriceTier) => a.qty - b.qty);

          if (!tiers.length) continue;

          const stock      = Number(offer?.inventoryLevel ?? 0);
          const moq        = Number(offer?.moq ?? 1);
          const pkgUnit    = moq > 1 ? moq : 1;
          const baseUrl    = String(offer?.clickUrl ?? `https://octopart.com/search?q=${encodeURIComponent(mpn)}`);
          const affParam   = AFFILIATE[matchedDist] ?? "";
          const productUrl = affParam ? `${baseUrl}${affParam}` : baseUrl;

          parts.push({
            distributor: matchedDist,
            mpn:         mpnFull,
            description: desc,
            stock,
            packageUnit: pkgUnit,
            priceTiers:  tiers,
            productUrl,
            currency:    String(prices[0]?.currency ?? "USD"),
          });
        }
      }
    }

    console.log(`[Nexar] ${mpn} → ${parts.length} offers`);
    return parts;

  } catch (e) {
    console.error("[Nexar] Exception:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AGGIUNGI ALTRI SOURCES QUI SE NECESSARIO
//  async function searchTMEdirect(mpn: string, qty: number): Promise<any[]> { ... }
// ─────────────────────────────────────────────────────────────────────────────

const SOURCES = [
  searchNexar,
  // searchTMEdirect,
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ROUTE
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

        const allParts = (
          await Promise.all(SOURCES.map(fn => fn(mpn, qty).catch(() => [])))
        ).flat();

        const noResult = (error: string): ResultRow => ({
          mpn, description: "", requestedQty: qty, optimalQty: qty,
          unitPrice: 0, totalPrice: 0, currency: "USD",
          distributor: "—", stock: 0, productUrl: "",
          adjustment: "none", saved: 0, error,
        });

        if (!allParts.length) return noResult("Not found");

        const optimized = allParts
          .map(p => ({ ...p, ...optimize(qty, p.packageUnit, p.stock, p.priceTiers) }))
          .filter(p => p.unitPrice > 0);

        if (!optimized.length) return noResult("No pricing data");

        // Preferisci con stock, poi più economico
        const withStock = optimized.filter(p => p.feasible);
        if (withStock.length) {
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

        // Nessuno ha stock — mostra il più economico + fallback
        const cheapest = [...optimized].sort((a, b) => a.totalPrice - b.totalPrice)[0];
        const fallback  = allParts
          .filter(p => p.stock > 0)
          .map(p => ({ ...p, ...optimize(Math.min(qty, p.stock), p.packageUnit, p.stock, p.priceTiers) }))
          .filter(p => p.unitPrice > 0)
          .sort((a, b) => a.totalPrice - b.totalPrice)[0];

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
          fallback:     fallback ? {
            distributor: fallback.distributor,
            optimalQty:  fallback.qty,
            unitPrice:   fallback.unitPrice,
            totalPrice:  fallback.totalPrice,
            stock:       fallback.stock,
            productUrl:  fallback.productUrl,
            currency:    fallback.currency,
          } : undefined,
        };
      })
    );

    const totalBom = parseFloat(
      results.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toFixed(2)
    );

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

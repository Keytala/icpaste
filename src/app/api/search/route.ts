typescript

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";

import { BomRow, ResultRow, SearchResponse, PriceTier } from "@/lib/types";



export const runtime = "nodejs";



// ── Helpers ───────────────────────────────────────────────────────────────────



function getBestPrice(tiers: PriceTier[], qty: number): number {

if (!tiers.length) return 0;

const sorted = [...tiers].sort((a, b) => a.qty - b.qty);

let best = sorted[0].price;

for (const t of sorted) { if (qty >= t.qty) best = t.price; }

return best;

}



function calcOptimalQty(

requestedQty: number,

packageUnit:  number,

stock:        number,

tiers:        PriceTier[]
): { qty: number; unitPrice: number; totalPrice: number; feasible: boolean; adjustment: "none"|"package"|"pricestep"|"both"; saved: number } {


const unit = Math.max(packageUnit, 1);



// Candidati: qty originale, arrotondata al package, scaglioni superiori

const candidates = [requestedQty];

const pkgQty = Math.ceil(requestedQty / unit) * unit;

if (pkgQty !== requestedQty) candidates.push(pkgQty);

for (const t of tiers) {

if (t.qty > requestedQty) {

const tQty = Math.ceil(t.qty / unit) * unit;

if (!candidates.includes(tQty)) candidates.push(tQty);

}

}



// Calcola prezzo per ogni candidato

const scored = candidates.map(q => ({

qty:      q,

price:    getBestPrice(tiers, q),

total:    getBestPrice(tiers, q) * q,

feasible: stock >= q,

isPkg:    q !== requestedQty && q === pkgQty,

isStep:   tiers.some(t => t.qty > requestedQty && Math.ceil(t.qty/unit)*unit === q),

})).filter(c => c.price > 0);



if (!scored.length) {

const p = getBestPrice(tiers, requestedQty);

return { qty: requestedQty, unitPrice: p, totalPrice: p * requestedQty, feasible: stock >= requestedQty, adjustment: "none", saved: 0 };

}



// Preferisci feasible, poi più economico

const feasible = scored.filter(c => c.feasible);

const pool     = feasible.length ? feasible : scored;

pool.sort((a, b) => a.total - b.total);

const w = pool[0];



const origPrice = getBestPrice(tiers, requestedQty);

const origTotal = origPrice * requestedQty;

const saved     = parseFloat((origTotal - w.total).toFixed(4));


let adjustment: "none"|"package"|"pricestep"|"both" = "none";
if (w.isPkg && w.isStep) adjustment = "both";

else if (w.isPkg)        adjustment = "package";

else if (w.isStep)       adjustment = "pricestep";



return {

qty:        w.qty,

unitPrice:  w.price,

totalPrice: parseFloat((w.price * w.qty).toFixed(2)),

feasible:   w.feasible,

adjustment,

saved,

};

}



// ── Mouser ────────────────────────────────────────────────────────────────────



async function searchMouser(mpn: string, qty: number): Promise<any[]> {

const key = process.env.MOUSER_API_KEY;
if (!key || key === "placeholder") return [];


const res = await fetch(

`https://api.mouser.com/api/v1/search/keyword?apiKey=${key}`,

{

method:  "POST",

headers: { "Content-Type": "application/json" },

body: JSON.stringify({

SearchByKeywordRequest: {

keyword: mpn, records: 10, startingRecord: 0,

searchOptions: "2", searchWithYourSignUpLanguage: "false",

},

}),

}

);

if (!res.ok) return [];

const json = await res.json();

const parts: any[] = json?.SearchResults?.Parts ?? [];



return parts

.filter(p => p.PriceBreaks?.length > 0)

.map(p => {

const tiers: PriceTier[] = (p.PriceBreaks ?? [])

.map((pb: any) => ({

qty:   Number(pb.Quantity),

price: parseFloat(String(pb.Price).replace(/[^0-9.]/g, "")),

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
packageUnit: Math.max(parseInt(p.Mult || "1", 10), parseInt(p.Min || "1", 10), 1),
priceTiers:  tiers,

productUrl:  url,

currency:    String(p.PriceBreaks?.[0]?.Currency ?? "USD"),

} as any;

});

}



// ── DigiKey ───────────────────────────────────────────────────────────────────



async function searchDigikey(mpn: string, qty: number): Promise<any[]> {

const id     = process.env.DIGIKEY_CLIENT_ID;

const secret = process.env.DIGIKEY_CLIENT_SECRET;
if (!id || !secret || id === "placeholder") return [];


// Token

const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {

method:  "POST",

headers: { "Content-Type": "application/x-www-form-urlencoded" },

body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),

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

Keywords: mpn, RecordCount: 10, RecordStartPos: 0,

RequestedQuantity: qty, SearchOptions: ["ManufacturerPartSearch"],

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

.map((pb: any) => ({ qty: Number(pb.BreakQuantity), price: Number(pb.UnitPrice) }))

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

}



// ── Main Route ────────────────────────────────────────────────────────────────



export async function POST(req: NextRequest) {

try {

const body = await req.json();

const bom: BomRow[] = Array.isArray(body.bom) ? body.bom : [];



if (!bom.length) {

return NextResponse.json({ error: "Empty BOM" }, { status: 400 });

}



const results: ResultRow[] = await Promise.all(

bom.map(async (row): Promise<ResultRow> => {

const { mpn, qty } = row;



// Chiama Mouser e DigiKey in parallelo

const [mouserParts, digikeyParts] = await Promise.all([

searchMouser(mpn, qty).catch(() => []),

searchDigikey(mpn, qty).catch(() => []),

]);



const allParts = [...mouserParts, ...digikeyParts];

console.log(`[Search] ${mpn} qty=${qty} → Mouser:${mouserParts.length} DigiKey:${digikeyParts.length}`);



if (!allParts.length) {

return {

mpn, requestedQty: qty, optimalQty: qty,

unitPrice: 0, totalPrice: 0, currency: "USD",

distributor: "—", stock: 0, productUrl: "",

description: "", adjustment: "none", saved: 0,

error: "Not found",

};

}



// Ottimizza quantità per ogni parte

const optimized = allParts.map(p => {

const opt = calcOptimalQty(qty, p.packageUnit, p.stock, p.priceTiers);

return { ...p, ...opt };

}).filter(p => p.unitPrice > 0);



if (!optimized.length) {

return {

mpn, requestedQty: qty, optimalQty: qty,

unitPrice: 0, totalPrice: 0, currency: "USD",

distributor: "—", stock: 0, productUrl: "",

description: "", adjustment: "none", saved: 0,

error: "No pricing data",

};

}



// Preferisci feasible, poi più economico

const feasible = optimized.filter(p => p.feasible);

const pool     = feasible.length ? feasible : optimized;

pool.sort((a, b) => a.totalPrice - b.totalPrice);

const winner = pool[0];



return {

mpn:          winner.mpn,

requestedQty: qty,

optimalQty:   winner.qty,

unitPrice:    winner.unitPrice,

totalPrice:   winner.totalPrice,

currency:     winner.currency,

distributor:  winner.distributor,

stock:        winner.stock,

productUrl:   winner.productUrl,

description:  winner.description,

adjustment:   winner.adjustment,

saved:        winner.saved,

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

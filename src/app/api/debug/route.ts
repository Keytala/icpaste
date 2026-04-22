/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mousserKey    = process.env.MOUSER_API_KEY;
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;
  const farnellKey    = process.env.FARNELL_API_KEY;

  // ── Test Mouser ───────────────────────────────────────────────────────────
  let mouserTest = "not configured";
  if (mousserKey && mousserKey !== "placeholder") {
    try {
      const res  = await fetch(`https://api.mouser.com/api/v1/search/keyword?apiKey=${mousserKey}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ SearchByKeywordRequest: { keyword: "LM358N", records: 3, startingRecord: 0, searchOptions: "2", searchWithYourSignUpLanguage: "false" } }),
      });
      const json = await res.json();
      const n    = json?.SearchResults?.NumberOfResult ?? 0;
      const hasPrices = (json?.SearchResults?.Parts ?? []).some((p: any) => p?.PriceBreaks?.length > 0);
      mouserTest = res.ok ? `✅ ${n} results, prices: ${hasPrices}` : `❌ HTTP ${res.status}`;
    } catch (e: any) { mouserTest = `❌ ${e.message}`; }
  }

  // ── Test DigiKey ──────────────────────────────────────────────────────────
  let digikeyTest = "not configured";
  if (digikeyId && digikeySecret && digikeyId !== "placeholder") {
    try {
      const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: digikeyId, client_secret: digikeySecret, grant_type: "client_credentials" }),
      });
      const { access_token } = await tokenRes.json();
      if (!access_token) { digikeyTest = "❌ No token"; }
      else {
        const searchRes = await fetch("https://api.digikey.com/products/v4/search/keyword", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${access_token}`, "X-DIGIKEY-Client-Id": digikeyId, "X-DIGIKEY-Locale-Site": "IT", "X-DIGIKEY-Locale-Language": "it", "X-DIGIKEY-Locale-Currency": "EUR" },
          body: JSON.stringify({ Keywords: "LM358N", RecordCount: 3, RecordStartPos: 0, RequestedQuantity: 100, SearchOptions: ["ManufacturerPartSearch"] }),
        });
        const json = await searchRes.json();
        const n    = json?.Products?.length ?? 0;
        const hasPrices = (json?.Products ?? []).some((p: any) => p?.ProductVariations?.[0]?.StandardPricing?.length > 0);
        digikeyTest = searchRes.ok ? `✅ ${n} results, prices: ${hasPrices}` : `❌ HTTP ${searchRes.status}`;
      }
    } catch (e: any) { digikeyTest = `❌ ${e.message}`; }
  }

  // ── Test Farnell ──────────────────────────────────────────────────────────
  let farnellTest = "not configured";
  if (farnellKey && farnellKey !== "placeholder") {
    try {
      const params = new URLSearchParams({ "term": "manuPartNum:LM358N", "storeInfo.id": "it.farnell.com", "storeInfo.type": "global", "storeInfo.locale": "it_IT", "resultsSettings.offset": "0", "resultsSettings.numberOfResults": "3", "callInfo.responseDataFormat": "json", "userinfo.apiKey": farnellKey });
      const res  = await fetch(`https://api.element14.com/catalog/products?${params}`, { headers: { "Accept": "application/json" } });
      const json = await res.json();
      const n    = json?.manufacturerPartNumberSearchReturn?.products?.length ?? json?.keywordSearchReturn?.products?.length ?? 0;
      farnellTest = res.ok ? `✅ ${n} results` : `❌ HTTP ${res.status}: ${JSON.stringify(json).slice(0,100)}`;
    } catch (e: any) { farnellTest = `❌ ${e.message}`; }
  }

  // ── Test route.ts search function ─────────────────────────────────────────
  let searchRouteTest = "not tested";
  try {
    const res  = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/search`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ bom: [{ mpn: "LM358N", qty: 100 }] }),
    });
    const json = await res.json();
    searchRouteTest = res.ok
      ? `✅ ${json?.results?.[0]?.distributor ?? "no distributor"} — ${json?.results?.[0]?.error ?? "ok"}`
      : `❌ HTTP ${res.status}`;
  } catch (e: any) { searchRouteTest = `❌ ${e.message}`; }

  return NextResponse.json({
    env: {
      MOUSER_API_KEY:        mousserKey    ? `set (${mousserKey.slice(0,8)}...)` : "❌ missing",
      DIGIKEY_CLIENT_ID:     digikeyId     ? `set (${digikeyId.slice(0,8)}...)` : "❌ missing",
      DIGIKEY_CLIENT_SECRET: digikeySecret ? `set (${digikeySecret.slice(0,8)}...)` : "❌ missing",
      FARNELL_API_KEY:       farnellKey    ? `set (${farnellKey.slice(0,8)}...)` : "❌ missing",
    },
    apiTests: { mouser: mouserTest, digikey: digikeyTest, farnell: farnellTest },
    searchRoute: searchRouteTest,
  });
}

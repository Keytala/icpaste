// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Debug Route (TEMPORANEO — rimuovi dopo il test)
//  Visita: https://icpaste.vercel.app/api/debug
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mousserKey    = process.env.MOUSER_API_KEY;
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;
  const farnellKey    = process.env.FARNELL_API_KEY;
  const useMock       = process.env.NEXT_PUBLIC_USE_MOCK;

  // Test chiamata Mouser
  let mouserTest: string = "not tested";
  if (mousserKey && mousserKey !== "placeholder") {
    try {
      const res = await fetch(
        `https://api.mouser.com/api/v1/search/keyword?apiKey=${mousserKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            SearchByKeywordRequest: {
              keyword:        "LM358N",
              records:        1,
              startingRecord: 0,
              searchOptions:  "6",
              searchWithYourSignUpLanguage: "false",
            },
          }),
        }
      );
      const json = await res.json();
      mouserTest = res.ok
        ? `✅ OK — ${json.SearchResults?.NumberOfResult ?? 0} results`
        : `❌ HTTP ${res.status} — ${JSON.stringify(json).slice(0, 100)}`;
    } catch (e: unknown) {
      mouserTest = `❌ Exception: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Test token DigiKey
  let digikeyTest: string = "not tested";
  if (digikeyId && digikeyId !== "placeholder" && digikeySecret && digikeySecret !== "placeholder") {
    try {
      const res = await fetch("https://api.digikey.com/v1/oauth2/token", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     digikeyId,
          client_secret: digikeySecret,
          grant_type:    "client_credentials",
        }),
      });
      const json = await res.json();
      digikeyTest = res.ok
        ? `✅ Token OK — expires in ${json.expires_in}s`
        : `❌ HTTP ${res.status} — ${JSON.stringify(json).slice(0, 100)}`;
    } catch (e: unknown) {
      digikeyTest = `❌ Exception: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Test Farnell
  let farnellTest: string = "not tested";
  if (farnellKey && farnellKey !== "placeholder") {
    try {
      const params = new URLSearchParams({
        callInfo: JSON.stringify({
          apiKey: farnellKey,
          responseDataFormat: "json",
          storeInfo: { id: "it.farnell.com", type: "global", locale: "it_IT" },
        }),
        term:            "manuPartNum:LM358N",
        start:           "0",
        numberOfResults: "1",
      });
      const res = await fetch(
        `https://api.element14.com/catalog/products?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );
      const json = await res.json();
      farnellTest = res.ok
        ? `✅ OK — ${JSON.stringify(json).slice(0, 80)}`
        : `❌ HTTP ${res.status} — ${JSON.stringify(json).slice(0, 100)}`;
    } catch (e: unknown) {
      farnellTest = `❌ Exception: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_USE_MOCK:  useMock,
      MOUSER_API_KEY:        mousserKey    ? `set (${mousserKey.slice(0, 6)}...)` : "❌ missing",
      DIGIKEY_CLIENT_ID:     digikeyId     ? `set (${digikeyId.slice(0, 6)}...)` : "❌ missing",
      DIGIKEY_CLIENT_SECRET: digikeySecret ? `set (${digikeySecret.slice(0, 6)}...)` : "❌ missing",
      FARNELL_API_KEY:       farnellKey    ? `set (${farnellKey.slice(0, 6)}...)` : "❌ missing",
    },
    apiTests: {
      mouser:  mouserTest,
      digikey: digikeyTest,
      farnell: farnellTest,
    },
  });
}

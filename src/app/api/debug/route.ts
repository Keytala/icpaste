import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mousserKey    = process.env.MOUSER_API_KEY;
  const digikeyId     = process.env.DIGIKEY_CLIENT_ID;
  const digikeySecret = process.env.DIGIKEY_CLIENT_SECRET;
  const farnellKey    = process.env.FARNELL_API_KEY;

  // ── Mouser ────────────────────────────────────────────────────────────────
  let mouserResult: unknown = "not tested";
  if (mousserKey && mousserKey !== "placeholder") {
    try {
      const res  = await fetch(
        `https://api.mouser.com/api/v1/search/keyword?apiKey=${mousserKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            SearchByKeywordRequest: {
              keyword:        "LM358N",
              records:        3,
              startingRecord: 0,
              searchOptions:  "2",
              searchWithYourSignUpLanguage: "false",
            },
          }),
        }
      );
      const text = await res.text();
      mouserResult = { status: res.status, body: text.slice(0, 500) };
    } catch (e: unknown) {
      mouserResult = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── Farnell — testa 3 store diversi ──────────────────────────────────────
  const farnellStores = [
    "it.farnell.com",
    "uk.farnell.com",
    "www.farnell.com",
  ];

  const farnellResults: Record<string, unknown> = {};

  if (farnellKey && farnellKey !== "placeholder") {
    for (const store of farnellStores) {
      try {
        const params = new URLSearchParams({
          "term":                            "manuPartNum:LM358N",
          "storeInfo.id":                    store,
          "storeInfo.type":                  "global",
          "storeInfo.locale":                "it_IT",
          "resultsSettings.offset":          "0",
          "resultsSettings.numberOfResults": "2",
          "resultsSettings.sortBy":          "unitPrice",
          "resultsSettings.sortOrder":       "asc",
          "callInfo.responseDataFormat":     "json",
          "userinfo.apiKey":                 farnellKey,
        });

        const url = `https://api.element14.com/catalog/products?${params.toString()}`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        const text = await res.text();
        farnellResults[store] = {
          status:      res.status,
          contentType: res.headers.get("content-type"),
          body:        text.slice(0, 300),
        };
      } catch (e: unknown) {
        farnellResults[store] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  // ── DigiKey ───────────────────────────────────────────────────────────────
  let digikeyResult: unknown = "not tested";
  if (digikeyId && digikeySecret &&
      digikeyId !== "placeholder" && digikeySecret !== "placeholder") {
    try {
      const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     digikeyId,
          client_secret: digikeySecret,
          grant_type:    "client_credentials",
        }),
      });
      const tokenJson = await tokenRes.json();
      const token     = tokenJson.access_token;

      const searchRes = await fetch(
        "https://api.digikey.com/products/v4/search/keyword",
        {
          method:  "POST",
          headers: {
            "Content-Type":              "application/json",
            "Accept":                    "application/json",
            "Authorization":             `Bearer ${token}`,
            "X-DIGIKEY-Client-Id":       digikeyId,
            "X-DIGIKEY-Locale-Site":     "IT",
            "X-DIGIKEY-Locale-Language": "it",
            "X-DIGIKEY-Locale-Currency": "EUR",
          },
          body: JSON.stringify({
            Keywords:          "LM358N",
            RecordCount:       3,
            RecordStartPos:    0,
            RequestedQuantity: 100,
            SearchOptions:     ["ManufacturerPartSearch"],
          }),
        }
      );
      const text = await searchRes.text();
      digikeyResult = {
        status:      searchRes.status,
        contentType: searchRes.headers.get("content-type"),
        body:        text.slice(0, 400),
      };
    } catch (e: unknown) {
      digikeyResult = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    mouser:  mouserResult,
    farnell: farnellResults,
    digikey: digikeyResult,
  });
}

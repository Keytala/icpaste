/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const nexarId     = process.env.NEXAR_CLIENT_ID;
  const nexarSecret = process.env.NEXAR_CLIENT_SECRET;

  // ── 1. Variabili ambiente ─────────────────────────────────────────────────
  const env = {
    NEXAR_CLIENT_ID:     nexarId     ? `set (${nexarId.slice(0,8)}...)`     : "❌ missing",
    NEXAR_CLIENT_SECRET: nexarSecret ? `set (${nexarSecret.slice(0,8)}...)` : "❌ missing",
  };

  if (!nexarId || !nexarSecret) {
    return NextResponse.json({ env, error: "Nexar credentials missing" });
  }

  // ── 2. Token ──────────────────────────────────────────────────────────────
  let token: string | null = null;
  let tokenResult: any     = "not tested";

  try {
    const res = await fetch("https://identity.nexar.com/connect/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     nexarId,
        client_secret: nexarSecret,
      }),
    });
    const json = await res.json();
    token       = json.access_token ?? null;
    tokenResult = res.ok && token
      ? `✅ Token OK (expires in ${json.expires_in}s)`
      : `❌ HTTP ${res.status}: ${JSON.stringify(json).slice(0, 100)}`;
  } catch (e: any) {
    tokenResult = `❌ Exception: ${e.message}`;
  }

  if (!token) return NextResponse.json({ env, token: tokenResult });

  // ── 3. Search GraphQL ─────────────────────────────────────────────────────
  let searchResult: any = "not tested";

  try {
    const query = `
      query SearchMpn($mpn: String!) {
        supSearchMpn(q: $mpn, limit: 3) {
          hits {
            part {
              mpn
              shortDescription
              sellers(authorizedOnly: false) {
                company { name }
                offers {
                  inventoryLevel
                  moq
                  clickUrl
                  prices { quantity price currency }
                }
              }
            }
          }
        }
      }
    `;

    const res  = await fetch("https://api.nexar.com/graphql/", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: { mpn: "LM358N" } }),
    });

    const json = await res.json();

    if (json.errors) {
      searchResult = { error: json.errors };
    } else {
      const hits: any[] = json?.data?.supSearchMpn?.hits ?? [];
      const offers: any[] = [];

      for (const hit of hits) {
        const part    = hit?.part;
        const sellers = part?.sellers ?? [];
        for (const seller of sellers) {
          const name = seller?.company?.name ?? "";
          for (const offer of (seller?.offers ?? [])) {
            if (!offer?.prices?.length) continue;
            offers.push({
              distributor: name,
              mpn:         part?.mpn,
              stock:       offer.inventoryLevel,
              moq:         offer.moq,
              firstPrice:  offer.prices[0],
              clickUrl:    offer.clickUrl?.slice(0, 60) + "...",
            });
          }
        }
      }

      searchResult = {
        status:      res.status,
        hitsCount:   hits.length,
        offersCount: offers.length,
        offers:      offers.slice(0, 5),
      };
    }
  } catch (e: any) {
    searchResult = `❌ Exception: ${e.message}`;
  }

  return NextResponse.json({ env, token: tokenResult, search: searchResult });
}

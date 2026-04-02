// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Code Resolver
//
//  Given a detected distributor code, calls the appropriate API to
//  resolve it to the canonical Manufacturer Part Number (MPN).
//
//  Each resolver returns: { mpn: string | null, description: string }
//  If resolution fails, mpn is null and the original code is used as fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorCodeType } from "./code-detector";

export interface ResolvedCode {
  mpn:         string;        // resolved MPN (or original code as fallback)
  description: string;
  resolvedFrom: string;       // original distributor code
  wasResolved:  boolean;      // false = fallback to original code
}

// ── Mouser resolver ───────────────────────────────────────────────────────────
async function resolveMouser(code: string): Promise<ResolvedCode> {
  const apiKey = process.env.MOUSER_API_KEY ?? "";
  if (!apiKey) return fallback(code);

  try {
    const res = await fetch(
      `https://api.mouser.com/api/v1/search/partnumber?apiKey=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          SearchByPartRequest: {
            mouserPartNumber:  code,
            partSearchOptions: "Exact",
          },
        }),
      }
    );

    if (!res.ok) return fallback(code);

    const data  = await res.json();
    const parts = data?.SearchResults?.Parts ?? [];

    if (parts.length === 0) return fallback(code);

    const part = parts[0];
    return {
      mpn:          part.ManufacturerPartNumber ?? code,
      description:  part.Description ?? "",
      resolvedFrom: code,
      wasResolved:  true,
    };
  } catch {
    return fallback(code);
  }
}

// ── Digi-Key resolver ─────────────────────────────────────────────────────────
async function resolveDigikey(code: string): Promise<ResolvedCode> {
  const clientId  = process.env.DIGIKEY_CLIENT_ID ?? "";
  const clientSec = process.env.DIGIKEY_CLIENT_SECRET ?? "";
  if (!clientId || !clientSec) return fallback(code);

  try {
    // Get token
    const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSec,
      }),
    });

    if (!tokenRes.ok) return fallback(code);
    const { access_token } = await tokenRes.json();

    // Search by Digi-Key part number
    const res = await fetch(
      `https://api.digikey.com/products/v4/search/${encodeURIComponent(code)}/productdetails`,
      {
        headers: {
          "Authorization":             `Bearer ${access_token}`,
          "X-DIGIKEY-Client-Id":       clientId,
          "X-DIGIKEY-Locale-Site":     "US",
          "X-DIGIKEY-Locale-Language": "en",
          "X-DIGIKEY-Locale-Currency": "USD",
        },
      }
    );

    if (!res.ok) return fallback(code);

    const data = await res.json();
    const mpn  = data?.Product?.ManufacturerProductNumber;

    if (!mpn) return fallback(code);

    return {
      mpn,
      description:  data?.Product?.Description?.ProductDescription ?? "",
      resolvedFrom: code,
      wasResolved:  true,
    };
  } catch {
    return fallback(code);
  }
}

// ── Farnell resolver ──────────────────────────────────────────────────────────
async function resolveFarnell(code: string): Promise<ResolvedCode> {
  const apiKey = process.env.FARNELL_API_KEY ?? "";
  if (!apiKey) return fallback(code);

  try {
    const params = new URLSearchParams({
      "callInfo_omitXmlSchema":        "false",
      "response_responseGroup":        "prices,inventory",
      "callInfo_apiKey":               apiKey,
      "callInfo_responseDataFormat":   "json",
      "query.partNumberFacetId":       code,   // Farnell order code
      "storeInfo.id":                  "uk.farnell.com",
      "resultsSettings.offset":        "0",
      "resultsSettings.numberOfResults": "1",
    });

    const res = await fetch(
      `https://api.element14.com/catalog/products?${params.toString()}`
    );

    if (!res.ok) return fallback(code);

    const data     = await res.json();
    const products = data?.keywordSearchReturn?.products ?? [];

    if (products.length === 0) return fallback(code);

    const part = products[0];
    const mpn  = part.translatedManufacturerPartNumber ?? part.sku;

    return {
      mpn:          mpn ?? code,
      description:  part.displayName ?? "",
      resolvedFrom: code,
      wasResolved:  Boolean(mpn),
    };
  } catch {
    return fallback(code);
  }
}

// ── Fallback ──────────────────────────────────────────────────────────────────
function fallback(code: string): ResolvedCode {
  return {
    mpn:          code,   // use original code as-is and let adapters try
    description:  "",
    resolvedFrom: code,
    wasResolved:  false,
  };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
export async function resolveDistributorCode(
  code:        string,
  detectedAs:  DistributorCodeType
): Promise<ResolvedCode> {
  switch (detectedAs) {
    case "mouser":   return resolveMouser(code);
    case "digikey":  return resolveDigikey(code);
    case "farnell":  return resolveFarnell(code);
    default:
      // RS / TME / unknown → use code as-is, adapters will do keyword search
      return fallback(code);
  }
}

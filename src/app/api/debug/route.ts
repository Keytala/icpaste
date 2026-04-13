/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const id     = process.env.DIGIKEY_CLIENT_ID;
  const secret = process.env.DIGIKEY_CLIENT_SECRET;

  if (!id || !secret) {
    return NextResponse.json({ error: "DigiKey credentials missing" });
  }

  try {
    // Token
    const tokenRes = await fetch("https://api.digikey.com/v1/oauth2/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id, client_secret: secret, grant_type: "client_credentials",
      }),
    });
    const tokenJson = await tokenRes.json();
    const token     = tokenJson.access_token;
    if (!token) return NextResponse.json({ error: "No token", tokenJson });

    // Search LM358N
    const searchRes = await fetch("https://api.digikey.com/products/v4/search/keyword", {
      method:  "POST",
      headers: {
        "Content-Type":              "application/json",
        "Accept":                    "application/json",
        "Authorization":             `Bearer ${token}`,
        "X-DIGIKEY-Client-Id":       id,
        "X-DIGIKEY-Locale-Site":     "IT",
        "X-DIGIKEY-Locale-Language": "it",
        "X-DIGIKEY-Locale-Currency": "EUR",
      },
      body: JSON.stringify({
        Keywords: "LM358N", RecordCount: 3, RecordStartPos: 0,
        RequestedQuantity: 100, SearchOptions: ["ManufacturerPartSearch"],
      }),
    });

    const json = await searchRes.json();
    const p    = json?.Products?.[0];
    const v    = p?.ProductVariations?.[0];

    return NextResponse.json({
      tokenOk:       !!token,
      searchStatus:  searchRes.status,
      productsCount: json?.Products?.length ?? 0,
      firstProduct: p ? {
        mpn:          p.ManufacturerProductNumber,
        stock:        p.QuantityAvailable,
        variationsCount: p.ProductVariations?.length,
        firstVariation: v ? {
          stock:          v.QuantityAvailableforPackageType,
          packageUnit:    v.StandardPackage,
          pricingCount:   v.StandardPricing?.length,
          firstPrice:     v.StandardPricing?.[0],
        } : null,
      } : null,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}

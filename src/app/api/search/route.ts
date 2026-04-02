// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — API Route: POST /api/search
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { searchBom }                 from "@/lib/engine/search.engine";
import { parseBom, BomRow }          from "@/lib/utils/bom-parser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let bom: BomRow[] = [];

    // Accept either raw text (paste) or pre-parsed array
    if (typeof body.raw === "string") {
      bom = parseBom(body.raw);
    } else if (Array.isArray(body.bom)) {
      bom = body.bom as BomRow[];
    }

    if (bom.length === 0) {
      return NextResponse.json(
        { error: "No valid MPN/QTY pairs found in input." },
        { status: 400 }
      );
    }

    if (bom.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 components per search." },
        { status: 400 }
      );
    }

    const response = await searchBom(bom);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[API /search]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

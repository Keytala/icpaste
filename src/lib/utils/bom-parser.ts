// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — BOM Parser
//  Parses raw text input (paste or CSV) into BomRow[]
//
//  Supported formats:
//  1. "MPN QTY" per line  →  LM358N 100
//  2. "MPN,QTY" CSV       →  LM358N,100
//  3. "MPN;QTY" CSV       →  LM358N;100
//  4. Tab-separated       →  LM358N\t100
// ─────────────────────────────────────────────────────────────────────────────

import { BomRow } from "../types";

export function parseBom(raw: string): BomRow[] {
  const lines = raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  const rows: BomRow[] = [];

  for (const line of lines) {
    // Try splitting by common delimiters
    const parts = line.split(/[\t,;]+|\s{2,}|\s(?=\d)/).map(p => p.trim());

    if (parts.length < 2) continue;

    const mpn = parts[0].toUpperCase();
    const qty = parseInt(parts[1].replace(/[^0-9]/g, ""), 10);

    if (!mpn || isNaN(qty) || qty <= 0) continue;

    rows.push({ mpn, qty });
  }

  // Deduplicate: if same MPN appears twice, sum quantities
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.mpn, (map.get(row.mpn) ?? 0) + row.qty);
  }

  return Array.from(map.entries()).map(([mpn, qty]) => ({ mpn, qty }));
}

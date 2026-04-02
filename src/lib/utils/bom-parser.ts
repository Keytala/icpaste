// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — BOM Parser (v2 — with distributor code detection)
//
//  Parses raw text input and, for each row, detects whether the code
//  is a distributor order code or an MPN. Resolution happens later
//  in the search engine (async, server-side).
// ─────────────────────────────────────────────────────────────────────────────

import { detectCodeType, CodeDetectionResult } from "./code-detector";

export interface BomRow {
  rawCode:    string;                  // exactly as typed by the user
  qty:        number;
  detection:  CodeDetectionResult;     // pre-computed detection metadata
}

export function parseBom(raw: string): BomRow[] {
  const lines = raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  const rows: BomRow[] = [];

  for (const line of lines) {
    const parts = line.split(/[\t,;]+|\s{2,}|\s(?=\d)/).map(p => p.trim());
    if (parts.length < 2) continue;

    const rawCode = parts[0].toUpperCase();
    const qty     = parseInt(parts[1].replace(/[^0-9]/g, ""), 10);

    if (!rawCode || isNaN(qty) || qty <= 0) continue;

    rows.push({
      rawCode,
      qty,
      detection: detectCodeType(rawCode),
    });
  }

  // Deduplicate by rawCode, summing quantities
  const map = new Map<string, BomRow>();
  for (const row of rows) {
    if (map.has(row.rawCode)) {
      map.get(row.rawCode)!.qty += row.qty;
    } else {
      map.set(row.rawCode, { ...row });
    }
  }

  return Array.from(map.values());
}

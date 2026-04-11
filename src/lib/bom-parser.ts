// ─────────────────────────────────────────────────────────────────────────────
//  icpaste v2 — BOM Parser
//  Supporta: "MPN QTY", "MPN,QTY", "MPN;QTY", "MPN\tQTY"
// ─────────────────────────────────────────────────────────────────────────────

import { BomRow } from "./types";

export function parseBom(raw: string): BomRow[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && !l.startsWith("//"))
    .map(line => {
      // Separa per tab, virgola, punto e virgola o spazio
      const parts = line.split(/[\t,;]+|\s+/);
      const mpn   = parts[0]?.trim().toUpperCase();
      // Cerca il primo numero nella riga
      const qtyStr = parts.slice(1).find(p => /^\d+$/.test(p.trim()));
      const qty    = parseInt(qtyStr ?? "0", 10);
      if (!mpn || qty <= 0) return null;
      return { mpn, qty };
    })
    .filter((r): r is BomRow => r !== null)
    .slice(0, 1000); // max 1000 righe
}

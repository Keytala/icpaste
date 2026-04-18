import { BomRow } from "./types";

export function parseBom(raw: string): BomRow[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && !l.startsWith("//"))
    .flatMap(line => {
      // Supporta: space, tab, comma, semicolon
      const parts = line.split(/[\t,;\s]+/).filter(Boolean);
      if (parts.length < 2) return [];
      // Trova il primo token numerico come qty
      for (let i = 1; i < parts.length; i++) {
        const qty = parseInt(parts[i].replace(/[^0-9]/g, ""), 10);
        if (qty > 0) {
          const mpn = parts.slice(0, i).join(" ").toUpperCase().trim();
          if (mpn) return [{ mpn, qty }];
        }
      }
      return [];
    })
    .filter((r): r is BomRow => !!r.mpn && r.qty > 0)
    .slice(0, 1000);
}

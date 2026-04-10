typescript

import { BomRow } from "./types";



export function parseBom(raw: string): BomRow[] {

return raw

.split("\n")

.map(l => l.trim())

.filter(l => l && !l.startsWith("#"))

.map(line => {

const parts = line.split(/[\t,;\s]+/);

const mpn   = parts[0]?.toUpperCase().trim();

const qty   = parseInt(parts[1]?.replace(/\D/g, "") ?? "0", 10);
if (!mpn || !qty || qty <= 0) return null;
return { mpn, qty };

})

.filter((r): r is BomRow => r !== null);

}

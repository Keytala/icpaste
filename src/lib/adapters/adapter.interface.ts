// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Adapter Interface
//  Ogni adapter deve implementare questa interfaccia.
// ─────────────────────────────────────────────────────────────────────────────

import { PartResult } from "../types";

export interface DistributorAdapter {
  name:   string;
  search: (mpn: string, qty: number) => Promise<PartResult[]>;
}

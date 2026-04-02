// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Adapter Interface
//  Every distributor must implement this interface.
//  Adding a new distributor = create one file + register it in index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PartResult } from "../types";

export interface DistributorAdapter {
  /** Human-readable name shown in the UI */
  name: string;

  /**
   * Search for a part by MPN.
   * Returns an array of PartResult (may be empty if not found).
   * Should NEVER throw — catch errors internally and return [].
   */
  search(mpn: string, qty: number): Promise<PartResult[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Registry
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { MouserAdapter }      from "./mouser.adapter";
import { DigikeyAdapter }     from "./digikey.adapter";
import { FarnellAdapter }     from "./farnell.adapter";
import {
  MockMouserAdapter,
  MockDigikeyAdapter,
  MockFarnellAdapter,
} from "./mock.adapter";

// ── Mock mode ─────────────────────────────────────────────────────────────────
const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
  !process.env.MOUSER_API_KEY      ||
  process.env.MOUSER_API_KEY       === "placeholder";

// ── Farnell: attivo solo se la variabile FARNELL_ENABLED=true ─────────────────
// Impostala su Vercel quando l'account Farnell sarà approvato
const FARNELL_ACTIVE =
  process.env.FARNELL_ENABLED === "true" &&
  !!process.env.FARNELL_API_KEY &&
  process.env.FARNELL_API_KEY !== "placeholder";

console.log(`[icpaste] Mode: ${USE_MOCK ? "MOCK" : "REAL"} | Farnell: ${FARNELL_ACTIVE ? "ON" : "OFF (pending activation)"}`);

export const distributors: DistributorAdapter[] = USE_MOCK
  ? [MockMouserAdapter, MockDigikeyAdapter, MockFarnellAdapter]
  : [
      MouserAdapter,
      DigikeyAdapter,
      ...(FARNELL_ACTIVE ? [FarnellAdapter] : []),
    ];

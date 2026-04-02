// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Registry
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter }  from "./adapter.interface";
import { MouserAdapter }       from "./mouser.adapter";
import { DigikeyAdapter }      from "./digikey.adapter";
import { FarnellAdapter }      from "./farnell.adapter";
import {
  MockMouserAdapter,
  MockDigikeyAdapter,
  MockFarnellAdapter,
} from "./mock.adapter";

// ── Forza mock se le API keys non sono configurate ────────────────────────────
const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ||
  !process.env.MOUSER_API_KEY ||
  process.env.MOUSER_API_KEY === "placeholder";

console.log(`[icpaste] Using ${USE_MOCK ? "MOCK" : "REAL"} adapters`);

export const distributors: DistributorAdapter[] = USE_MOCK
  ? [MockMouserAdapter, MockDigikeyAdapter, MockFarnellAdapter]
  : [MouserAdapter, DigikeyAdapter, FarnellAdapter];

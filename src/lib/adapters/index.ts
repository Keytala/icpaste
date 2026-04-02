// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Registry
//
//  To add a new distributor:
//  1. Create src/lib/adapters/your-distributor.adapter.ts
//  2. Import it below
//  3. Add it to the `distributors` array
//  That's it. The engine picks it up automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { MouserAdapter }      from "./mouser.adapter";
import { DigikeyAdapter }     from "./digikey.adapter";
import { FarnellAdapter }     from "./farnell.adapter";
// import { TMEAdapter }      from "./tme.adapter";      // ← future
// import { RSAdapter }       from "./rs.adapter";       // ← future

export const distributors: DistributorAdapter[] = [
  MouserAdapter,
  DigikeyAdapter,
  FarnellAdapter,
];

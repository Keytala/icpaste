// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Mock Adapter v2
//  Includes realistic no-stock scenarios to test the "Resolve" button
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult }         from "../types";

const MOCK_DB: Record<string, Omit<PartResult, "distributor" | "productUrl">[]> = {
  "LM358N": [
    {
      mpn: "LM358N", description: "Op Amp Dual GP ±16V/32V 8-Pin PDIP",
      stock: 12400, packageUnit: 1,
      priceTiers: [{ qty:1, price:0.52 },{ qty:100, price:0.32 },{ qty:1000, price:0.26 }],
      currency: "USD",
    },
  ],
  "BC547B": [
    {
      mpn: "BC547B", description: "Transistor NPN 45V 100mA TO-92",
      stock: 85000, packageUnit: 1,
      priceTiers: [{ qty:1, price:0.18 },{ qty:100, price:0.12 },{ qty:1000, price:0.08 }],
      currency: "USD",
    },
  ],
  "STM32F103C8T6": [
    {
      mpn: "STM32F103C8T6", description: "MCU 32-bit ARM Cortex M3 64KB Flash LQFP-48",
      stock: 3200, packageUnit: 250,
      priceTiers: [{ qty:1, price:5.20 },{ qty:100, price:4.10 },{ qty:250, price:3.75 }],
      currency: "USD",
    },
  ],
  "GRM188R71C104KA01D": [
    {
      mpn: "GRM188R71C104KA01D", description: "Cap Ceramic 100nF 16V X7R 0402 SMD",
      stock: 980000, packageUnit: 4000,
      priceTiers: [{ qty:1, price:0.018 },{ qty:1000, price:0.008 },{ qty:4000, price:0.005 }],
      currency: "USD",
    },
  ],
  "NE555P": [
    {
      mpn: "NE555P", description: "Timer Single 8-Pin PDIP",
      stock: 45000, packageUnit: 1,
      priceTiers: [{ qty:1, price:0.68 },{ qty:25, price:0.55 },{ qty:100, price:0.44 }],
      currency: "USD",
    },
  ],
  // ── No-stock scenario: cheapest distributor has 0 stock ───────────────────
  "ATMEGA328P-PU": [
    {
      mpn: "ATMEGA328P-PU", description: "MCU 8-bit AVR 32KB Flash 28-Pin PDIP",
      stock: 0,   // ← OUT OF STOCK (cheapest)
      packageUnit: 1,
      priceTiers: [{ qty:1, price:2.10 },{ qty:10, price:1.95 }],
      currency: "USD",
    },
  ],
  "ESP32-WROOM-32": [
    {
      mpn: "ESP32-WROOM-32", description: "WiFi+BT Module 4MB Flash",
      stock: 0,   // ← OUT OF STOCK (cheapest)
      packageUnit: 1,
      priceTiers: [{ qty:1, price:3.20 },{ qty:10, price:2.90 }],
      currency: "USD",
    },
  ],
};

const DIST_MULTIPLIERS: Record<string, number> = {
  "Mouser (Mock)":   1.00,
  "Digi-Key (Mock)": 1.04,
  "Farnell (Mock)":  0.97,
};

// For no-stock parts, only one distributor has stock (to test fallback)
const DIST_STOCK_OVERRIDE: Record<string, Record<string, number>> = {
  "ATMEGA328P-PU": {
    "Mouser (Mock)":   0,
    "Digi-Key (Mock)": 0,
    "Farnell (Mock)":  850,   // ← only Farnell has stock
  },
  "ESP32-WROOM-32": {
    "Mouser (Mock)":   0,
    "Digi-Key (Mock)": 320,   // ← only DigiKey has stock
    "Farnell (Mock)":  0,
  },
};

function mockUrl(distributor: string, mpn: string): string {
  const base: Record<string, string> = {
    "Mouser (Mock)":   `https://www.mouser.com/Search/Refine?Keyword=${mpn}`,
    "Digi-Key (Mock)": `https://www.digikey.com/en/products/result?keywords=${mpn}`,
    "Farnell (Mock)":  `https://uk.farnell.com/search?st=${mpn}`,
  };
  return base[distributor] ?? "#";
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createMockAdapter(distributorName: string): DistributorAdapter {
  return {
    name: distributorName,
    async search(mpn: string, _qty: number): Promise<PartResult[]> {
      await delay(200 + Math.random() * 200);

      const normalizedMpn = mpn.toUpperCase().trim();
      const parts = MOCK_DB[normalizedMpn];
      if (!parts) return [];

      const multiplier = DIST_MULTIPLIERS[distributorName] ?? 1;
      const stockOverride = DIST_STOCK_OVERRIDE[normalizedMpn];

      return parts.map(p => {
        const stock = stockOverride
          ? (stockOverride[distributorName] ?? 0)
          : p.stock;

        return {
          ...p,
          stock,
          distributor: distributorName,
          productUrl:  mockUrl(distributorName, p.mpn),
          priceTiers:  p.priceTiers.map(t => ({
            qty:   t.qty,
            price: parseFloat((t.price * multiplier).toFixed(4)),
          })),
        };
      });
    },
  };
}

export const MockMouserAdapter   = createMockAdapter("Mouser (Mock)");
export const MockDigikeyAdapter  = createMockAdapter("Digi-Key (Mock)");
export const MockFarnellAdapter  = createMockAdapter("Farnell (Mock)");

// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Mock Adapter v3
//  Scenari realistici per testare smart qty optimization
// ─────────────────────────────────────────────────────────────────────────────

import { DistributorAdapter } from "./adapter.interface";
import { PartResult }         from "../types";

const MOCK_DB: Record<string, Omit<PartResult, "distributor" | "productUrl">[]> = {

  // ── Scenario normale ──────────────────────────────────────────────────────
  "LM358N": [{
    mpn: "LM358N", description: "Op Amp Dual GP ±16V/32V 8-Pin PDIP",
    stock: 12400, packageUnit: 1,
    priceTiers: [
      { qty: 1,    price: 0.52 },
      { qty: 10,   price: 0.44 },
      { qty: 100,  price: 0.32 },
      { qty: 1000, price: 0.26 },
    ],
    currency: "USD",
  }],

  // ── Scenario: price step conviene (22 pz → proponi 25 pz) ────────────────
  // qty:22 → tier qty:1 → 0.85/pz → tot 18.70
  // qty:25 → tier qty:25 → 0.62/pz → tot 15.50 ← MEGLIO!
  "BC547B": [{
    mpn: "BC547B", description: "Transistor NPN 45V 100mA TO-92",
    stock: 85000, packageUnit: 1,
    priceTiers: [
      { qty: 1,    price: 0.85 },
      { qty: 25,   price: 0.62 },   // ← scaglione conveniente
      { qty: 100,  price: 0.42 },
      { qty: 500,  price: 0.28 },
      { qty: 1000, price: 0.18 },
    ],
    currency: "USD",
  }],

  // ── Scenario: reel conviene (2700 pz cut tape vs 3000 reel) ──────────────
  // qty:2700 → packageUnit:1 (cut tape) → tier qty:1000 → 0.008/pz → tot 21.60
  // qty:3000 → packageUnit:3000 (reel)  → tier qty:3000 → 0.005/pz → tot 15.00 ← MEGLIO!
  "GRM188R71C104KA01D": [{
    mpn: "GRM188R71C104KA01D", description: "Cap Ceramic 100nF 16V X7R 0402 SMD",
    stock: 980000, packageUnit: 4000,
    priceTiers: [
      { qty: 1,     price: 0.018 },
      { qty: 100,   price: 0.012 },
      { qty: 1000,  price: 0.008 },
      { qty: 4000,  price: 0.005 },
      { qty: 10000, price: 0.004 },
    ],
    currency: "USD",
  }],

  // ── Scenario: package unit + price step insieme ───────────────────────────
  // qty:480 → packageUnit:500 → arrotonda a 500
  // tier qty:500 → 3.75/pz → tot 1875
  // tier qty:250 → 4.10/pz → tot 1968 (480 pz)
  // → ADJ: both (package + pricestep)
  "STM32F103C8T6": [{
    mpn: "STM32F103C8T6", description: "MCU 32-bit ARM Cortex M3 64KB Flash LQFP-48",
    stock: 3200, packageUnit: 250,
    priceTiers: [
      { qty: 1,   price: 5.20 },
      { qty: 10,  price: 4.85 },
      { qty: 100, price: 4.10 },
      { qty: 250, price: 3.75 },
      { qty: 500, price: 3.40 },
    ],
    currency: "USD",
  }],

  // ── Scenario normale ──────────────────────────────────────────────────────
  "NE555P": [{
    mpn: "NE555P", description: "Timer Single 8-Pin PDIP",
    stock: 45000, packageUnit: 1,
    priceTiers: [
      { qty: 1,    price: 0.68 },
      { qty: 25,   price: 0.55 },
      { qty: 100,  price: 0.44 },
      { qty: 1000, price: 0.35 },
    ],
    currency: "USD",
  }],

  // ── Scenario out of stock con fallback ────────────────────────────────────
  "ATMEGA328P-PU": [{
    mpn: "ATMEGA328P-PU", description: "MCU 8-bit AVR 32KB Flash 28-Pin PDIP",
    stock: 0, packageUnit: 1,
    priceTiers: [
      { qty: 1,   price: 2.10 },
      { qty: 10,  price: 1.95 },
      { qty: 100, price: 1.75 },
    ],
    currency: "USD",
  }],

  "ESP32-WROOM-32": [{
    mpn: "ESP32-WROOM-32", description: "WiFi+BT Module 4MB Flash",
    stock: 0, packageUnit: 1,
    priceTiers: [
      { qty: 1,  price: 3.20 },
      { qty: 10, price: 2.90 },
    ],
    currency: "USD",
  }],
};

const DIST_MULTIPLIERS: Record<string, number> = {
  "Mouser (Mock)":   1.00,
  "Digi-Key (Mock)": 1.04,
  "Farnell (Mock)":  0.97,
};

const DIST_STOCK_OVERRIDE: Record<string, Record<string, number>> = {
  "ATMEGA328P-PU": {
    "Mouser (Mock)":   0,
    "Digi-Key (Mock)": 0,
    "Farnell (Mock)":  850,
  },
  "ESP32-WROOM-32": {
    "Mouser (Mock)":   0,
    "Digi-Key (Mock)": 320,
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
      await delay(150 + Math.random() * 150);

      const normalizedMpn = mpn.toUpperCase().trim();
      const parts = MOCK_DB[normalizedMpn];
      if (!parts) return [];

      const multiplier    = DIST_MULTIPLIERS[distributorName] ?? 1;
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
            price: parseFloat((t.price * multiplier).toFixed(5)),
          })),
        };
      });
    },
  };
}

export const MockMouserAdapter   = createMockAdapter("Mouser (Mock)");
export const MockDigikeyAdapter  = createMockAdapter("Digi-Key (Mock)");
export const MockFarnellAdapter  = createMockAdapter("Farnell (Mock)");

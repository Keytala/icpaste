// ─────────────────────────────────────────────────────────────────────────────
//  icpaste.com — Distributor Code Detector
//
//  Detects whether a given code is a distributor order code (not an MPN)
//  and resolves it to the canonical MPN via the distributor's own API.
//
//  Supported distributor codes:
//
//  MOUSER     → "512-LM358N"  or  "595-NE555P"
//               Pattern: 3-digit prefix + hyphen + alphanumeric
//
//  DIGI-KEY   → "296-1395-5-ND"  or  "LM358NFSCT-ND"  or  "LM358N-ND"
//               Pattern: ends with "-ND" or "-1-ND" or "-6-ND" etc.
//
//  FARNELL    → "9804385"  or  "2453378"  (pure 7-digit numeric)
//               Pattern: 7 consecutive digits only
//
//  RS         → "123-4567"  (3 digits + hyphen + 4 digits)
//               Pattern: \d{3}-\d{4}
//
//  TME        → "STM32F103C8T6-A"  — TME adds a suffix after a hyphen
//               (harder to detect reliably — handled via fallback search)
// ─────────────────────────────────────────────────────────────────────────────

export type DistributorCodeType =
  | "mouser"
  | "digikey"
  | "farnell"
  | "rs"
  | "unknown";

export interface CodeDetectionResult {
  isDistributorCode: boolean;
  detectedAs:        DistributorCodeType;
  originalCode:      string;
}

// ── Regex patterns ────────────────────────────────────────────────────────────

const PATTERNS: { type: DistributorCodeType; regex: RegExp }[] = [
  {
    // Mouser: "512-LM358N", "595-NE555P", "782-BC547BTF"
    type:  "mouser",
    regex: /^\d{3}-[A-Z0-9][A-Z0-9\-\.\/]{2,}$/i,
  },
  {
    // Digi-Key: anything ending in "-ND", "-1-ND", "-5-ND"
    type:  "digikey",
    regex: /^.+(-\d{1,2})?-ND$/i,
  },
  {
    // Farnell: exactly 7 digits
    type:  "farnell",
    regex: /^\d{7}$/,
  },
  {
    // RS Components: "123-4567"
    type:  "rs",
    regex: /^\d{3}-\d{4}$/,
  },
];

/**
 * Detects if a code looks like a distributor order code.
 * Returns detection metadata — does NOT resolve the MPN yet.
 */
export function detectCodeType(code: string): CodeDetectionResult {
  const trimmed = code.trim().toUpperCase();

  for (const { type, regex } of PATTERNS) {
    if (regex.test(trimmed)) {
      return {
        isDistributorCode: true,
        detectedAs:        type,
        originalCode:      code,
      };
    }
  }

  return {
    isDistributorCode: false,
    detectedAs:        "unknown",
    originalCode:      code,
  };
}

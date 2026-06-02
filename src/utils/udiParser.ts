// TIER 1 — universal, manufacturer-agnostic date extraction.
//
// If a value actually contains a UDI (GS1 element string), the production date
// is encoded in a STANDARD structure that is identical across every
// manufacturer. One parser replaces N per-manufacturer regexes. This is the
// scalable path; the per-manufacturer rules engine (tier 3) is only the
// fallback for legacy rows that carry a bare printed serial.
//
// Supports the human-readable bracketed form, e.g.
//   (01)06942767212345(11)190815(21)M19805530018
// and the common fixed-length production AIs (11/15/17 = YYMMDD).

import type { DateResult } from './enrichTypes';

export interface UdiParse {
  ais: Record<string, string>;
  di?: string; // (01) GTIN / device identifier
  serial?: string; // (21)
  lot?: string; // (10)
  expiry?: string; // (17)
  productionDate?: DateResult; // (11)
}

// GS1 two-digit year rule: 00–49 => 2000s, 50–99 => 1900s.
function gs1Year(yy: string): number {
  const n = Number(yy);
  return n <= 49 ? 2000 + n : 1900 + n;
}

function parseGs1Date(yymmdd: string, source: string): DateResult {
  const year = gs1Year(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // GS1 allows DD = '00' meaning "no specific day" -> month precision.
  if (dd !== '00') {
    return { value: `${year}-${mm}-${dd}`, precision: 'exact', confidence: 'high', source };
  }
  return { value: `${year}-${mm}`, precision: 'year-month', confidence: 'high', source };
}

/**
 * Parse a UDI element string. Returns null if the value carries no
 * recognizable application identifiers (i.e. it's a bare serial → tier 3).
 */
export function parseUdi(raw: string): UdiParse | null {
  const s = (raw || '').trim();
  if (!s.includes('(')) return null;

  const ais: Record<string, string> = {};
  const re = /\((\d{2,4})\)([^(]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    ais[m[1]] = m[2].trim();
  }
  if (Object.keys(ais).length === 0) return null;

  const result: UdiParse = { ais };
  if (ais['01']) result.di = ais['01'];
  if (ais['21']) result.serial = ais['21'];
  if (ais['10']) result.lot = ais['10'];
  if (ais['17']) result.expiry = ais['17'];

  const prod = ais['11'] || ais['15'];
  if (prod && /^\d{6}$/.test(prod)) {
    result.productionDate = parseGs1Date(prod, ais['11'] ? 'udi:gs1-ai11' : 'udi:gs1-ai15');
  }

  return result;
}

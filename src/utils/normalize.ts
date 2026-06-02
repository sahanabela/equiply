// Input normalization — the first tier of the pipeline. Canonicalizes
// manufacturer names and models so that "EDAN", "Edan", "Edan Instruments"
// all collapse to one key, and serials are stripped of barcode noise.

const MFR_ALIASES: Record<string, string> = {
  edaninstruments: 'Edan Instruments',
  edan: 'Edan Instruments',
  hillrom: 'Hill-Rom',
  welchallyn: 'Hill-Rom',
  cogentixmedical: 'Cogentix Medical',
  cogentix: 'Cogentix Medical',
  covidien: 'Covidien',
  medtronic: 'Covidien',
  biosonic: 'BioSonic',
  coltene: 'BioSonic',
  exergen: 'Exergen',
  americandiagnostic: 'American Diagnostic',
  adc: 'American Diagnostic',
};

export function normKeyMfr(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function canonicalManufacturer(s: string): string {
  return MFR_ALIASES[normKeyMfr(s)] ?? (s || '').trim();
}

export function normModel(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function pairKey(manufacturer: string, model: string): string {
  return `${normKeyMfr(manufacturer)}|${normModel(model)}`;
}

/** Key for joining the same physical unit across two files by serial number. */
export function serialJoinKey(serial: string): string {
  return (serial || '').toUpperCase().replace(/\s+/g, '');
}

/**
 * Models in source data often have separators stripped ("SE1200EXPRESS"),
 * while GUDID stores them with spaces/hyphens ("SE-1200 Express"). Re-inserting
 * a space at letter↔digit boundaries produces a token sequence that matches
 * GUDID's stored value (Lucene treats '-' as a separator, so a space variant
 * matches a hyphenated stored value). Returns the original plus any variant.
 */
export function modelVariants(model: string): string[] {
  const raw = (model || '').trim();
  if (!raw) return [];
  const set = new Set<string>([raw]);
  const add = (s: string) => {
    const v = s.replace(/\s+/g, ' ').trim();
    if (v) set.add(v);
  };
  // Space at every letter↔digit boundary: "SE1200EXPRESS" -> "SE 1200 EXPRESS"
  add(raw.replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2'));
  // Space before a trailing word that follows digits: "F9EXPRESS" -> "F9 EXPRESS"
  add(raw.replace(/(\d)([A-Za-z]{3,})$/, '$1 $2'));
  // Space before a trailing letter+digit code: "ELITEV5" -> "ELITE V5"
  add(raw.replace(/([A-Za-z]{3,})([A-Za-z]\d+)$/, '$1 $2'));
  return [...set];
}

/** A model that is actually a CE conformity mark, e.g. "CE 1434" (notified-body number) — not a model. */
export function isCeMark(model: string): boolean {
  return /^ce\s*\d{3,4}$/i.test((model || '').trim());
}

/**
 * Strip barcode noise that prefixes a human-readable serial:
 *  - a leading GS1 application identifier like "(21)"
 *  - a catalog/reference prefix like "460016-"
 * This is manufacturer-agnostic and runs before any rule matching.
 */
export function normalizeSerial(raw: string): string {
  let s = (raw || '').trim();
  s = s.replace(/^\(\d{2}\)/, '');
  if (s.includes('-')) s = s.slice(s.lastIndexOf('-') + 1);
  return s;
}

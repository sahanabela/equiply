import type { CsvDataset, CsvRow } from '../types/csv';
import type { Confidence, DateResult } from './enrichTypes';
import { EMPTY_DATE } from './enrichTypes';
import { canonicalManufacturer, pairKey, serialJoinKey } from './normalize';
import { parseUdi } from './udiParser';
import { applySerialRules } from './rulesEngine';
import { lookupOverride, type DeviceTypeResult } from '../data/deviceReference';
import { resolveDeviceType, resolveMany } from '../services/gudid';
import { classifyDeviceTypes, type ClassifyItem } from '../services/deviceClassifier';
import { trackEvent } from '../services/pendo';

// Only two columns are appended to the data. Confidence / precision / source
// are still computed internally (for the enrichment summary), but are not added
// to the output table.
export const DEVICE_TYPE_COL = 'device_type';
export const MANUFACTURED_DATE_COL = 'manufactured_date';

export const NEW_COLUMNS = [DEVICE_TYPE_COL, MANUFACTURED_DATE_COL];

export interface EnrichStats {
  totalRows: number;
  datesDecoded: number;
  datesFromUdi: number; // tier 1
  datesFromRules: number; // tier 3
  datesFromAsset: number; // filled from CMMS/procurement date column
  byConfidence: Record<Confidence, number>;
  typesFromOverride: number; // override layer (per row)
  typesFromGudid: number; // tier 2 (GUDID via openFDA, per row)
  typesFromModel: number; // tier 4 (LLM, per row)
  typesUnknown: number; // per row
  uniqueLookupPairs: number; // distinct pairs needing resolution (no override)
  gudidPairsResolved: number; // of those, resolved by GUDID
  uniqueUnknownPairs: number; // pairs still unresolved after GUDID (sent to LLM)
  usedModel: boolean;
}

export interface EnrichOutput {
  dataset: CsvDataset;
  stats: EnrichStats;
  newColumns: string[];
}

export interface EnrichOptions {
  apiKey?: string;
  model?: string;
  // serialJoinKey -> date, from a separate CMMS/asset export (see buildAssetDateIndex).
  assetDates?: Record<string, string>;
}

const COLUMN_HINTS = {
  manufacturer: ['manufacturer', 'make', 'mfr', 'mfg', 'brand', 'vendor'],
  model: ['model number', 'model no', 'model', 'modelnumber'],
  serial: ['serial number', 'serial no', 'serialnumber', 'serial', 'sn'],
  udi: ['udi', 'udi-di', 'di', 'barcode'],
  // A real manufacture date is preferred; otherwise fall back to a procurement /
  // install / in-service date from a CMMS/asset export as a best-available proxy.
  assetDate: [
    'date of manufacture', 'manufacture date',
    'install date', 'installation date', 'in service date', 'in-service date', 'date in service',
    'purchase date', 'acquisition date', 'date acquired', 'received date', 'date received',
  ],
};

function findColumn(headers: string[], hints: string[]): string | undefined {
  const lower = headers.map((h) => ({ raw: h, norm: h.toLowerCase().trim() }));
  for (const hint of hints) {
    const exact = lower.find((h) => h.norm === hint);
    if (exact) return exact.raw;
  }
  for (const hint of hints) {
    const partial = lower.find((h) => h.norm.includes(hint));
    if (partial) return partial.raw;
  }
  return undefined;
}

export interface DetectedColumns {
  manufacturer?: string;
  model?: string;
  serial?: string;
  udi?: string;
  assetDate?: string;
}

export function detectColumns(headers: string[]): DetectedColumns {
  // Don't let our own output columns be picked up as source columns.
  const source = headers.filter((h) => !NEW_COLUMNS.includes(h));
  return {
    manufacturer: findColumn(source, COLUMN_HINTS.manufacturer),
    model: findColumn(source, COLUMN_HINTS.model),
    serial: findColumn(source, COLUMN_HINTS.serial),
    udi: findColumn(source, COLUMN_HINTS.udi),
    assetDate: findColumn(source, COLUMN_HINTS.assetDate),
  };
}

/** Light, format-tolerant date normalization. Returns '' if unparseable. */
export function parseLooseDate(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s); // ISO
  if (m) return m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s); // US M/D/Y
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  if (/^\d{4}$/.test(s)) return s; // bare year
  return s; // keep original rather than lose information
}

/**
 * Build a serial -> date index from a separate CMMS/asset-export dataset, to
 * join dates onto the main file by serial number. Detects the serial column and
 * a date column automatically. Returns {} if either is missing.
 */
export function buildAssetDateIndex(dataset: CsvDataset): Record<string, string> {
  const cols = detectColumns(dataset.headers);
  if (!cols.serial || !cols.assetDate) return {};
  const index: Record<string, string> = {};
  for (const row of dataset.rows) {
    const key = serialJoinKey(row[cols.serial] ?? '');
    if (!key || index[key]) continue;
    const date = parseLooseDate(row[cols.assetDate] ?? '');
    if (date) index[key] = date;
  }
  return index;
}

/** Thrown when the dataset has no recognizable manufacturer or serial-number column. */
export class MissingColumnsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingColumnsError';
  }
}

/**
 * Layered enrichment pipeline:
 *   normalize → tier1 UDI/PI parse → tier3 serial rules        (manufactured_date)
 *   normalize → tier2 reference join → tier4 LLM (review only)  (device_type)
 *
 * Tiers 1–3 cost zero tokens. Tier 4 runs at most once, batched over the
 * deduped set of unknown (manufacturer, model) pairs.
 */
export async function enrichDataset(
  dataset: CsvDataset,
  options: EnrichOptions = {},
): Promise<EnrichOutput> {
  const cols = detectColumns(dataset.headers);
  if (!cols.manufacturer || !cols.serial) {
    throw new MissingColumnsError(
      'Could not find the required columns. Expected a manufacturer column and a serial-number column.',
    );
  }

  const stats: EnrichStats = {
    totalRows: dataset.rows.length,
    datesDecoded: 0,
    datesFromUdi: 0,
    datesFromRules: 0,
    datesFromAsset: 0,
    byConfidence: { high: 0, medium: 0, low: 0, none: 0 },
    typesFromOverride: 0,
    typesFromGudid: 0,
    typesFromModel: 0,
    typesUnknown: 0,
    uniqueLookupPairs: 0,
    gudidPairsResolved: 0,
    uniqueUnknownPairs: 0,
    usedModel: false,
  };

  // --- Pass 1: dates (tier1/tier3) + override types; collect pairs to look up
  const dateByRow: DateResult[] = new Array(dataset.rows.length);
  const overrideByRow: DeviceTypeResult[] = new Array(dataset.rows.length);

  interface LookupPair extends ClassifyItem {
    di?: string;
  }
  const lookupPairs = new Map<string, LookupPair>();

  dataset.rows.forEach((row, i) => {
    const rawMfr = row[cols.manufacturer!] ?? '';
    const canonMfr = canonicalManufacturer(rawMfr);
    const model = cols.model ? row[cols.model] ?? '' : '';
    const serial = row[cols.serial!] ?? '';
    const udiField = cols.udi ? row[cols.udi] ?? '' : '';

    // TIER 1 — universal UDI/PI parse (check a dedicated UDI column, else the serial).
    let date: DateResult | null = null;
    const udi = parseUdi(udiField) ?? parseUdi(serial);
    if (udi?.productionDate) {
      date = udi.productionDate;
      stats.datesFromUdi += 1;
    } else {
      // TIER 3 — data-driven serial rules.
      date = applySerialRules(canonMfr, model, serial);
      if (date) stats.datesFromRules += 1;
    }
    const finalDate = date ?? EMPTY_DATE;
    dateByRow[i] = finalDate;
    stats.byConfidence[finalDate.confidence] += 1;
    if (finalDate.value) stats.datesDecoded += 1;

    // OVERRIDE layer first; anything else is queued for the GUDID lookup.
    const override = lookupOverride(rawMfr, model);
    overrideByRow[i] = override;
    if (override.value) {
      stats.typesFromOverride += 1;
    } else {
      const key = pairKey(rawMfr, model);
      const existing = lookupPairs.get(key);
      if (!existing) {
        lookupPairs.set(key, { key, manufacturer: canonMfr, model, di: udi?.di });
      } else if (!existing.di && udi?.di) {
        existing.di = udi.di; // capture a DI if any row for this pair has one
      }
    }
  });

  stats.uniqueLookupPairs = lookupPairs.size;

  // --- Pass 2: TIER 2 — resolve device types against GUDID (openFDA), batched ---
  const gudidMap: Record<string, { value: string; confidence: Confidence; source: string }> = {};
  const pairsArr = [...lookupPairs.values()];
  await resolveMany(pairsArr, async (pair) => {
    try {
      const hit = await resolveDeviceType(pair.manufacturer, pair.model, pair.di);
      if (hit) gudidMap[pair.key] = hit;
    } catch {
      // network / CORS / rate-limit: leave unresolved -> falls through to LLM
    }
  });
  stats.gudidPairsResolved = Object.keys(gudidMap).length;

  // --- Pass 3: TIER 4 — one batched LLM call for what GUDID couldn't resolve ---
  const unknownPairs = pairsArr.filter((p) => !gudidMap[p.key]);
  stats.uniqueUnknownPairs = unknownPairs.length;
  let modelMap: Record<string, string> = {};
  if (unknownPairs.length > 0 && options.apiKey && options.model) {
    const classifyStartedAt = performance.now();
    modelMap = await classifyDeviceTypes(unknownPairs, {
      apiKey: options.apiKey,
      model: options.model,
    });
    const durationMs = Math.round(performance.now() - classifyStartedAt);
    stats.usedModel = true;

    // Same "real answer" check Pass 4 applies; pairs missing from the response count as unknown.
    const pairsClassified = unknownPairs.filter((p) => {
      const type = modelMap[p.key];
      return !!type && type.toLowerCase() !== 'unknown';
    }).length;
    trackEvent('ai_device_classification_completed', {
      model: options.model,
      pairsSent: unknownPairs.length,
      pairsClassified,
      pairsReturnedUnknown: unknownPairs.length - pairsClassified,
      durationMs,
      totalRows: dataset.rows.length,
    });
  }

  // --- Pass 4: assemble enriched rows with provenance ---
  const rows: CsvRow[] = dataset.rows.map((row, i) => {
    const rawMfr = row[cols.manufacturer!] ?? '';
    const model = cols.model ? row[cols.model] ?? '' : '';
    const date = dateByRow[i];
    const override = overrideByRow[i];
    const key = pairKey(rawMfr, model);

    let deviceType = override.value;

    if (!deviceType) {
      const gudid = gudidMap[key];
      if (gudid) {
        deviceType = gudid.value;
        stats.typesFromGudid += 1;
      } else {
        const fromModel = modelMap[key];
        if (fromModel && fromModel.toLowerCase() !== 'unknown') {
          deviceType = fromModel; // LLM = suggestion pending review, never authoritative
          stats.typesFromModel += 1;
        } else {
          deviceType = stats.usedModel ? 'Unknown' : 'Not classified';
          stats.typesUnknown += 1;
        }
      }
    }

    // Fill date gaps from CMMS/procurement data when the serial/UDI couldn't
    // yield one (a best-available proxy for unit age): first a date column in
    // this file, then a joined separate asset export keyed by serial number.
    let dateValue = date.value;
    if (!dateValue) {
      if (cols.assetDate) dateValue = parseLooseDate(row[cols.assetDate] ?? '');
      if (!dateValue && options.assetDates) {
        dateValue = options.assetDates[serialJoinKey(row[cols.serial!] ?? '')] ?? '';
      }
      if (dateValue) {
        stats.datesFromAsset += 1;
        stats.datesDecoded += 1;
      }
    }

    return {
      ...row,
      [DEVICE_TYPE_COL]: deviceType,
      [MANUFACTURED_DATE_COL]: dateValue,
    };
  });

  // Avoid duplicate headers on re-enrichment.
  const headers = dataset.headers.filter((h) => !NEW_COLUMNS.includes(h));

  return {
    dataset: { ...dataset, headers: [...headers, ...NEW_COLUMNS], rows },
    stats,
    newColumns: NEW_COLUMNS,
  };
}

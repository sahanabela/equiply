// TIER 3 — data-driven serial-pattern rules (the fallback for legacy rows that
// carry a bare printed serial instead of a full UDI).
//
// Adding/adjusting a manufacturer is a DATA edit here — no new code, no new
// function. Every rule ships golden `fixtures` so the engine can self-validate
// (see validateRuleset in rulesEngine.ts). Rules are versioned via `id` so a
// format change becomes a new rule rather than a silent edit.
//
// `manufacturer` is matched against the CANONICAL name (see normalize.ts).
// The serial is normalized (barcode prefixes stripped) before the regex runs.

import type { Confidence, Precision } from '../utils/enrichTypes';

export interface SerialRule {
  id: string;
  manufacturer: string;
  models?: string[]; // optional normModel allow-list; omit = all models
  regex: string; // matched case-insensitively against the normalized serial
  date?: {
    yearGroup?: string;
    yearBase?: number; // added to a 2-digit year (default 2000)
    yearFull?: boolean; // group already holds a 4-digit year
    monthGroup?: string;
    monthEncoding?: 'numeric' | 'edanHex'; // edanHex: 1-9, A=10, B=11, C=12
    weekGroup?: string;
    precision: Precision;
    confidence: Confidence;
    // Pattern is inferred from the data, not vendor-documented: append " (est.)"
    // to the value so estimates are never mistaken for verified dates.
    estimated?: boolean;
  };
  fixtures: Array<{ serial: string; expect: string }>; // expect '' = no date
}

export const SERIAL_RULES: SerialRule[] = [
  {
    id: 'hillrom-mmYYYY-v1',
    manufacturer: 'Hill-Rom',
    // MM + plant letter + 3-digit seq + YYYY  e.g. 02R2981999 = Feb 1999
    regex: '^(?<mm>\\d{2})[A-Z]\\d{3}(?<yyyy>\\d{4})$',
    date: {
      yearGroup: 'yyyy',
      yearFull: true,
      monthGroup: 'mm',
      monthEncoding: 'numeric',
      precision: 'year-month',
      confidence: 'high',
    },
    fixtures: [
      { serial: '02R2981999', expect: '1999-02' },
      { serial: '12M0591998', expect: '1998-12' },
      { serial: '10L9791999', expect: '1999-10' },
    ],
  },
  {
    id: 'edan-m-series-v1',
    manufacturer: 'Edan Instruments',
    // M + YY + month-char(1-9,A,B,C) + batch/seq
    regex: '^M(?<yy>\\d{2})(?<mon>[1-9A-C])',
    date: {
      yearGroup: 'yy',
      yearBase: 2000,
      monthGroup: 'mon',
      monthEncoding: 'edanHex',
      precision: 'year-month',
      confidence: 'medium',
    },
    fixtures: [
      { serial: 'M19805530018', expect: '2019-08' },
      { serial: 'M17902120005', expect: '2017-09' },
      { serial: 'M24A02930002', expect: '2024-10' },
      { serial: 'M14B08690005', expect: '2014-11' },
      // barcode-prefixed forms normalize before matching:
      { serial: '460016-M23116470013', expect: '2023-01' },
      { serial: '(21)460016-M18706470008', expect: '2018-07' },
    ],
  },
  {
    id: 'cogentix-cs-yyww-v1',
    manufacturer: 'Cogentix Medical',
    // CS + YY + WW + letter  e.g. CS1704F = 2017 week 04
    regex: '^CS(?<yy>\\d{2})(?<ww>\\d{2})[A-Z]$',
    date: {
      yearGroup: 'yy',
      yearBase: 2000,
      weekGroup: 'ww',
      precision: 'year-week',
      confidence: 'medium',
    },
    fixtures: [
      { serial: 'CS1704F', expect: '2017-W04' },
      { serial: 'CS0709N', expect: '2007-W09' },
    ],
  },
  {
    id: 'biosonic-yymm-v1',
    manufacturer: 'BioSonic',
    // Leading YY + MM (inferred from sample, low confidence)
    regex: '^(?<yy>\\d{2})(?<mm>\\d{2})\\d+$',
    date: {
      yearGroup: 'yy',
      yearBase: 2000,
      monthGroup: 'mm',
      monthEncoding: 'numeric',
      precision: 'year-month',
      confidence: 'low',
    },
    fixtures: [
      { serial: '131100008', expect: '2013-11' },
      { serial: '130402317', expect: '2013-04' },
    ],
  },
  {
    // ESTIMATE — not vendor-documented. Inferred pattern: [C] + YY + WW + sequence.
    // ADC's own pages only document serial *location*, not date encoding.
    id: 'adc-yyww-est-v1',
    manufacturer: 'American Diagnostic',
    regex: '^C?(?<yy>\\d{2})(?<ww>\\d{2})\\d+$',
    date: { yearGroup: 'yy', yearBase: 2000, weekGroup: 'ww', precision: 'year-week', confidence: 'low', estimated: true },
    fixtures: [
      { serial: '22192114', expect: '2022-W19 (est.)' },
      { serial: 'C241870143', expect: '2024-W18 (est.)' },
      { serial: 'C241843867', expect: '2024-W18 (est.)' },
    ],
  },
  {
    // ESTIMATE — not vendor-documented. Inferred pattern: A + YY + WW + sequence.
    // Could alternatively be a model/revision prefix; treat with caution.
    id: 'exergen-yyww-est-v1',
    manufacturer: 'Exergen',
    regex: '^A(?<yy>\\d{2})(?<ww>\\d{2})\\d+$',
    date: { yearGroup: 'yy', yearBase: 2000, weekGroup: 'ww', precision: 'year-week', confidence: 'low', estimated: true },
    fixtures: [
      { serial: 'A1539272', expect: '2015-W39 (est.)' },
      { serial: 'A1539059', expect: '2015-W39 (est.)' },
    ],
  },
];

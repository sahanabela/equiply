// Generic engine that interprets the SERIAL_RULES data. There is exactly ONE
// matcher here, regardless of how many manufacturers exist — the per-vendor
// knowledge lives in data (serialRules.ts), not in code.

import type { Confidence, DateResult, Precision } from './enrichTypes';
import { normalizeSerial, normModel } from './normalize';
import { SERIAL_RULES, type SerialRule } from '../data/serialRules';

const PAD2 = (n: number) => String(n).padStart(2, '0');

function decodeMonth(value: string, encoding: 'numeric' | 'edanHex'): number | null {
  if (encoding === 'edanHex') {
    if (/^[1-9]$/.test(value)) return Number(value);
    const hex: Record<string, number> = { A: 10, B: 11, C: 12 };
    return hex[value.toUpperCase()] ?? null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildDate(rule: SerialRule, groups: Record<string, string>): DateResult | null {
  const d = rule.date;
  if (!d) return null;

  const rawYear = d.yearGroup ? groups[d.yearGroup] : undefined;
  if (rawYear === undefined) return null;
  const year = d.yearFull ? Number(rawYear) : (d.yearBase ?? 2000) + Number(rawYear);

  let value = String(year);
  let precision: Precision = 'year';
  let confidence: Confidence = d.confidence;

  if (d.weekGroup && groups[d.weekGroup] !== undefined) {
    const week = Number(groups[d.weekGroup]);
    if (week >= 1 && week <= 53) {
      value = `${year}-W${PAD2(week)}`;
      precision = 'year-week';
    } // else: keep year-only (the inferred split was probably wrong)
  } else if (d.monthGroup && groups[d.monthGroup] !== undefined) {
    const month = decodeMonth(groups[d.monthGroup], d.monthEncoding ?? 'numeric');
    if (month !== null && month >= 1 && month <= 12) {
      value = `${year}-${PAD2(month)}`;
      precision = d.precision;
    } else {
      confidence = 'low'; // year decoded but month unusable
    }
  }

  // Mark inferred (non-documented) decodes so they're distinguishable from verified ones.
  if (d.estimated) value = `${value} (est.)`;

  return { value, precision, confidence, source: `rules:${rule.id}` };
}

function tryRule(rule: SerialRule, normalizedSerial: string): DateResult | null {
  const m = new RegExp(rule.regex, 'i').exec(normalizedSerial);
  if (!m) return null;
  return buildDate(rule, m.groups ?? {});
}

/**
 * Decode a manufactured date from a bare serial using the rules data.
 * Returns null when no rule for the manufacturer matches.
 */
export function applySerialRules(
  canonicalManufacturer: string,
  model: string,
  rawSerial: string,
  rules: SerialRule[] = SERIAL_RULES,
): DateResult | null {
  const serial = normalizeSerial(rawSerial);
  if (!serial) return null;
  const nm = normModel(model);

  for (const rule of rules) {
    if (rule.manufacturer !== canonicalManufacturer) continue;
    if (rule.models && !rule.models.includes(nm)) continue;
    const decoded = tryRule(rule, serial);
    if (decoded) return decoded;
  }
  return null;
}

// --- Self-validation against the golden fixtures embedded in each rule -------

export interface RuleValidation {
  passed: number;
  failed: number;
  failures: Array<{ ruleId: string; serial: string; expected: string; got: string }>;
}

export function validateRuleset(rules: SerialRule[] = SERIAL_RULES): RuleValidation {
  const result: RuleValidation = { passed: 0, failed: 0, failures: [] };
  for (const rule of rules) {
    for (const fx of rule.fixtures) {
      const decoded = tryRule(rule, normalizeSerial(fx.serial));
      const got = decoded?.value ?? '';
      if (got === fx.expect) {
        result.passed += 1;
      } else {
        result.failed += 1;
        result.failures.push({ ruleId: rule.id, serial: fx.serial, expected: fx.expect, got });
      }
    }
  }
  return result;
}

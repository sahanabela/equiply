// OVERRIDE layer for device_type. The authoritative source is GUDID (see
// services/gudid.ts); this small table only holds manual entries that run
// BEFORE the GUDID lookup — e.g. pre-UDI devices GUDID never indexed, or
// known data-quality cases. Approved LLM suggestions can be promoted here too.

import type { Confidence } from '../utils/enrichTypes';
import { isCeMark, pairKey } from '../utils/normalize';

const OVERRIDES: Record<string, string> = {
  // Hill-Rom Century beds are 1990s devices that predate UDI/GUDID (started ~2014),
  // so they aren't in the database. Identity is well established from the catalog.
  'hillrom|century': 'Hospital bed',
  'hillrom|centuryp1400': 'Hospital bed',
  'hillrom|pcenturyk3256': 'Hospital bed',
};

export interface DeviceTypeResult {
  value: string; // '' if no override applies
  confidence: Confidence;
  source: string; // 'reference:override' when matched
}

const NONE: DeviceTypeResult = { value: '', confidence: 'none', source: '' };

export function lookupOverride(manufacturer: string, model: string): DeviceTypeResult {
  // Data-quality case: the model column holds a CE conformity mark, not a model
  // (e.g. "CE 1434"). The true model is unrecoverable from this row, so device
  // type can't be determined — flag it cleanly instead of querying for garbage.
  if (isCeMark(model)) {
    return { value: 'Unknown (invalid model)', confidence: 'none', source: 'reference:override' };
  }

  const hit = OVERRIDES[pairKey(manufacturer, model)];
  return hit ? { value: hit, confidence: 'high', source: 'reference:override' } : NONE;
}

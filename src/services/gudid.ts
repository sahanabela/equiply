// TIER 2 — real device-type resolution against GUDID.
//
// AccessGUDID's public API only supports lookup by Device Identifier (DI), not
// search by brand/model. The SAME GUDID dataset is published by the FDA through
// openFDA's `device/udi` endpoint, which IS full-text searchable by company /
// brand / model and is CORS-enabled (Access-Control-Allow-Origin: *), so the
// browser can query it directly — no key, no proxy.
//
// The device type comes from the GMDN preferred term (gmdn_terms[].name), with
// FDA product-code name / device description as fallbacks.

import type { Confidence } from '../utils/enrichTypes';
import { modelVariants } from '../utils/normalize';

const env = import.meta.env as Record<string, string | undefined>;
const BASE = env.VITE_OPENFDA_BASE_URL || 'https://api.fda.gov';

export interface DeviceTypeResolution {
  value: string;
  confidence: Confidence;
  source: string; // 'gudid:openfda' (+ '/di' | '/model')
}

interface UdiRecord {
  gmdn_terms?: Array<{ name?: string }>;
  product_codes?: Array<{ name?: string }>;
  device_description?: string;
}

function extractType(r: UdiRecord): string | null {
  return (
    r.gmdn_terms?.find((g) => g.name)?.name ||
    r.product_codes?.find((p) => p.name)?.name ||
    r.device_description ||
    null
  );
}

async function search(expr: string, signal?: AbortSignal): Promise<string | null> {
  const url = `${BASE}/device/udi.json?search=${encodeURIComponent(expr)}&limit=1`;
  const res = await fetch(url, { signal });
  if (res.status === 404) return null; // openFDA returns 404 when there are no matches
  if (!res.ok) throw new Error(`openFDA ${res.status}`);
  const data = (await res.json()) as { results?: UdiRecord[] };
  const r = data.results?.[0];
  return r ? extractType(r) : null;
}

function phrase(s: string): string {
  return `"${(s || '').replace(/["\\]/g, ' ').trim()}"`;
}

/**
 * Resolve device type from GUDID. Tries progressively looser queries and
 * returns the first hit with a confidence reflecting match tightness.
 * Returns null if GUDID has nothing (→ caller falls through to the LLM tier).
 */
export async function resolveDeviceType(
  manufacturer: string,
  model: string,
  di?: string,
  signal?: AbortSignal,
): Promise<DeviceTypeResolution | null> {
  const mfr = phrase(manufacturer);

  type Attempt = { expr: string; confidence: Confidence; tag: string };
  const attempts: Attempt[] = [];

  // A DI is an exact device identity -> trust it outright.
  if (di) attempts.push({ expr: `identifiers.id:${phrase(di)}`, confidence: 'high', tag: '/di' });

  // Otherwise REQUIRE both company AND model to match. Looser queries (model-only
  // or company-only) were verified to return confident-looking but WRONG results
  // — a different company's "Century" eyeglasses, an unrelated probe from a
  // same-named company — so we deliberately don't fall back to them. We DO try
  // model variants (e.g. "SE1200EXPRESS" -> "SE 1200 Express") because source
  // models often have GUDID's separators stripped. No match -> null, and the
  // LLM tier proposes a reviewable answer rather than fabricating one.
  // The data's "manufacturer" may be a brand (e.g. BioSonic is a Coltène brand),
  // so match it against both company_name and brand_name.
  for (const variant of modelVariants(model)) {
    const mdl = phrase(variant);
    attempts.push({ expr: `company_name:${mfr} AND version_or_model_number:${mdl}`, confidence: 'high', tag: '/model' });
    attempts.push({ expr: `company_name:${mfr} AND brand_name:${mdl}`, confidence: 'high', tag: '/brand' });
    attempts.push({ expr: `brand_name:${mfr} AND version_or_model_number:${mdl}`, confidence: 'high', tag: '/brandmfr' });
    attempts.push({ expr: `company_name:${mfr} AND ${mdl}`, confidence: 'medium', tag: '/text' });
    attempts.push({ expr: `brand_name:${mfr} AND ${mdl}`, confidence: 'medium', tag: '/brandtext' });
  }

  for (const a of attempts) {
    const value = await search(a.expr, signal);
    if (value) return { value, confidence: a.confidence, source: `gudid:openfda${a.tag}` };
  }

  // Fallback: FDA registration & listing covers devices not in the UDI set
  // (pre-UDI, UDI-exempt). It's company-level, so it only disambiguates when the
  // company makes essentially ONE device type — otherwise we'd be guessing.
  return companyDominantType(manufacturer, signal);
}

const DOMINANCE_THRESHOLD = 0.8;

async function companyDominantType(
  manufacturer: string,
  signal?: AbortSignal,
): Promise<DeviceTypeResolution | null> {
  const expr = `registration.name:${phrase(manufacturer)}`;
  const url = `${BASE}/device/registrationlisting.json?search=${encodeURIComponent(
    expr,
  )}&count=products.openfda.device_name.exact`;
  let data: { results?: Array<{ term: string; count: number }> };
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }
  const results = data.results ?? [];
  if (results.length === 0) return null;
  const total = results.reduce((s, r) => s + r.count, 0) || 1;
  const top = results[0];
  // Only trust it when the company is effectively single-product.
  if (results.length === 1 || top.count / total >= DOMINANCE_THRESHOLD) {
    return { value: top.term, confidence: 'low', source: 'openfda:registrationlisting' };
  }
  return null;
}

/** Resolve many lookups with bounded concurrency (openFDA is rate-limited). */
export async function resolveMany<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 4,
): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

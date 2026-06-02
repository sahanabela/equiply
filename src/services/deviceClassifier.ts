// The ONLY token-spending step. Unknown (manufacturer, model) pairs are deduped
// upstream, so this sends one compact request for the whole file regardless of
// row count. Terse prompt + JSON mode keep tokens minimal.

export interface ClassifyItem {
  key: string; // stable identifier (the normalized "mfr|model")
  manufacturer: string;
  model: string;
}

export const SUPPORTED_MODELS = [
  'gpt-5.4-nano',
  'gpt-5.4-mini',
  'gpt-5.4-nano-2026-03-17',
  'gpt-5.4-mini-2026-03-17',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

interface ClassifyOpts {
  apiKey: string;
  model: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

const env = import.meta.env as Record<string, string | undefined>;

const SYSTEM_PROMPT =
  'You classify medical devices. For each item, return its device type as a short noun ' +
  'phrase (e.g. "Hospital bed", "Patient monitor", "Temporal artery thermometer"). ' +
  'Use "Unknown" if you are not confident. Respond ONLY as JSON: ' +
  '{"results":[{"key":string,"device_type":string}]}.';

function parseJson(content: string): Record<string, string> {
  const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned) as { results?: Array<{ key: string; device_type: string }> };
  const out: Record<string, string> = {};
  for (const r of parsed.results ?? []) {
    if (r && typeof r.key === 'string') out[r.key] = r.device_type ?? 'Unknown';
  }
  return out;
}

/**
 * Classify a deduped set of unknown devices. Returns a map of key -> device type.
 * Throws on transport/auth errors so the UI can surface them.
 */
export async function classifyDeviceTypes(
  items: ClassifyItem[],
  { apiKey, model, baseUrl, signal }: ClassifyOpts,
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const base = baseUrl || env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const userPayload = items.map((i) => ({ key: i.key, manufacturer: i.manufacturer, model: i.model }));

  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 60 + items.length * 24,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Classifier request failed (${res.status}): ${text.slice(0, 300) || res.statusText}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Classifier returned an empty response.');

  try {
    return parseJson(content);
  } catch {
    throw new Error('Could not parse classifier JSON response.');
  }
}

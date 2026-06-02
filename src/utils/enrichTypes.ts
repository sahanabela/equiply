// Shared vocabulary for the enrichment pipeline.

// How much we trust the value.
export type Confidence = 'high' | 'medium' | 'low' | 'none';

// Granularity of a decoded date — orthogonal to confidence.
export type Precision = 'exact' | 'year-month' | 'year-week' | 'year' | 'none';

export interface DateResult {
  value: string; // '' when nothing could be decoded
  precision: Precision;
  confidence: Confidence;
  source: string; // provenance, e.g. 'udi:gs1-ai11' | 'rules:edan-m-series-v1'
}

export const EMPTY_DATE: DateResult = {
  value: '',
  precision: 'none',
  confidence: 'none',
  source: '',
};

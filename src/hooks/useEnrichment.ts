import { useCallback, useState } from 'react';
import type { CsvDataset } from '../types/csv';
import { enrichDataset, MissingColumnsError, type EnrichStats } from '../utils/enrich';
import { ClassifierError, type ClassifierErrorType } from '../services/deviceClassifier';
import { trackEvent } from '../services/pendo';

type Status = 'idle' | 'running' | 'done' | 'error';

interface UseEnrichmentResult {
  status: Status;
  error: string | null;
  enriched: CsvDataset | null;
  stats: EnrichStats | null;
  run: (
    dataset: CsvDataset,
    apiKey: string,
    model: string,
    assetDates?: Record<string, string>,
  ) => Promise<void>;
  reset: () => void;
}

// Datasets that have already been through an enrichment run (successful or not), for
// isRerun — e.g. re-running after adding an API key or switching models. Module-level so
// it survives remounts; a WeakSet so it doesn't keep old uploads alive.
const attemptedDatasets = new WeakSet<CsvDataset>();

type EnrichFailure = {
  failedStage: 'column_detection' | 'ai_classification' | 'unknown';
  errorType: 'missing_columns' | `classifier_${ClassifierErrorType}` | 'unknown';
  httpStatus?: number;
};

// Categorized from the error's type, never its message: the classifier's message can echo
// the provider's response body, which may contain fragments of the user's API key.
function describeFailure(err: unknown): EnrichFailure {
  if (err instanceof MissingColumnsError) {
    return { failedStage: 'column_detection', errorType: 'missing_columns' };
  }
  if (err instanceof ClassifierError) {
    return {
      failedStage: 'ai_classification',
      errorType: `classifier_${err.type}`,
      httpStatus: err.status,
    };
  }
  return { failedStage: 'unknown', errorType: 'unknown' };
}

export function useEnrichment(): UseEnrichmentResult {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<CsvDataset | null>(null);
  const [stats, setStats] = useState<EnrichStats | null>(null);

  const run = useCallback(
    async (dataset: CsvDataset, apiKey: string, model: string, assetDates?: Record<string, string>) => {
      setStatus('running');
      setError(null);
      const startedAt = performance.now();
      const apiKeyProvided = !!apiKey.trim(); // the key itself is never tracked
      const isRerun = attemptedDatasets.has(dataset);
      attemptedDatasets.add(dataset);
      try {
        const result = await enrichDataset(dataset, {
          apiKey: apiKey.trim() || undefined,
          model,
          assetDates,
        });
        const durationMs = Math.round(performance.now() - startedAt);
        setEnriched(result.dataset);
        setStats(result.stats);
        setStatus('done');

        // usedModel is left out: it always equals apiKeyProvided && uniqueUnknownPairs > 0,
        // and dropping it keeps the payload under Pendo's 512-byte property limit.
        const s = result.stats;
        trackEvent('data_enrichment_completed', {
          model,
          apiKeyProvided,
          totalRows: s.totalRows,
          datesDecoded: s.datesDecoded,
          datesFromUdi: s.datesFromUdi,
          datesFromRules: s.datesFromRules,
          datesFromAsset: s.datesFromAsset,
          confidenceHigh: s.byConfidence.high,
          confidenceMedium: s.byConfidence.medium,
          confidenceLow: s.byConfidence.low,
          confidenceNone: s.byConfidence.none,
          typesFromOverride: s.typesFromOverride,
          typesFromGudid: s.typesFromGudid,
          typesFromModel: s.typesFromModel,
          typesUnknown: s.typesUnknown,
          uniqueLookupPairs: s.uniqueLookupPairs,
          gudidPairsResolved: s.gudidPairsResolved,
          uniqueUnknownPairs: s.uniqueUnknownPairs,
          durationMs,
          isRerun,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enrichment failed.');
        setStatus('error');
        trackEvent('data_enrichment_failed', {
          ...describeFailure(err),
          model,
          apiKeyProvided,
          totalRows: dataset.rows.length,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setEnriched(null);
    setStats(null);
  }, []);

  return { status, error, enriched, stats, run, reset };
}

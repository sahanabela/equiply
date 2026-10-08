import { useCallback, useState } from 'react';
import type { CsvDataset } from '../types/csv';
import { enrichDataset, type EnrichStats } from '../utils/enrich';

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

export function useEnrichment(): UseEnrichmentResult {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<CsvDataset | null>(null);
  const [stats, setStats] = useState<EnrichStats | null>(null);

  const run = useCallback(
    async (dataset: CsvDataset, apiKey: string, model: string, assetDates?: Record<string, string>) => {
      setStatus('running');
      setError(null);
      try {
        const result = await enrichDataset(dataset, {
          apiKey: apiKey.trim() || undefined,
          model,
          assetDates,
        });
        setEnriched(result.dataset);
        setStats(result.stats);
        setStatus('done');

        // Track successful data enrichment
        if (typeof pendo !== 'undefined') {
          const s = result.stats;
          pendo.track('data_enrichment_completed', {
            totalRows: s.totalRows,
            datesDecoded: s.datesDecoded,
            datesFromUdi: s.datesFromUdi,
            datesFromRules: s.datesFromRules,
            datesFromAsset: s.datesFromAsset,
            typesFromGudid: s.typesFromGudid,
            typesFromOverride: s.typesFromOverride,
            typesFromModel: s.typesFromModel,
            typesUnknown: s.typesUnknown,
            uniqueLookupPairs: s.uniqueLookupPairs,
            gudidPairsResolved: s.gudidPairsResolved,
            uniqueUnknownPairs: s.uniqueUnknownPairs,
            usedModel: s.usedModel,
            llmModel: model,
            confidenceHigh: s.byConfidence.high,
            confidenceMedium: s.byConfidence.medium,
            confidenceLow: s.byConfidence.low,
            confidenceNone: s.byConfidence.none,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Enrichment failed.';
        setError(errorMessage);
        setStatus('error');

        // Track enrichment failure
        if (typeof pendo !== 'undefined') {
          pendo.track('data_enrichment_failed', {
            errorMessage: errorMessage.substring(0, 200),
            hadApiKey: !!(apiKey.trim()),
            llmModel: model,
            totalRows: dataset.rows.length,
          });
        }
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

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enrichment failed.');
        setStatus('error');
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

import { useMemo } from 'react';
import type { CsvDataset } from '../types/csv';
import { DEVICE_TYPE_COL, MANUFACTURED_DATE_COL, detectColumns } from '../utils/enrich';

interface VisualizePanelProps {
  dataset: CsvDataset;
}

interface Bucket {
  label: string;
  count: number;
}

function tally(rows: CsvDataset['rows'], pick: (row: CsvDataset['rows'][number]) => string): Bucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row) || '—';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function BarChart({ title, buckets, sort }: { title: string; buckets: Bucket[]; sort?: 'count' | 'label' }) {
  const ordered = [...buckets].sort((a, b) =>
    sort === 'label' ? a.label.localeCompare(b.label) : b.count - a.count,
  );
  const max = Math.max(1, ...ordered.map((b) => b.count));

  return (
    <div className="chart-card">
      <h3 className="chart-card__title">{title}</h3>
      <div className="chart">
        {ordered.map((b) => (
          <div className="chart-row" key={b.label}>
            <span className="chart-row__label" title={b.label}>
              {b.label}
            </span>
            <span className="chart-row__track">
              <span className="chart-row__bar" style={{ width: `${(b.count / max) * 100}%` }} />
            </span>
            <span className="chart-row__value">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisualizePanel({ dataset }: VisualizePanelProps) {
  const charts = useMemo(() => {
    const rows = dataset.rows;
    const mfrCol = detectColumns(dataset.headers).manufacturer;
    const byType = tally(rows, (r) => r[DEVICE_TYPE_COL] || 'Unknown');
    const byYear = tally(rows, (r) => (r[MANUFACTURED_DATE_COL] ?? '').slice(0, 4) || 'no date');
    const byMfr = mfrCol ? tally(rows, (r) => r[mfrCol] ?? '') : [];
    return { byType, byYear, byMfr };
  }, [dataset]);

  const hasEnrichment = dataset.headers.includes(DEVICE_TYPE_COL);

  if (!hasEnrichment) {
    return <div className="enrich-warn">Run enrichment first to see charts of the new columns.</div>;
  }

  return (
    <div className="visualize">
      <BarChart title="Device type" buckets={charts.byType} sort="count" />
      <BarChart title="Manufactured year" buckets={charts.byYear} sort="label" />
      <BarChart title="Records per manufacturer" buckets={charts.byMfr} sort="count" />
    </div>
  );
}

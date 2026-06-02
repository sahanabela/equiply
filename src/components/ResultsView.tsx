import { useState } from 'react';
import type { CsvDataset } from '../types/csv';
import { DataPreview } from './DataPreview';
import { VisualizePanel } from './VisualizePanel';
import { NEW_COLUMNS } from '../utils/enrich';
import { exportCsv, exportJson } from '../utils/exportData';

interface ResultsViewProps {
  dataset: CsvDataset; // original
  enriched: CsvDataset | null;
  onClear: () => void;
}

type Tab = 'data' | 'charts';

export function ResultsView({ dataset, enriched, onClear }: ResultsViewProps) {
  const [tab, setTab] = useState<Tab>('data');
  const view = enriched ?? dataset;
  const isEnriched = !!enriched;
  const target = enriched ?? dataset;

  return (
    <section className="results">
      <div className="results-toolbar">
        <div className="tabs" role="tablist">
          <button
            type="button"
            className={`tab ${tab === 'data' ? 'tab--active' : ''}`}
            onClick={() => setTab('data')}
            role="tab"
            aria-selected={tab === 'data'}
          >
            Data
          </button>
          <button
            type="button"
            className={`tab ${tab === 'charts' ? 'tab--active' : ''}`}
            onClick={() => setTab('charts')}
            disabled={!isEnriched}
            title={isEnriched ? undefined : 'Enrich first'}
            role="tab"
            aria-selected={tab === 'charts'}
          >
            Charts
          </button>
        </div>

        <div className="results-toolbar__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => exportCsv(target)}
            disabled={!isEnriched}
            title={isEnriched ? 'Download enriched CSV' : 'Enrich first'}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => exportJson(target)}
            disabled={!isEnriched}
            title={isEnriched ? 'Download enriched JSON' : 'Enrich first'}
          >
            Export JSON
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            Upload new file
          </button>
        </div>
      </div>

      {tab === 'charts' && isEnriched ? (
        <VisualizePanel dataset={enriched!} />
      ) : (
        <DataPreview dataset={view} highlightColumns={isEnriched ? NEW_COLUMNS : []} />
      )}
    </section>
  );
}

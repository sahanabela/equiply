import { useEffect, useMemo, useState } from 'react';
import type { CsvDataset } from '../types/csv';
import { useEnrichment } from '../hooks/useEnrichment';
import { detectColumns, type EnrichStats } from '../utils/enrich';
import { SUPPORTED_MODELS } from '../services/deviceClassifier';

interface EnrichPanelProps {
  dataset: CsvDataset;
  onEnriched: (dataset: CsvDataset) => void;
}

export function EnrichPanel({ dataset, onEnriched }: EnrichPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<string>(SUPPORTED_MODELS[0]);
  const { status, error, stats, enriched, run } = useEnrichment();

  const cols = useMemo(() => detectColumns(dataset.headers), [dataset.headers]);
  const missingCols = !cols.manufacturer || !cols.serial;

  // Lift the enriched dataset up to the parent once it's ready.
  useEffect(() => {
    if (status === 'done' && enriched) onEnriched(enriched);
  }, [status, enriched, onEnriched]);

  return (
    <section className="enrich-panel">
      <div className="enrich-panel__head">
        <h2 className="enrich-panel__title">Enrich</h2>
        <p className="enrich-panel__subtitle">
          Adds <code>device_type</code> and <code>manufactured_date</code>.
        </p>
      </div>

      {missingCols ? (
        <div className="enrich-warn" role="alert">
          Couldn&apos;t detect a manufacturer and serial-number column. Expected headers like{' '}
          <code>manufacturer</code> and <code>serial number</code>.
        </div>
      ) : (
        <div className="enrich-detected">
          Detected —{' '}
          <span className="chip">mfr: {cols.manufacturer}</span>{' '}
          <span className="chip">model: {cols.model ?? 'n/a'}</span>{' '}
          <span className="chip">serial: {cols.serial}</span>{' '}
          {cols.assetDate && <span className="chip">date fallback: {cols.assetDate}</span>}
        </div>
      )}

      <div className="enrich-controls">
        <label className="field">
          <span className="field__label">API key</span>
          <input
            type="password"
            className="field__input"
            placeholder="paste key — kept in memory only, never stored"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="field field--model">
          <span className="field__label">Model</span>
          <select className="field__input" value={model} onChange={(e) => setModel(e.target.value)}>
            {SUPPORTED_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => run(dataset, apiKey, model)}
          disabled={missingCols || status === 'running'}
        >
          {status === 'running' ? <span className="spinner spinner--sm" /> : 'Enrich data'}
        </button>
      </div>

      <p className="enrich-hint">
        No key? It still runs — dates and known device types are filled locally; unknown types are
        marked <code>Not classified</code>.
      </p>

      {error && (
        <div className="enrich-warn" role="alert">
          {error}
        </div>
      )}

      {status === 'done' && stats && <StatsView stats={stats} />}
    </section>
  );
}

function StatsView({ stats }: { stats: EnrichStats }) {
  const c = stats.byConfidence;
  return (
    <div className="enrich-stats">
      <div className="enrich-stats__row">
        <span className="badge badge--ok">
          {stats.datesDecoded}/{stats.totalRows} dates decoded
        </span>
        <span className="badge">UDI {stats.datesFromUdi}</span>
        <span className="badge">rules {stats.datesFromRules}</span>
        {stats.datesFromAsset > 0 && <span className="badge">asset {stats.datesFromAsset}</span>}
        <span className="badge">high {c.high}</span>
        <span className="badge">med {c.medium}</span>
        <span className="badge">low {c.low}</span>
        <span className="badge">none {c.none}</span>
      </div>
      <div className="enrich-stats__row">
        <span className="badge badge--ok">{stats.typesFromGudid} from GUDID</span>
        <span className="badge">{stats.typesFromOverride} override</span>
        <span className="badge">{stats.typesFromModel} via model</span>
        <span className="badge">{stats.typesUnknown} unknown</span>
        <span className="badge">
          GUDID resolved {stats.gudidPairsResolved}/{stats.uniqueLookupPairs} unique
        </span>
        {stats.usedModel && (
          <span className="badge">
            1 batched LLM call → {stats.uniqueUnknownPairs} device{stats.uniqueUnknownPairs === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
}

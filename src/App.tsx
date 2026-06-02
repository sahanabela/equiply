import { useState } from 'react';
import { CsvUploadZone } from './components/CsvUploadZone';
import { ResultsView } from './components/ResultsView';
import { EnrichPanel } from './components/EnrichPanel';
import { useCsvUpload } from './hooks/useCsvUpload';
import type { CsvDataset } from './types/csv';

function App() {
  const {
    dataset,
    isLoading,
    error,
    isDragging,
    uploadFile,
    clearDataset,
    setDragging,
  } = useCsvUpload();

  const [enriched, setEnriched] = useState<CsvDataset | null>(null);

  const handleClear = () => {
    setEnriched(null);
    clearDataset();
  };

  const active = enriched ? 'visualize' : dataset ? 'enrich' : 'upload';

  const stepClass = (step: string, done: boolean) =>
    `nav-step ${active === step ? 'nav-step--active' : done ? 'nav-step--done' : 'nav-step--disabled'}`;

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <div className="header__logo" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
              <path d="M8 12h8M8 8h5M8 16h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="header__title">MedTech Data Platform</h1>
            <p className="header__subtitle">Upload, enrich, visualize, and export your data</p>
          </div>
        </div>

        <nav className="header__nav" aria-label="Workflow steps">
          <span className={stepClass('upload', !!dataset)}>Upload</span>
          <span className={stepClass('enrich', !!enriched)}>Enrich</span>
          <span className={stepClass('visualize', !!enriched)}>Visualize</span>
          <span className={stepClass('export', !!enriched)}>Export</span>
        </nav>
      </header>

      <main className="main">
        {!dataset ? (
          <div className="upload-panel">
            <div className="upload-panel__intro">
              <h2>Import your dataset</h2>
              <p>
                Start by uploading a CSV file. Once loaded, you&apos;ll be able to enrich
                columns, build visualizations, and export results.
              </p>
            </div>
            <CsvUploadZone
              onFileSelect={uploadFile}
              isLoading={isLoading}
              isDragging={isDragging}
              onDragStateChange={setDragging}
              error={error}
            />
          </div>
        ) : (
          <div className="workspace">
            <EnrichPanel dataset={dataset} onEnriched={setEnriched} />
            <ResultsView dataset={dataset} enriched={enriched} onClear={handleClear} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

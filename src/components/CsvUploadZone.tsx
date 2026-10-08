import { useRef, type ChangeEvent, type DragEvent } from 'react';
import type { UploadMethod } from '../types/csv';

interface CsvUploadZoneProps {
  onFileSelect: (file: File, uploadMethod: UploadMethod) => void;
  isLoading: boolean;
  isDragging: boolean;
  onDragStateChange: (dragging: boolean) => void;
  error: string | null;
}

export function CsvUploadZone({
  onFileSelect,
  isLoading,
  isDragging,
  onDragStateChange,
  error,
}: CsvUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragStateChange(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragStateChange(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragStateChange(false);

    const file = event.dataTransfer.files[0];
    if (file) onFileSelect(file, 'drag_and_drop');
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file, 'file_picker');
    event.target.value = '';
  };

  return (
    <div className="upload-section">
      <div
        className={`upload-zone ${isDragging ? 'upload-zone--dragging' : ''} ${error ? 'upload-zone--error' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload CSV file"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleInputChange}
          hidden
          disabled={isLoading}
        />

        <div className="upload-zone__icon" aria-hidden="true">
          {isLoading ? (
            <span className="spinner" />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="upload-zone__text">
          <p className="upload-zone__title">
            {isLoading ? 'Processing your file…' : 'Drop your CSV here'}
          </p>
          <p className="upload-zone__subtitle">
            {isLoading ? 'Parsing rows and columns' : 'or click to browse — max 10 MB'}
          </p>
        </div>
      </div>

      {error && (
        <div className="upload-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

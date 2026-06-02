import type { CsvDataset } from '../types/csv';
import {
  formatFileSize,
  getPreviewRows,
  PREVIEW_ROW_LIMIT,
} from '../utils/csvParser';

interface DataPreviewProps {
  dataset: CsvDataset;
  onClear?: () => void;
  highlightColumns?: string[];
}

export function DataPreview({ dataset, onClear, highlightColumns = [] }: DataPreviewProps) {
  const previewRows = getPreviewRows(dataset.rows);
  const hasMoreRows = dataset.rows.length > PREVIEW_ROW_LIMIT;
  const highlighted = new Set(highlightColumns);

  return (
    <section className="preview-section">
      <div className="preview-header">
        <div className="preview-header__info">
          <h2 className="preview-header__title">{dataset.fileName}</h2>
          <div className="preview-header__meta">
            <span className="badge">{formatFileSize(dataset.fileSize)}</span>
            <span className="badge">{dataset.headers.length} columns</span>
            <span className="badge">{dataset.rows.length.toLocaleString()} rows</span>
          </div>
        </div>
        {onClear && (
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            Upload new file
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th className="data-table__index">#</th>
              {dataset.headers.map((header) => (
                <th key={header} className={highlighted.has(header) ? 'data-table__new-col' : undefined}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index}>
                <td className="data-table__index">{index + 1}</td>
                {dataset.headers.map((header) => (
                  <td
                    key={header}
                    title={row[header] ?? ''}
                    className={highlighted.has(header) ? 'data-table__new-col' : undefined}
                  >
                    {row[header] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMoreRows && (
        <p className="preview-footer">
          Showing first {PREVIEW_ROW_LIMIT.toLocaleString()} of{' '}
          {dataset.rows.length.toLocaleString()} rows
        </p>
      )}
    </section>
  );
}

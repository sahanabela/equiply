import Papa from 'papaparse';
import type { CsvDataset } from '../types/csv';
import { trackEvent } from '../services/pendo';

export function datasetToCsv(dataset: CsvDataset): string {
  return Papa.unparse(
    { fields: dataset.headers, data: dataset.rows.map((r) => dataset.headers.map((h) => r[h] ?? '')) },
    { newline: '\n' },
  );
}

export function datasetToJson(dataset: CsvDataset): string {
  return JSON.stringify(dataset.rows, null, 2);
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'data';
}

/** Starts a browser download of `content` and returns its size in bytes. */
export function download(content: string, fileName: string, mime: string): number {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return blob.size;
}

// Last step of the Upload → Enrich → Visualize → Export workflow.
function trackExport(dataset: CsvDataset, exportFormat: 'csv' | 'json', fileSizeBytes: number): void {
  trackEvent('enriched_data_exported', {
    exportFormat,
    rowCount: dataset.rows.length,
    columnCount: dataset.headers.length,
    fileSizeBytes,
    msSinceUpload: Date.now() - dataset.uploadedAt.getTime(),
  });
}

export function exportCsv(dataset: CsvDataset): void {
  const fileSizeBytes = download(
    datasetToCsv(dataset),
    `${baseName(dataset.fileName)}.enriched.csv`,
    'text/csv;charset=utf-8',
  );
  trackExport(dataset, 'csv', fileSizeBytes);
}

export function exportJson(dataset: CsvDataset): void {
  const fileSizeBytes = download(
    datasetToJson(dataset),
    `${baseName(dataset.fileName)}.enriched.json`,
    'application/json',
  );
  trackExport(dataset, 'json', fileSizeBytes);
}

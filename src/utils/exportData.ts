import Papa from 'papaparse';
import type { CsvDataset } from '../types/csv';

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

export function download(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(dataset: CsvDataset): void {
  download(datasetToCsv(dataset), `${baseName(dataset.fileName)}.enriched.csv`, 'text/csv;charset=utf-8');
}

export function exportJson(dataset: CsvDataset): void {
  download(datasetToJson(dataset), `${baseName(dataset.fileName)}.enriched.json`, 'application/json');
}

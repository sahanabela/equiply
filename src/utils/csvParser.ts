import Papa from 'papaparse';
import type { CsvDataset, CsvRow, UploadError } from '../types/csv';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PREVIEW_ROW_LIMIT = 100;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateCsvFile(file: File): UploadError | null {
  const isCsv =
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.toLowerCase().endsWith('.csv');

  if (!isCsv) {
    return { message: 'Please upload a valid CSV file (.csv).' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { message: 'File exceeds the 10 MB size limit.' };
  }

  if (file.size === 0) {
    return { message: 'The selected file is empty.' };
  }

  return null;
}

export function parseCsvFile(file: File): Promise<CsvDataset> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields ?? [];

        if (headers.length === 0) {
          reject(new Error('No column headers found in the CSV file.'));
          return;
        }

        const rows = results.data.filter((row) =>
          Object.values(row).some((value) => value?.trim() !== ''),
        );

        if (rows.length === 0) {
          reject(new Error('The CSV file contains headers but no data rows.'));
          return;
        }

        resolve({
          fileName: file.name,
          fileSize: file.size,
          headers,
          rows,
          uploadedAt: new Date(),
        });
      },
      error: (error) => {
        reject(new Error(error.message || 'Failed to parse CSV file.'));
      },
    });
  });
}

export function getPreviewRows(rows: CsvRow[], limit = PREVIEW_ROW_LIMIT): CsvRow[] {
  return rows.slice(0, limit);
}

export { PREVIEW_ROW_LIMIT };

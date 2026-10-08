import { useCallback, useState } from 'react';
import type { CsvDataset, UploadError, UploadMethod } from '../types/csv';
import { CsvParseError, parseCsvFile, validateCsvFile } from '../utils/csvParser';
import { detectColumns } from '../utils/enrich';
import { trackEvent } from '../services/pendo';

interface UseCsvUploadResult {
  dataset: CsvDataset | null;
  isLoading: boolean;
  error: string | null;
  isDragging: boolean;
  uploadFile: (file: File, uploadMethod: UploadMethod) => Promise<void>;
  clearDataset: () => void;
  setDragging: (dragging: boolean) => void;
}

// The raw file name is never sent to analytics (it can carry facility or customer
// identifiers), and only well-known extensions are reported for the same reason.
const KNOWN_EXTENSIONS = [
  'csv', 'tsv', 'txt', 'xls', 'xlsx', 'ods', 'numbers', 'json', 'xml', 'pdf', 'zip',
];

function fileExtension(fileName: string): string {
  const ext = /\.([^.]+)$/.exec(fileName)?.[1].toLowerCase();
  if (!ext) return 'none';
  return KNOWN_EXTENSIONS.includes(ext) ? ext : 'other';
}

function trackUploadFailed(
  file: File,
  uploadMethod: UploadMethod,
  failureStage: 'validation' | 'parse',
  { reason, message }: UploadError,
): void {
  trackEvent('csv_upload_failed', {
    failureStage,
    errorReason: reason,
    errorMessage: message.slice(0, 100),
    fileSize: file.size,
    fileType: file.type || 'unknown',
    fileExtension: fileExtension(file.name),
    uploadMethod,
  });
}

export function useCsvUpload(): UseCsvUploadResult {
  const [dataset, setDataset] = useState<CsvDataset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useCallback(async (file: File, uploadMethod: UploadMethod) => {
    setError(null);

    const validationError = validateCsvFile(file);
    if (validationError) {
      setError(validationError.message);
      trackUploadFailed(file, uploadMethod, 'validation', validationError);
      return;
    }

    setIsLoading(true);

    try {
      const parseStartedAt = performance.now();
      const parsed = await parseCsvFile(file);
      const parseDurationMs = Math.round(performance.now() - parseStartedAt);
      setDataset(parsed);

      // isEnrichable=false means the Enrich step will dead-end: without a manufacturer
      // and a serial-number column the Enrich button stays disabled.
      const cols = detectColumns(parsed.headers);
      trackEvent('csv_file_uploaded', {
        uploadMethod,
        fileSize: parsed.fileSize,
        fileType: file.type || 'unknown',
        rowCount: parsed.rows.length,
        columnCount: parsed.headers.length,
        parseDurationMs,
        manufacturerColumnDetected: !!cols.manufacturer,
        serialColumnDetected: !!cols.serial,
        modelColumnDetected: !!cols.model,
        udiColumnDetected: !!cols.udi,
        assetDateColumnDetected: !!cols.assetDate,
        isEnrichable: !!cols.manufacturer && !!cols.serial,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setDataset(null);
      setError(message);
      const reason = err instanceof CsvParseError ? err.reason : 'parse_error';
      trackUploadFailed(file, uploadMethod, 'parse', { reason, message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDataset = useCallback(() => {
    setDataset(null);
    setError(null);
  }, []);

  const setDragging = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
  }, []);

  return {
    dataset,
    isLoading,
    error,
    isDragging,
    uploadFile,
    clearDataset,
    setDragging,
  };
}

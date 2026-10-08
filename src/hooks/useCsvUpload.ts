import { useCallback, useState } from 'react';
import type { CsvDataset } from '../types/csv';
import { parseCsvFile, validateCsvFile } from '../utils/csvParser';

interface UseCsvUploadResult {
  dataset: CsvDataset | null;
  isLoading: boolean;
  error: string | null;
  isDragging: boolean;
  uploadFile: (file: File) => Promise<void>;
  clearDataset: () => void;
  setDragging: (dragging: boolean) => void;
}

export function useCsvUpload(): UseCsvUploadResult {
  const [dataset, setDataset] = useState<CsvDataset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);

    const validationError = validateCsvFile(file);
    if (validationError) {
      setError(validationError.message);

      // Track CSV upload validation failure
      if (typeof pendo !== 'undefined') {
        pendo.track('csv_upload_failed', {
          fileName: file.name.substring(0, 100),
          fileSize: file.size,
          errorMessage: validationError.message.substring(0, 200),
          errorType: 'validation',
        });
      }

      return;
    }

    setIsLoading(true);

    try {
      const parsed = await parseCsvFile(file);
      setDataset(parsed);

      // Track successful CSV file upload
      if (typeof pendo !== 'undefined') {
        pendo.track('csv_file_uploaded', {
          fileName: parsed.fileName.substring(0, 100),
          fileSize: parsed.fileSize,
          rowCount: parsed.rows.length,
          columnCount: parsed.headers.length,
          columnHeaders: parsed.headers.join(', ').substring(0, 200),
        });
      }
    } catch (err) {
      setDataset(null);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);

      // Track CSV upload parse failure
      if (typeof pendo !== 'undefined') {
        pendo.track('csv_upload_failed', {
          fileName: file.name.substring(0, 100),
          fileSize: file.size,
          errorMessage: errorMessage.substring(0, 200),
          errorType: 'parse',
        });
      }
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

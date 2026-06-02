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
      return;
    }

    setIsLoading(true);

    try {
      const parsed = await parseCsvFile(file);
      setDataset(parsed);
    } catch (err) {
      setDataset(null);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
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

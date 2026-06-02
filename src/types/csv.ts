export interface CsvRow {
  [key: string]: string;
}

export interface CsvDataset {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: CsvRow[];
  uploadedAt: Date;
}

export interface UploadError {
  message: string;
}

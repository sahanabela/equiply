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

// How the file reached the upload zone.
export type UploadMethod = 'drag_and_drop' | 'file_picker';

// Stable code for why an upload was rejected; `message` is the user-facing text.
export type UploadErrorReason =
  | 'invalid_file_type'
  | 'file_too_large'
  | 'empty_file'
  | 'no_headers'
  | 'no_data_rows'
  | 'parse_error';

export interface UploadError {
  reason: UploadErrorReason;
  message: string;
}

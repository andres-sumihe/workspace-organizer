export type PreviewMode = 'text' | 'hex';

export type MergeMode = 'simple' | 'boundary';

export interface MergeFormValues {
  destination: string;
  separator: string;
  includeHeaders: boolean;
  overwrite: boolean;
  mode: MergeMode;
  copyToClipboard: boolean;
}

export interface SplitFormValues {
  separator: string;
  prefix: string;
  extension: string;
  overwrite: boolean;
  preserveOriginal: boolean;
  mode: 'simple' | 'boundary';
  sourceMode: 'file' | 'clipboard';
}

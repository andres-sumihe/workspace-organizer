export type PreviewMode = 'text' | 'hex';

export interface MergeFormValues {
  destination: string;
  separator: string;
  includeHeaders: boolean;
  overwrite: boolean;
}

export interface SplitFormValues {
  separator: string;
  prefix: string;
  extension: string;
  overwrite: boolean;
  preserveOriginal: boolean;
}

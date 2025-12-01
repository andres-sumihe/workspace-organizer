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

export interface ProjectFormValues {
  name: string;
  relativePath: string;
  description?: string;
}

export interface WorkspaceFormValues {
  name: string;
  rootPath: string;
  description?: string;
}

export interface FileFormValues {
  name: string;
  content?: string;
}

export interface FolderFormValues {
  name: string;
}

export interface FsDialogState {
  open: boolean;
  mode: 'folder' | 'file';
  projectPath: string;
}
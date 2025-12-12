export type PreviewMode = 'text' | 'hex' | 'media';

export interface PayloadPackFormValues {
  sourceFile?: File;
}

export interface PayloadUnpackFormValues {
  source: 'clipboard' | 'file';
  payloadFile?: File;
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
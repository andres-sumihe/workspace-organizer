import type { WorkspaceProject } from '@workspace/shared';

declare module '@workspace/shared' {
  // no-op; imported for type re-export convenience
}

export interface WorkspaceFormValues {
  name: string;
  rootPath: string;
  description?: string;
}

export interface ProjectFormValues {
  name: string;
  relativePath: string;
  description?: string;
}

export interface FolderFormValues {
  folderName: string;
}

export interface FileFormValues {
  fileName: string;
  content: string;
}

export type FsDialogMode = 'folder' | 'file';

export interface FsDialogState {
  mode: FsDialogMode;
  project: WorkspaceProject;
}

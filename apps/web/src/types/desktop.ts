export interface WorkspaceDirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size: number | null;
  modifiedAt: string;
}

export interface WorkspaceBreadcrumb {
  label: string;
  path: string;
}

export interface WorkspaceFilePreview {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}

export interface WorkspaceMediaPreview {
  path: string;
  base64: string;
  mimeType: string;
  size: number;
}

export interface WorkspaceFileUrl {
  path: string;
  url: string;
  size: number;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  folderCount?: number;
  fileCount?: number;
}

export interface TemplateManifest {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  folders: { path: string }[];
  files: { path: string; content?: string; binary?: boolean; encoding?: string }[];
  tokens?: TemplateTokenEntry[];
}

export interface TemplateManifestInput {
  id?: string;
  name: string;
  description?: string;
  folders: { path: string }[];
  files: { path: string; content?: string; binary?: boolean; encoding?: string }[];
  tokens?: TemplateTokenEntry[];
}

export interface TemplateTokenEntry {
  key: string;
  label?: string;
  default?: string;
}

export interface DesktopApi {
  listTemplates: () => Promise<{ ok: boolean; error?: string; templates?: TemplateSummary[] }>;
  importTemplateFromZip: (zipPath: string) => Promise<unknown>;
  dryRunApply: (templateId: unknown, rootPath: string, tokens?: Record<string, string>) => Promise<unknown>;
  applyTemplate: (
    templateId: unknown,
    rootPath: string,
    tokens?: Record<string, string>,
    policy?: unknown
  ) => Promise<unknown>;
  registerWorkspace: (rootPath: string) => Promise<unknown>;
  openPath: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  selectDirectory: () => Promise<{ canceled: boolean; path?: string; error?: string }>;
  listDirectory: (payload: { rootPath: string; relativePath?: string }) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    entries?: WorkspaceDirectoryEntry[];
    breadcrumbs?: WorkspaceBreadcrumb[];
  }>;
  readTextFile: (payload: { rootPath: string; relativePath: string; maxBytes?: number }) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    content?: string;
    truncated?: boolean;
    size?: number;
  }>;
  readBinaryFile: (payload: { rootPath: string; relativePath: string }) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    base64?: string;
    mimeType?: string;
    size?: number;
  }>;
  getFileUrl: (payload: { rootPath: string; relativePath: string }) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    url?: string;
    size?: number;
  }>;
  mergeTextFiles: (payload: {
    rootPath: string;
    sources: string[];
    destination: string;
    separator?: string;
    includeHeaders?: boolean;
    overwrite?: boolean;
    mode?: 'simple' | 'boundary';
    copyToClipboard?: boolean;
  }) => Promise<{ ok: boolean; error?: string; destination?: string; content?: string }>;
  splitTextFile: (payload: {
    rootPath: string;
    source?: string;
    clipboardContent?: string;
    separator: string;
    prefix?: string;
    extension?: string;
    overwrite?: boolean;
    preserveOriginal?: boolean;
    mode?: 'simple' | 'boundary';
    outputDir?: string;
  }) => Promise<{ ok: boolean; error?: string; created?: string[] }>;
  createDirectory: (payload: { rootPath: string; relativePath: string }) => Promise<{ ok: boolean; error?: string; path?: string }>;
  writeTextFile: (payload: {
    rootPath: string;
    relativePath: string;
    content: string;
    encoding?: string;
  }) => Promise<{ ok: boolean; error?: string; path?: string }>;
  renameEntry: (payload: {
    rootPath: string;
    oldRelativePath: string;
    newName: string;
  }) => Promise<{ ok: boolean; error?: string; oldPath?: string; newPath?: string }>;
  deleteEntries: (payload: {
    rootPath: string;
    relativePaths: string[];
  }) => Promise<{ ok: boolean; error?: string; deleted?: string[]; errors?: Array<{ path: string; error: string }> }>;
  copyEntries: (payload: {
    rootPath: string;
    relativePaths: string[];
    destinationDir: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    copied?: Array<{ source: string; destination: string }>;
    errors?: Array<{ path: string; error: string }>;
  }>;
  moveEntries: (payload: {
    rootPath: string;
    relativePaths: string[];
    destinationDir: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    moved?: Array<{ source: string; destination: string }>;
    errors?: Array<{ path: string; error: string }>;
  }>;
  getEntryInfo: (payload: {
    rootPath: string;
    relativePath: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    name?: string;
    type?: 'directory' | 'file';
    size?: number | null;
    modifiedAt?: string;
    createdAt?: string;
    childCount?: number;
  }>;
  revealInExplorer: (payload: {
    rootPath: string;
    relativePath?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  openInVSCode: (payload: {
    rootPath: string;
    relativePath?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  importExternalFiles: (payload: {
    rootPath: string;
    destinationDir: string;
    externalPaths: string[];
    move?: boolean;
  }) => Promise<{
    ok: boolean;
    error?: string;
    imported?: Array<{ source: string; destination: string }>;
    errors?: Array<{ path: string; error: string }>;
  }>;
  archiveEntries: (payload: {
    rootPath: string;
    relativePaths: string[];
    archiveName: string;
  }) => Promise<{ ok: boolean; error?: string; archivePath?: string }>;
  extractArchive: (payload: {
    rootPath: string;
    archiveRelPath: string;
    destinationDir?: string;
  }) => Promise<{ ok: boolean; error?: string; extractedTo?: string }>;
  readClipboardFilePaths: () => Promise<{ ok: boolean; error?: string; paths: string[] }>;
  hasClipboardFiles: () => Promise<{ ok: boolean; hasFiles: boolean }>;
  setClipboardFilePaths: (paths: string[]) => Promise<{ ok: boolean; error?: string }>;
  getDroppedFilePaths: () => string[];
  createTemplateFromFolder: (payload: {
    name?: string;
    description?: string;
    sourcePath: string;
  }) => Promise<{ ok: boolean; error?: string; template?: TemplateSummary }>;
  getTemplateManifest: (payload: { templateId: string }) => Promise<{ ok: boolean; error?: string; manifest?: TemplateManifest }>;
  saveTemplateManifest: (payload: TemplateManifestInput) => Promise<{ ok: boolean; error?: string; template?: TemplateManifest }>;
  deleteTemplate: (payload: { templateId: string }) => Promise<{ ok: boolean; error?: string }>;
  applyTemplateToProject: (payload: {
    templateId: string;
    workspaceRoot: string;
    projectRelativePath: string;
    tokens?: Record<string, string>;
  }) => Promise<{ ok: boolean; error?: string }>;
  listWorkspaceTemplates: (payload: { workspaceRoot: string }) => Promise<{
    ok: boolean;
    error?: string;
    templateIds?: string[];
    templates?: TemplateSummary[];
  }>;
  saveWorkspaceTemplates: (payload: { workspaceRoot: string; templateIds: string[] }) => Promise<{
    ok: boolean;
    error?: string;
    templateIds?: string[];
    templates?: TemplateSummary[];
  }>;
  onProgress: (cb: (data: unknown) => void) => () => void;
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateNotAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateError: (callback: (err: string) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
  downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
  restartAndInstall: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  getProcessVersions: () => Promise<unknown>;
  checkForUpdates: () => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  toggleDevTools: () => Promise<void>;
  onMenuCommand: (cb: (payload: { id: string }) => void) => () => void;
  invokeMainAction: (actionId: string, args?: unknown) => Promise<unknown>;
}

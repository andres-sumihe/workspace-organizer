// ============================================
// Electron IPC Bridge Type Definitions
// Matches the actual Electron preload.js interface
// ============================================

// Base entry types
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

// Template types
export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  folderCount?: number;
  fileCount?: number;
}

export interface TemplateTokenEntry {
  key: string;
  label?: string;
  default?: string;
}

export interface TemplateManifest {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  folders: Array<{ path: string }>;
  files: Array<{ path: string; content?: string; binary?: boolean; encoding?: string }>;
  tokens?: TemplateTokenEntry[];
}

export interface TemplateManifestInput {
  id?: string;
  name: string;
  description?: string;
  folders: Array<{ path: string }>;
  files: Array<{ path: string; content?: string; binary?: boolean; encoding?: string }>;
  tokens?: TemplateTokenEntry[];
}

// Progress & Update types
export interface ProgressData {
  operation: string;
  current: number;
  total: number;
  message?: string;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

// Complete TypedElectronAPI Interface
// This matches the actual preload.js implementation
export interface TypedElectronAPI {
  // Template operations
  listTemplates: () => Promise<{ ok: boolean; error?: string; templates?: TemplateSummary[] }>;
  importTemplateFromZip: (zipPath: string) => Promise<unknown>;
  dryRunApply: (templateId: unknown, rootPath: string, tokens?: Record<string, string>) => Promise<unknown>;
  applyTemplate: (
    templateId: unknown,
    rootPath: string,
    tokens?: Record<string, string>,
    policy?: unknown
  ) => Promise<unknown>;
  
  // Workspace operations
  registerWorkspace: (rootPath: string) => Promise<unknown>;
  openPath: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  
  // Dialog operations
  selectDirectory: () => Promise<{ canceled: boolean; path?: string; error?: string }>;
  
  // Directory operations
  listDirectory: (payload: { rootPath: string; relativePath?: string }) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    entries?: WorkspaceDirectoryEntry[];
    breadcrumbs?: WorkspaceBreadcrumb[];
  }>;
  
  // File read operations
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
  
  // File write operations
  writeTextFile: (payload: {
    rootPath: string;
    relativePath: string;
    content: string;
    encoding?: string;
  }) => Promise<{ ok: boolean; error?: string; path?: string }>;
  createDirectory: (payload: { rootPath: string; relativePath: string }) => Promise<{ ok: boolean; error?: string; path?: string }>;
  renameEntry: (payload: {
    rootPath: string;
    oldRelativePath: string;
    newName: string;
  }) => Promise<{ ok: boolean; error?: string; oldPath?: string; newPath?: string }>;
  deleteEntries: (payload: {
    rootPath: string;
    relativePaths: string[];
  }) => Promise<{ ok: boolean; error?: string; deleted?: string[]; errors?: Array<{ path: string; error: string }> }>;
  
  // File merge/split operations
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
  
  // Template management
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
  
  // Workspace template associations
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
  
  // Progress and updates
  onProgress: (cb: (data: ProgressData) => void) => () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
  restartAndInstall: () => Promise<void>;
  
  // Menu integration
  onMenuCommand: (cb: (payload: { id: string }) => void) => () => void;
  invokeMainAction: (actionId: string, args?: unknown) => Promise<unknown>;
}

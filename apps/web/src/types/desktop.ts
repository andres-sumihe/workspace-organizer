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
  mergeTextFiles: (payload: {
    rootPath: string;
    sources: string[];
    destination: string;
    separator?: string;
    includeHeaders?: boolean;
    overwrite?: boolean;
  }) => Promise<{ ok: boolean; error?: string; destination?: string }>;
  splitTextFile: (payload: {
    rootPath: string;
    source: string;
    separator: string;
    prefix?: string;
    extension?: string;
    overwrite?: boolean;
    preserveOriginal?: boolean;
  }) => Promise<{ ok: boolean; error?: string; created?: string[] }>;
  createDirectory: (payload: { rootPath: string; relativePath: string }) => Promise<{ ok: boolean; error?: string; path?: string }>;
  writeTextFile: (payload: {
    rootPath: string;
    relativePath: string;
    content: string;
    encoding?: string;
  }) => Promise<{ ok: boolean; error?: string; path?: string }>;
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
}

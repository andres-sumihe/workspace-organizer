export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export interface TemplateFolder {
  name: string;
  folders?: TemplateFolder[];
  files?: TemplateFile[];
}

export interface TemplateFile {
  name: string;
  contents?: string;
  tokenized?: boolean;
}

export interface ProjectTemplate {
  id: string;
  label: string;
  description?: string;
  rootFolderName: string;
  structure: TemplateFolder[];
  tokens?: TemplateToken[];
}

export interface TemplateToken {
  key: string;
  label: string;
  description?: string;
  defaultValue?: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  application: string;
  team: string;
  templateId: string;
  createdAt: string;
  location: string;
  notes?: string;
}

export interface ApplyTemplateRequest {
  templateId: string;
  projectName: string;
  application: string;
  team: string;
  tokens?: Record<string, string>;
}

export interface FilePreviewResponse {
  path: string;
  mimeType: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  enforceNamingRules: boolean;
  namingRules: NamingRule[];
}

export interface NamingRule {
  id: string;
  label: string;
  appliesTo: 'folder' | 'file';
  pattern: string;
  description?: string;
  sample?: string;
}

export type WorkspaceStatus = 'healthy' | 'degraded' | 'offline';

export interface WorkspaceSummary {
  id: string;
  name: string;
  application: string;
  team: string;
  status: WorkspaceStatus;
  projectCount: number;
  templateCount: number;
  lastIndexedAt: string;
}

export interface WorkspaceStatistics {
  totalFolders: number;
  totalFiles: number;
  storageBytes: number;
  lastScanAt: string;
}

export type WorkspaceActivityType =
  | 'templateApplied'
  | 'fileCreated'
  | 'fileRenamed'
  | 'fileDeleted'
  | 'ruleViolation'
  | 'custom';

export interface WorkspaceActivityItem {
  id: string;
  type: WorkspaceActivityType;
  occurredAt: string;
  actor: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface TemplateReference {
  id: string;
  label: string;
  lastAppliedAt?: string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  rootPath: string;
  description?: string;
  settings: WorkspaceSettings;
  statistics: WorkspaceStatistics;
  recentActivity: WorkspaceActivityItem[];
  templates: TemplateReference[];
}

export type WorkspaceListResponse = PaginatedData<WorkspaceSummary>;

export interface WorkspaceDetailResponse {
  workspace: WorkspaceDetail;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobSummary {
  id: string;
  type: string;
  status: JobStatus;
  workspaceId?: string;
  submittedAt: string;
  completedAt?: string;
  progressPercent?: number;
  message?: string;
}

export interface JobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface JobDetail extends JobSummary {
  logs: JobLogEntry[];
  metadata?: Record<string, unknown>;
}

export interface TemplateRun {
  id: string;
  jobId: string;
  templateId: string;
  workspaceId: string;
  initiatedBy: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  tokenValues?: Record<string, string>;
  outputPath?: string;
}

export type TemplateTokenMap = Record<string, string>;

// Template manifest types for ZIP + manifest format
export interface TemplateFileEntry {
  path: string; // relative path inside template
  content?: string; // textual content (tokenized)
  binary?: boolean; // whether this is binary data
  executable?: boolean; // hint (use with caution on Windows)
}

export interface TemplateFolderEntry {
  path: string; // relative path
}

export interface TemplateManifest {
  id: string;
  name: string;
  description?: string;
  version?: string;
  createdAt?: string;
  folders?: TemplateFolderEntry[];
  files?: TemplateFileEntry[];
  tokens?: { key: string; label?: string; default?: string }[];
}


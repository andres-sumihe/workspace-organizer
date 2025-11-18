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
  templateId: string;
  createdAt: string;
  location: string;
  notes?: string;
}

export interface WorkspaceProject {
  id: string;
  workspaceId: string;
  name: string;
  relativePath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyTemplateRequest {
  templateId: string;
  projectName: string;
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
  status: WorkspaceStatus;
  projectCount: number;
  templateCount: number;
  lastIndexedAt: string;
  rootPath: string;
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

export interface WorkspaceProjectListResponse {
  projects: WorkspaceProject[];
}

export interface WorkspaceProjectResponse {
  project: WorkspaceProject;
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

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  folderCount?: number;
  fileCount?: number;
}

// Batch Script Tracking Types
export type ScriptType = 'batch' | 'powershell' | 'shell' | 'other';

export interface BatchScript {
  id: string;
  name: string;
  description?: string;
  filePath: string;
  content: string;
  type: ScriptType;
  isActive: boolean;
  hasCredentials: boolean;
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveMapping {
  id: string;
  scriptId: string;
  driveLetter: string;
  networkPath: string;
  serverName?: string;
  shareName?: string;
  hasCredentials: boolean;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptTag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptDependency {
  dependentScriptId: string;
  dependencyScriptId: string;
  createdAt: string;
}

export interface ScriptCreateRequest {
  name: string;
  description?: string;
  filePath: string;
  content: string;
  type?: ScriptType;
  isActive?: boolean;
  tagIds?: string[];
}

export interface ScriptUpdateRequest {
  name?: string;
  description?: string;
  content?: string;
  type?: ScriptType;
  isActive?: boolean;
  tagIds?: string[];
}

export interface ScriptScanRequest {
  directoryPath: string;
  recursive?: boolean;
  filePattern?: string;
}

export interface DriveConflict {
  driveLetter: string;
  scripts: Array<{
    scriptId: string;
    scriptName: string;
    networkPath: string;
  }>;
}

export interface DriveAnalysis {
  totalScripts: number;
  totalMappings: number;
  usedDrives: string[];
  availableDrives: string[];
  conflicts: DriveConflict[];
}

export interface ScriptStats {
  totalScripts: number;
  activeScripts: number;
  scriptsWithCredentials: number;
  totalExecutions: number;
  scriptsByType: Record<ScriptType, number>;
  recentlyUpdated: BatchScript[];
}

export interface BatchScriptDetail extends BatchScript {
  driveMappings: DriveMapping[];
  tags: ScriptTag[];
  dependencies: BatchScript[];
  dependents: BatchScript[];
}

export type ScriptListResponse = PaginatedData<BatchScript>;

export interface ScriptDetailResponse {
  script: BatchScriptDetail;
}

export interface ScriptStatsResponse {
  stats: ScriptStats;
}

export interface DriveAnalysisResponse {
  analysis: DriveAnalysis;
}

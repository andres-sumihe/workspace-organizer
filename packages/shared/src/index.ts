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

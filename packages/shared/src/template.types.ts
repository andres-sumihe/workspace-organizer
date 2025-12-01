export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  folderCount: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFolder {
  relativePath: string;
}

export interface TemplateFile {
  relativePath: string;
  content: string;
}

export interface TemplateToken {
  key: string;
  label: string;
  defaultValue?: string;
}

export interface TemplateManifest {
  id: string;
  name: string;
  description: string | null;
  folders: TemplateFolder[];
  files: TemplateFile[];
  tokens: TemplateToken[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  folders: TemplateFolder[];
  files: TemplateFile[];
  tokens: TemplateToken[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  folders?: TemplateFolder[];
  files?: TemplateFile[];
  tokens?: TemplateToken[];
}

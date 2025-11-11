export interface CaptureFormValues {
  name: string;
  description?: string;
  sourcePath: string;
}

export interface BuilderMeta {
  name: string;
  description?: string;
}

export interface EditableFolder {
  id: string;
  path: string;
}

export interface EditableFile {
  id: string;
  path: string;
  content: string;
}

export interface EditableToken {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
}

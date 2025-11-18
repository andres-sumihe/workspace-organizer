import type { BatchScript, BatchScriptDetail, DriveMapping } from '@workspace/shared';

export type { BatchScript, BatchScriptDetail, DriveMapping };

export interface ScriptFilters {
  type?: 'batch' | 'powershell' | 'shell' | 'other';
  isActive?: boolean;
  driveLetter?: string;
  tagId?: string;
  searchQuery?: string;
}

import { driveAnalyzerService } from './drive-analyzer.service.js';
import { scriptParserService } from './script-parser.service.js';
import { auditService } from './audit.service.js';
import { AppError } from '../errors/app-error.js';
import { scriptsRepository } from '../repositories/scripts.repository.pg.js';
import { apiLogger } from '../utils/logger.js';

import type {
  ScriptListResponse,
  BatchScriptDetail,
  ScriptCreateRequest,
  ScriptUpdateRequest,
  DriveAnalysis,
  DriveMapping,
  ScriptStats,
  BatchScript,
  ScriptType,
  PaginatedData,
  AuditLogEntry
} from '@workspace/shared';

/** User context for audit logging */
export interface UserContext {
  memberEmail?: string;
  memberDisplayName?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ScriptListOptions {
  page: number;
  pageSize: number;
  type?: ScriptType;
  isActive?: boolean;
  driveLetter?: string;
  tagId?: string;
  searchQuery?: string;
}

export const getScriptList = async (options: ScriptListOptions): Promise<ScriptListResponse> => {
  const { page, pageSize, type, isActive, driveLetter, tagId, searchQuery } = options;

  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    scriptsRepository.list({ limit, offset, type, isActive, driveLetter, tagId, searchQuery }),
    scriptsRepository.count({ type, isActive, driveLetter, tagId, searchQuery })
  ]);

  const hasNextPage = page * pageSize < total;
  const hasPreviousPage = page > 1;

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      hasNextPage,
      hasPreviousPage
    }
  };
};

export const getScriptDetailById = async (scriptId: string): Promise<BatchScriptDetail> => {
  const detail = await scriptsRepository.getDetail(scriptId);
  if (!detail) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  return detail;
};

export const createScript = async (request: ScriptCreateRequest, userContext?: UserContext): Promise<BatchScriptDetail> => {
  const { name, description, filePath, content, type = 'batch', isActive = true, tagIds } = request;

  // Parse the script content
  const parsed = scriptParserService.parseScriptContent(content);

  // Create the script in the database
  const script = await scriptsRepository.create({
    name,
    description,
    filePath,
    content,
    type,
    isActive,
    tagIds
  }, userContext?.memberEmail);

  // Add drive mappings
  for (const mapping of parsed.driveMappings) {
    await scriptsRepository.addDriveMapping(script.id, {
      driveLetter: driveAnalyzerService.normalizeDriveLetter(mapping.driveLetter),
      networkPath: mapping.networkPath,
      serverName: mapping.serverName,
      shareName: mapping.shareName,
      hasCredentials: mapping.hasCredentials,
      username: mapping.username
    });
  }

  // Return the full detail
  const detail = await scriptsRepository.getDetail(script.id);
  if (!detail) {
    throw new AppError('Failed to create script.', 500, 'SCRIPT_CREATE_FAILED');
  }

  // Log the create action
  await auditService.logCreate(
    userContext?.memberEmail,
    'script',
    detail.id,
    { name: detail.name, filePath: detail.filePath, type: detail.type, isActive: detail.isActive },
    { 
      ipAddress: userContext?.ipAddress, 
      userAgent: userContext?.userAgent,
      memberDisplayName: userContext?.memberDisplayName
    }
  );

  return detail;
};

export const updateScript = async (scriptId: string, request: ScriptUpdateRequest, userContext?: UserContext): Promise<BatchScriptDetail> => {
  const existing = await scriptsRepository.getById(scriptId);
  if (!existing) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  // Capture old values for audit
  const oldValues = {
    name: existing.name,
    description: existing.description,
    type: existing.type,
    isActive: existing.isActive
  };

  const { name, description, content, type, isActive, tagIds } = request;

  // Re-parse content if it's being updated
  if (content !== undefined) {
    const parsed = scriptParserService.parseScriptContent(content);

    // Clear and re-create drive mappings
    await scriptsRepository.clearDriveMappings(scriptId);
    for (const mapping of parsed.driveMappings) {
      await scriptsRepository.addDriveMapping(scriptId, {
        driveLetter: driveAnalyzerService.normalizeDriveLetter(mapping.driveLetter),
        networkPath: mapping.networkPath,
        serverName: mapping.serverName,
        shareName: mapping.shareName,
        hasCredentials: mapping.hasCredentials,
        username: mapping.username
      });
    }
  }

  // Update script metadata
  await scriptsRepository.update(scriptId, {
    name,
    description,
    content,
    type,
    isActive,
    tagIds
  }, userContext?.memberEmail);

  // Return the full detail
  const detail = await scriptsRepository.getDetail(scriptId);
  if (!detail) {
    throw new AppError('Failed to update script.', 500, 'SCRIPT_UPDATE_FAILED');
  }

  // Build new values for audit (only changed fields)
  const newValues: Record<string, unknown> = {};
  if (name !== undefined && name !== oldValues.name) newValues.name = name;
  if (description !== undefined && description !== oldValues.description) newValues.description = description;
  if (type !== undefined && type !== oldValues.type) newValues.type = type;
  if (isActive !== undefined && isActive !== oldValues.isActive) newValues.isActive = isActive;
  if (content !== undefined && content !== existing.content) newValues.contentUpdated = true;
  if (tagIds !== undefined) newValues.tagsUpdated = true;

  // Log the update action
  await auditService.logUpdate(
    userContext?.memberEmail,
    'script',
    scriptId,
    oldValues,
    newValues,
    { 
      ipAddress: userContext?.ipAddress, 
      userAgent: userContext?.userAgent,
      memberDisplayName: userContext?.memberDisplayName
    }
  );

  return detail;
};

export const deleteScript = async (scriptId: string, userContext?: UserContext): Promise<void> => {
  const existing = await scriptsRepository.getById(scriptId);
  if (!existing) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  // Capture old values for audit before deletion
  const oldValues = {
    name: existing.name,
    filePath: existing.filePath,
    type: existing.type,
    isActive: existing.isActive
  };

  await scriptsRepository.delete(scriptId);

  // Log the delete action
  await auditService.logDelete(
    userContext?.memberEmail,
    'script',
    scriptId,
    oldValues,
    { 
      ipAddress: userContext?.ipAddress, 
      userAgent: userContext?.userAgent,
      memberDisplayName: userContext?.memberDisplayName
    }
  );
};

export const getStats = async (): Promise<ScriptStats> => {
  const allScripts = await scriptsRepository.list({ limit: 10000, offset: 0 });

  const totalScripts = allScripts.length;
  const activeScripts = allScripts.filter((s) => s.isActive).length;
  const scriptsWithCredentials = allScripts.filter((s) => s.hasCredentials).length;
  const totalExecutions = allScripts.reduce((sum, s) => sum + s.executionCount, 0);

  const scriptsByType: Record<string, number> = {
    batch: 0,
    powershell: 0,
    shell: 0,
    other: 0
  };

  for (const script of allScripts) {
    scriptsByType[script.type] = (scriptsByType[script.type] || 0) + 1;
  }

  // Get 5 most recently updated scripts
  const recentlyUpdated = allScripts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return {
    totalScripts,
    activeScripts,
    scriptsWithCredentials,
    totalExecutions,
    scriptsByType: scriptsByType as Record<'batch' | 'powershell' | 'shell' | 'other', number>,
    recentlyUpdated
  };
};

export const getDriveAnalysis = async (): Promise<DriveAnalysis> => {
  // Get all scripts to build script name map
  const allScripts = await scriptsRepository.list({ limit: 10000, offset: 0 });
  const scriptNames = new Map<string, string>(allScripts.map((s) => [s.id, s.name]));

  // Collect all drive mappings
  const allMappings: DriveMapping[] = [];
  for (const script of allScripts) {
    const mappings = await scriptsRepository.getDriveMappings(script.id);
    allMappings.push(...mappings);
  }

  return driveAnalyzerService.analyzeDriveUsage(allMappings, scriptNames);
};

export const getConflicts = async () => {
  const analysis = await getDriveAnalysis();
  return analysis.conflicts;
};

export const createOrFindTag = async (name: string, color?: string) => {
  // Try to find existing tag
  const allTags = await scriptsRepository.getAllTags();
  const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  // Create new tag
  return scriptsRepository.createTag(name, color);
};

export const getAllTags = async () => {
  return scriptsRepository.getAllTags();
};

export const scanDirectory = async (
  directoryPath: string,
  recursive = false,
  filePattern = '*.bat',
  replaceExisting = false,
  userContext?: UserContext
): Promise<BatchScript[]> => {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { minimatch } = await import('minimatch');

  const discoveredScripts: BatchScript[] = [];
  const patterns = filePattern.split(',').map(p => p.trim());

  const scanDir = async (currentPath: string): Promise<void> => {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() && recursive) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const matchesPattern = patterns.some(pattern => minimatch(entry.name, pattern, { nocase: true }));
          
          if (matchesPattern) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              
              // Detect script type from extension
              let scriptType: ScriptType = 'other';
              const ext = path.extname(entry.name).toLowerCase();
              if (ext === '.bat' || ext === '.cmd') {
                scriptType = 'batch';
              } else if (ext === '.ps1') {
                scriptType = 'powershell';
              } else if (ext === '.sh') {
                scriptType = 'shell';
              }

              // Parse the script to extract drive mappings
              const parsedData = scriptParserService.parseScriptContent(content);

              // Create tag for credentials if needed
              let tagIds: string[] | undefined;
              if (parsedData.hasCredentials) {
                const credTag = await createOrFindTag('credentials', '#f97316');
                tagIds = [credTag.id];
              }

              // Check if script with same file path exists
              let existingScript: BatchScript | null = null;
              if (replaceExisting) {
                const allScripts = await scriptsRepository.list({ limit: 10000, offset: 0 });
                existingScript = allScripts.find((s) => s.filePath === fullPath) || null;
              }

              let resultScript: BatchScriptDetail;
              if (existingScript && replaceExisting) {
                // Update existing script
                resultScript = await updateScript(existingScript.id, {
                  name: entry.name.replace(path.extname(entry.name), ''),
                  type: scriptType,
                  description: `Updated from directory scan on ${new Date().toISOString()}`,
                  isActive: true,
                  content,
                  tagIds
                }, userContext);
              } else {
                // Create new script
                resultScript = await createScript({
                  name: entry.name.replace(path.extname(entry.name), ''),
                  filePath: fullPath,
                  type: scriptType,
                  description: `Imported from directory scan on ${new Date().toISOString()}`,
                  isActive: true,
                  content,
                  tagIds
                }, userContext);
              }

              discoveredScripts.push(resultScript);
            } catch (err) {
              apiLogger.error({ err, fullPath }, 'Failed to process script');
              // Continue scanning other files
            }
          }
        }
      }
    } catch (err) {
      apiLogger.error({ err, currentPath }, 'Failed to scan directory');
      throw new AppError(`Failed to scan directory: ${err instanceof Error ? err.message : 'Unknown error'}`, 500, 'SCAN_ERROR');
    }
  };

  await scanDir(directoryPath);
  return discoveredScripts;
};

/**
 * Get activity history for a specific script
 */
export const getScriptActivity = async (
  scriptId: string,
  page = 1,
  pageSize = 50
): Promise<PaginatedData<AuditLogEntry>> => {
  // Verify script exists
  const existing = await scriptsRepository.getById(scriptId);
  if (!existing) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  return auditService.getByResource('script', scriptId, page, pageSize);
};

import { randomUUID } from 'node:crypto';

import { driveAnalyzerService } from './drive-analyzer.service.js';
import { scriptParserService } from './script-parser.service.js';
import { AppError } from '../errors/app-error.js';
import {
  countScripts,
  listScripts,
  findScriptById,
  createScript as createScriptRepo,
  updateScript as updateScriptRepo,
  deleteScript as deleteScriptRepo,
  createDriveMapping,
  deleteDriveMappingsByScriptId,
  findOrCreateTag,
  attachTagToScript,
  detachTagsFromScript,
  listAllDriveMappings,
  listAllTags
} from '../repositories/scripts.repository.js';

import type { ListScriptsParams } from '../repositories/scripts.repository.js';
import type {
  ScriptListResponse,
  BatchScriptDetail,
  ScriptCreateRequest,
  ScriptUpdateRequest,
  DriveAnalysis,
  ScriptStats,
  BatchScript
} from '@workspace/shared';

interface ScriptListOptions {
  page: number;
  pageSize: number;
  type?: 'batch' | 'powershell' | 'shell' | 'other';
  isActive?: boolean;
  driveLetter?: string;
  tagId?: string;
  searchQuery?: string;
}

export const getScriptList = async (options: ScriptListOptions): Promise<ScriptListResponse> => {
  const { page, pageSize, type, isActive, driveLetter, tagId, searchQuery } = options;

  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const params: ListScriptsParams = {
    limit,
    offset,
    type,
    isActive,
    driveLetter,
    tagId,
    searchQuery
  };

  const [items, total] = await Promise.all([listScripts(params), countScripts(params)]);

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
  const script = await findScriptById(scriptId);
  if (!script) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  return script;
};

export const createScript = async (request: ScriptCreateRequest): Promise<BatchScriptDetail> => {
  const { name, description, filePath, content, type = 'batch', isActive = true, tagIds } = request;

  // Parse the script content
  const parsed = scriptParserService.parseScriptContent(content);

  const now = new Date().toISOString();
  const scriptId = randomUUID();

  // Create the script record
  await createScriptRepo({
    id: scriptId,
    name,
    description,
    filePath,
    content,
    type,
    isActive,
    hasCredentials: parsed.hasCredentials,
    createdAt: now,
    updatedAt: now
  });

  // Create drive mappings
  for (const mapping of parsed.driveMappings) {
    await createDriveMapping({
      id: randomUUID(),
      scriptId,
      driveLetter: driveAnalyzerService.normalizeDriveLetter(mapping.driveLetter),
      networkPath: mapping.networkPath,
      serverName: mapping.serverName,
      shareName: mapping.shareName,
      hasCredentials: mapping.hasCredentials,
      username: mapping.username,
      createdAt: now,
      updatedAt: now
    });
  }

  // Attach tags
  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      await attachTagToScript(scriptId, tagId);
    }
  }

  const created = await findScriptById(scriptId);
  if (!created) {
    throw new AppError('Failed to create script.', 500, 'SCRIPT_CREATE_FAILED');
  }

  return created;
};

export const updateScript = async (scriptId: string, request: ScriptUpdateRequest): Promise<BatchScriptDetail> => {
  const existing = await findScriptById(scriptId);
  if (!existing) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  const { name, description, content, type, isActive, tagIds } = request;

  // Re-parse content if it's being updated
  let hasCredentials = existing.hasCredentials;
  if (content !== undefined) {
    const parsed = scriptParserService.parseScriptContent(content);
    hasCredentials = parsed.hasCredentials;

    // Re-create drive mappings
    await deleteDriveMappingsByScriptId(scriptId);
    const now = new Date().toISOString();

    for (const mapping of parsed.driveMappings) {
      await createDriveMapping({
        id: randomUUID(),
        scriptId,
        driveLetter: driveAnalyzerService.normalizeDriveLetter(mapping.driveLetter),
        networkPath: mapping.networkPath,
        serverName: mapping.serverName,
        shareName: mapping.shareName,
        hasCredentials: mapping.hasCredentials,
        username: mapping.username,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  // Update script metadata
  await updateScriptRepo(scriptId, {
    name,
    description,
    content,
    type,
    isActive,
    hasCredentials
  });

  // Update tags if provided
  if (tagIds !== undefined) {
    await detachTagsFromScript(scriptId);
    for (const tagId of tagIds) {
      await attachTagToScript(scriptId, tagId);
    }
  }

  const updated = await findScriptById(scriptId);
  if (!updated) {
    throw new AppError('Failed to update script.', 500, 'SCRIPT_UPDATE_FAILED');
  }

  return updated;
};

export const deleteScript = async (scriptId: string): Promise<void> => {
  const existing = await findScriptById(scriptId);
  if (!existing) {
    throw new AppError('Script not found.', 404, 'SCRIPT_NOT_FOUND');
  }

  await deleteScriptRepo(scriptId);
};

export const getStats = async (): Promise<ScriptStats> => {
  const allScripts = await listScripts({ limit: 10000, offset: 0 });

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
  const allMappings = await listAllDriveMappings();
  const allScripts = await listScripts({ limit: 10000, offset: 0 });

  const scriptNames = new Map<string, string>(allScripts.map((s) => [s.id, s.name]));

  return driveAnalyzerService.analyzeDriveUsage(allMappings, scriptNames);
};

export const getConflicts = async () => {
  const analysis = await getDriveAnalysis();
  return analysis.conflicts;
};

export const createOrFindTag = async (name: string, color?: string) => {
  return findOrCreateTag(name, randomUUID(), color);
};

export const getAllTags = async () => {
  return listAllTags();
};

export const scanDirectory = async (directoryPath: string, recursive = false, filePattern = '*.bat', replaceExisting = false): Promise<BatchScript[]> => {
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
              let scriptType: 'batch' | 'powershell' | 'shell' | 'other' = 'other';
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
                const credTag = await findOrCreateTag('credentials', randomUUID(), '#f97316');
                tagIds = [credTag.id];
              }

              // Check if script with same file path exists
              let existingScript: BatchScript | null = null;
              if (replaceExisting) {
                const allScripts = await listScripts({ limit: 10000, offset: 0 });
                existingScript = allScripts.find((s) => s.filePath === fullPath) || null;
              }

              let resultScript: BatchScript;
              if (existingScript && replaceExisting) {
                // Update existing script
                resultScript = await updateScript(existingScript.id, {
                  name: entry.name.replace(path.extname(entry.name), ''),
                  type: scriptType,
                  description: `Updated from directory scan on ${new Date().toISOString()}`,
                  isActive: true,
                  content,
                  tagIds
                });
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
                });
              }

              discoveredScripts.push(resultScript);
            } catch (err) {
              console.error(`Failed to process script ${fullPath}:`, err);
              // Continue scanning other files
            }
          }
        }
      }
    } catch (err) {
      console.error(`Failed to scan directory ${currentPath}:`, err);
      throw new AppError(`Failed to scan directory: ${err instanceof Error ? err.message : 'Unknown error'}`, 500, 'SCAN_ERROR');
    }
  };

  await scanDir(directoryPath);
  return discoveredScripts;
};

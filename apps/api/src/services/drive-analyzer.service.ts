/**
 * Drive Analyzer Service
 * Analyzes drive letter usage, detects conflicts, and identifies available drives
 */

import type { DriveMapping, DriveConflict, DriveAnalysis } from '@workspace/shared';

export class DriveAnalyzerService {
  /**
   * All possible drive letters (A-Z)
   */
  private readonly ALL_DRIVES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  /**
   * System-reserved drives typically unavailable for network mapping
   */
  private readonly SYSTEM_RESERVED = ['A', 'B', 'C', 'D', 'E', 'F'];

  /**
   * Network drives typically used for mapping (G-Z)
   */
  private readonly NETWORK_RANGE = this.ALL_DRIVES.filter((d) => !this.SYSTEM_RESERVED.includes(d));

  /**
   * Analyze drive usage across all drive mappings
   */
  analyzeDriveUsage(driveMappings: DriveMapping[], scriptNames: Map<string, string>): DriveAnalysis {
    const usedDrivesSet = new Set<string>();
    const driveToScriptsMap = new Map<string, Array<{ scriptId: string; scriptName: string; networkPath: string }>>();

    // Group mappings by drive letter
    for (const mapping of driveMappings) {
      const drive = mapping.driveLetter.toUpperCase();
      usedDrivesSet.add(drive);

      if (!driveToScriptsMap.has(drive)) {
        driveToScriptsMap.set(drive, []);
      }

      const scriptName = scriptNames.get(mapping.scriptId) || 'Unknown Script';

      driveToScriptsMap.get(drive)!.push({
        scriptId: mapping.scriptId,
        scriptName,
        networkPath: mapping.networkPath
      });
    }

    // Detect conflicts (drive letters used by multiple scripts)
    const conflicts: DriveConflict[] = [];

    for (const [driveLetter, scripts] of driveToScriptsMap) {
      if (scripts.length > 1) {
        conflicts.push({
          driveLetter,
          scripts
        });
      }
    }

    // Calculate available drives in the network range
    const usedDrives = Array.from(usedDrivesSet);
    const availableDrives = this.NETWORK_RANGE.filter((d) => !usedDrivesSet.has(d));

    return {
      totalScripts: scriptNames.size,
      totalMappings: driveMappings.length,
      usedDrives: usedDrives.sort(),
      availableDrives: availableDrives.sort(),
      conflicts
    };
  }

  /**
   * Detect conflicts for a specific drive letter
   */
  detectConflicts(driveLetter: string, driveMappings: DriveMapping[], scriptNames: Map<string, string>): DriveConflict | null {
    const drive = driveLetter.toUpperCase();
    const scriptsUsingDrive = driveMappings.filter((m) => m.driveLetter.toUpperCase() === drive);

    if (scriptsUsingDrive.length <= 1) {
      return null;
    }

    return {
      driveLetter: drive,
      scripts: scriptsUsingDrive.map((m) => ({
        scriptId: m.scriptId,
        scriptName: scriptNames.get(m.scriptId) || 'Unknown Script',
        networkPath: m.networkPath
      }))
    };
  }

  /**
   * Get available drive letters in the network range (G-Z)
   */
  getAvailableDrives(driveMappings: DriveMapping[]): string[] {
    const usedDrives = new Set(driveMappings.map((m) => m.driveLetter.toUpperCase()));
    return this.NETWORK_RANGE.filter((d) => !usedDrives.has(d));
  }

  /**
   * Check if a drive letter is in the typical network range
   */
  isNetworkDrive(driveLetter: string): boolean {
    return this.NETWORK_RANGE.includes(driveLetter.toUpperCase());
  }

  /**
   * Suggest an available drive letter
   */
  suggestAvailableDrive(driveMappings: DriveMapping[]): string | null {
    const available = this.getAvailableDrives(driveMappings);
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Validate drive letter format
   */
  isValidDriveLetter(driveLetter: string): boolean {
    return /^[A-Za-z]:?$/.test(driveLetter);
  }

  /**
   * Normalize drive letter to uppercase with colon
   */
  normalizeDriveLetter(driveLetter: string): string {
    const cleaned = driveLetter.trim().toUpperCase();
    return cleaned.endsWith(':') ? cleaned : `${cleaned}:`;
  }
}

export const driveAnalyzerService = new DriveAnalyzerService();

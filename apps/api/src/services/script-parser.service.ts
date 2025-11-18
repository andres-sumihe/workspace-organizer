/**
 * Script Parser Service
 * Extracts drive mappings, network paths, and credentials from batch script content
 */

export interface ParsedDriveMapping {
  driveLetter: string;
  networkPath: string;
  serverName?: string;
  shareName?: string;
  hasCredentials: boolean;
  username?: string;
}

export interface ParsedScriptContent {
  driveMappings: ParsedDriveMapping[];
  hasCredentials: boolean;
  referencedScripts: string[];
}

export class ScriptParserService {
  /**
   * Parse batch script content to extract drive mappings and metadata
   */
  parseScriptContent(content: string): ParsedScriptContent {
    const driveMappings: ParsedDriveMapping[] = [];
    const referencedScripts = new Set<string>();
    let hasCredentials = false;

    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('REM ') || trimmed.startsWith('::') || trimmed === '') {
        continue;
      }

      // Parse NET USE commands
      const netUseMapping = this.parseNetUseCommand(trimmed);
      if (netUseMapping) {
        driveMappings.push(netUseMapping);
        if (netUseMapping.hasCredentials) {
          hasCredentials = true;
        }
      }

      // Detect credential patterns
      if (this.detectCredentialPattern(trimmed)) {
        hasCredentials = true;
      }

      // Extract referenced batch scripts
      const scriptRefs = this.extractScriptReferences(trimmed);
      scriptRefs.forEach((ref) => referencedScripts.add(ref));
    }

    return {
      driveMappings,
      hasCredentials,
      referencedScripts: Array.from(referencedScripts)
    };
  }

  /**
   * Parse a NET USE command line
   * Formats:
   * - NET USE G: \\server\share
   * - NET USE G: \\server\share /USER:domain\username password
   * - NET USE G: \\server\share /PERSISTENT:YES
   */
  private parseNetUseCommand(line: string): ParsedDriveMapping | null {
    // Match NET USE command with various patterns
    const netUsePattern = /NET\s+USE\s+([A-Za-z]:)\s+(\\\\[^\s]+)(?:\s+\/USER:([^\s]+))?/i;
    const match = line.match(netUsePattern);

    if (!match) {
      return null;
    }

    const driveLetter = match[1].toUpperCase();
    const networkPath = match[2];
    const username = match[3];

    const { serverName, shareName } = this.parseNetworkPath(networkPath);

    return {
      driveLetter,
      networkPath,
      serverName,
      shareName,
      hasCredentials: !!username,
      username
    };
  }

  /**
   * Parse UNC path to extract server and share names
   * Example: \\server\share\path -> { serverName: 'server', shareName: 'share' }
   */
  private parseNetworkPath(uncPath: string): { serverName?: string; shareName?: string } {
    const uncPattern = /^\\\\([^\\]+)\\([^\\]+)/;
    const match = uncPath.match(uncPattern);

    if (!match) {
      return {};
    }

    return {
      serverName: match[1],
      shareName: match[2]
    };
  }

  /**
   * Detect credential-related patterns in script content
   */
  private detectCredentialPattern(line: string): boolean {
    const credentialPatterns = [
      /\/USER:/i,
      /\/PASSWORD:/i,
      /password\s*=/i,
      /username\s*=/i,
      /credential/i,
      /net use.*\/user/i
    ];

    return credentialPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Extract references to other batch scripts
   * Detects CALL, START, and direct .bat/.cmd invocations
   */
  private extractScriptReferences(line: string): string[] {
    const references: string[] = [];

    // Match CALL command
    const callPattern = /CALL\s+["']?([^"'\s]+\.(?:bat|cmd))["']?/i;
    const callMatch = line.match(callPattern);
    if (callMatch) {
      references.push(callMatch[1]);
    }

    // Match START command
    const startPattern = /START\s+(?:["'][^"']*["']\s+)?["']?([^"'\s]+\.(?:bat|cmd))["']?/i;
    const startMatch = line.match(startPattern);
    if (startMatch) {
      references.push(startMatch[1]);
    }

    // Match direct invocation
    const directPattern = /^\s*["']?([^"'\s]+\.(?:bat|cmd))["']?/i;
    const directMatch = line.match(directPattern);
    if (directMatch && !line.toLowerCase().startsWith('rem') && !line.startsWith('::')) {
      references.push(directMatch[1]);
    }

    return references;
  }

  /**
   * Parse a batch script file from disk
   * (Placeholder for file system integration)
   */
  async parseScriptFile(filePath: string): Promise<ParsedScriptContent> {
    // This method would read the file and parse its content
    // For now, it's a placeholder that will be implemented with file system integration
    throw new Error(`File parsing not yet implemented for: ${filePath}`);
  }

  /**
   * Detect the script type based on file extension and content
   */
  detectScriptType(filePath: string, content: string): 'batch' | 'powershell' | 'shell' | 'other' {
    const extension = filePath.toLowerCase().split('.').pop();

    if (extension === 'bat' || extension === 'cmd') {
      return 'batch';
    }

    if (extension === 'ps1') {
      return 'powershell';
    }

    if (extension === 'sh' || extension === 'bash') {
      return 'shell';
    }

    // Content-based detection as fallback
    if (content.includes('NET USE') || content.includes('@echo')) {
      return 'batch';
    }

    if (content.includes('param(') || content.includes('$PSVersionTable')) {
      return 'powershell';
    }

    if (content.includes('#!/bin/bash') || content.includes('#!/bin/sh')) {
      return 'shell';
    }

    return 'other';
  }
}

export const scriptParserService = new ScriptParserService();

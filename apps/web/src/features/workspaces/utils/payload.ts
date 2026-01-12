/**
 * Payload utilities for binary-safe file transfer via clipboard/text
 * Uses Base64 encoding + SHA256 checksums for integrity verification
 * Supports both single-file and multi-file transfers
 */

// New multi-file transfer payload format (v1.1)
export interface FileEntry {
  fileName: string;
  sizeBytes: number;
  checksumSha256: string;
  data: string; // Base64-encoded file content
}

export interface FileTransferPayload {
  kind: 'FILE_TRANSFER_PAYLOAD';
  version: '1.1';
  metadata: {
    fileCount: number;
    totalBytes: number;
    createdAtUtc: string;
  };
  files: FileEntry[];
}

// Legacy single-file payload format (for backward compatibility)
export interface FilePayload {
  kind: 'FILE_PAYLOAD';
  version: '1.0';
  metadata: {
    fileName: string;
    sizeBytes: number;
    checksumSha256: string;
    createdAtUtc: string;
  };
  data: string; // Base64-encoded file content
}

// Type union for parsing
export type AnyPayload = FileTransferPayload | FilePayload;

/**
 * Compute SHA256 hash of a Uint8Array
 */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a JSON payload from a single File object (legacy format)
 */
export async function createFilePayload(file: File): Promise<FilePayload> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksumSha256 = await sha256(bytes);
  const base64Data = btoa(String.fromCharCode(...bytes));

  return {
    kind: 'FILE_PAYLOAD',
    version: '1.0',
    metadata: {
      fileName: file.name,
      sizeBytes: file.size,
      checksumSha256,
      createdAtUtc: new Date().toISOString()
    },
    data: base64Data
  };
}

/**
 * Create a transfer payload from one or more files (new multi-file format)
 */
export async function createTransferPayload(files: File[]): Promise<FileTransferPayload> {
  const fileEntries: FileEntry[] = [];
  let totalBytes = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksumSha256 = await sha256(bytes);
    const base64Data = btoa(String.fromCharCode(...bytes));

    fileEntries.push({
      fileName: file.name,
      sizeBytes: file.size,
      checksumSha256,
      data: base64Data
    });

    totalBytes += file.size;
  }

  return {
    kind: 'FILE_TRANSFER_PAYLOAD',
    version: '1.1',
    metadata: {
      fileCount: files.length,
      totalBytes,
      createdAtUtc: new Date().toISOString()
    },
    files: fileEntries
  };
}

/**
 * Parse and validate a JSON payload string (supports both old and new formats)
 */
export function parseTransferPayload(payloadText: string): FileTransferPayload {
  const cleanText = payloadText.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Payload is not valid JSON: ${err.message}`);
    }
    throw err;
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Payload is not a valid object.');
  }

  const obj = parsed as Record<string, unknown>;

  // Handle new multi-file format
  if (obj.kind === 'FILE_TRANSFER_PAYLOAD' && Array.isArray(obj.files)) {
    return parsed as FileTransferPayload;
  }

  // Convert legacy FILE_PAYLOAD to new format
  if (obj.kind === 'FILE_PAYLOAD' && obj.data && obj.metadata) {
    const legacy = parsed as FilePayload;
    return {
      kind: 'FILE_TRANSFER_PAYLOAD',
      version: '1.1',
      metadata: {
        fileCount: 1,
        totalBytes: legacy.metadata.sizeBytes,
        createdAtUtc: legacy.metadata.createdAtUtc
      },
      files: [
        {
          fileName: legacy.metadata.fileName,
          sizeBytes: legacy.metadata.sizeBytes,
          checksumSha256: legacy.metadata.checksumSha256,
          data: legacy.data
        }
      ]
    };
  }

  // Convert LAU_PAYLOAD format (from PowerShell)
  if (obj.kind === 'LAU_PAYLOAD' && obj.data && obj.metadata) {
    const legacy = parsed as FilePayload;
    return {
      kind: 'FILE_TRANSFER_PAYLOAD',
      version: '1.1',
      metadata: {
        fileCount: 1,
        totalBytes: legacy.metadata.sizeBytes,
        createdAtUtc: legacy.metadata.createdAtUtc
      },
      files: [
        {
          fileName: legacy.metadata.fileName,
          sizeBytes: legacy.metadata.sizeBytes,
          checksumSha256: legacy.metadata.checksumSha256,
          data: legacy.data
        }
      ]
    };
  }

  throw new Error('Payload is missing FILE_TRANSFER_PAYLOAD metadata or files array.');
}

/**
 * Parse and validate a JSON payload string (legacy function for single file)
 */
export function parseFilePayload(payloadText: string): FilePayload {
  const cleanText = payloadText.trim();

  try {
    const parsed = JSON.parse(cleanText) as unknown;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as Record<string, unknown>).kind !== 'FILE_PAYLOAD' ||
      !(parsed as Record<string, unknown>).data
    ) {
      throw new Error('Payload is missing FILE metadata.');
    }

    return parsed as FilePayload;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Payload is not valid JSON: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Decode Base64 file data and verify checksum (legacy single-file)
 */
export async function extractPayloadFile(payload: FilePayload): Promise<{ file: File; hashMatches: boolean }> {
  // Decode Base64
  let binaryString: string;
  try {
    binaryString = atob(payload.data);
  } catch (_err) {
    throw new Error('Payload data is not valid base64.');
  }

  // Convert binary string to bytes array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Verify checksum
  const calculatedHash = await sha256(bytes);
  const hashMatches = calculatedHash === payload.metadata.checksumSha256;

  // Create File object from array of bytes
  const file = new File([new Uint8Array(binaryString.split('').map((c) => c.charCodeAt(0)))], payload.metadata.fileName, {
    type: 'application/octet-stream'
  });

  return { file, hashMatches };
}

export interface ExtractedFile {
  file: File;
  hashMatches: boolean;
  fileName: string;
}

/**
 * Extract all files from a transfer payload
 */
export async function extractTransferFiles(payload: FileTransferPayload): Promise<ExtractedFile[]> {
  const results: ExtractedFile[] = [];

  for (const fileEntry of payload.files) {
    // Decode Base64
    let binaryString: string;
    try {
      binaryString = atob(fileEntry.data);
    } catch {
      throw new Error(`File "${fileEntry.fileName}" has invalid base64 data.`);
    }

    // Convert binary string to bytes array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Verify checksum
    const calculatedHash = await sha256(bytes);
    const hashMatches = calculatedHash === fileEntry.checksumSha256;

    // Create File object
    const file = new File([bytes], fileEntry.fileName, {
      type: 'application/octet-stream'
    });

    results.push({ file, hashMatches, fileName: fileEntry.fileName });
  }

  return results;
}

/**
 * Convert payload to JSON string (for clipboard)
 */
export function payloadToJson(payload: FilePayload | FileTransferPayload): string {
  return JSON.stringify(payload, null, 0); // compact JSON
}

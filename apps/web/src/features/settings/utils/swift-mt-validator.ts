/**
 * SWIFT MT (ISO 15022) Message Validation Utilities
 * Detects and validates SWIFT FIN MT messages
 * 
 * MT Message Structure:
 * - Block 1: Basic Header {1:F01BANKBEBBAXXX1234567890}
 * - Block 2: Application Header {2:I103BANKDEFFXXXXN} or {2:O103...}
 * - Block 3: User Header (optional)
 * - Block 4: Text Block with fields
 * - Block 5: Trailer (optional)
 * 
 * Batch File Formats:
 * - DOS-PCC: Messages start with 0x01 (SOH) and end with 0x03 (ETX)
 *            Sector-aligned (512 bytes), padded with 0x20 or 0x00
 * - RJE: Messages delimited with $ character between blocks
 */

/**
 * Message format types:
 * - RJE (Remote Job Entry): Uses $ character as delimiter between blocks
 * - DOS/PCC: Uses SOH (0x01) as start and ETX (0x03) as end markers
 * - FIN: Standard SWIFT FIN format with { } block delimiters (online/real-time)
 */
export type SwiftMTFormat = 'dos_pcc' | 'rje' | 'fin' | 'unknown';

export interface SwiftMTValidationCriteria {
  /** Expected sender BIC (8 or 11 characters) */
  senderBIC: string;
  /** Expected receiver BIC (8 or 11 characters) */
  receiverBIC: string;
  /** Whether to validate format type */
  validateFormat: boolean;
  /** Expected format type (dos_pcc or rje) */
  expectedFormat?: SwiftMTFormat;
}

export interface SwiftMTValidationResult {
  /** Whether this is a SWIFT MT message */
  isSwiftMT: boolean;
  /** Detected message type (e.g., MT103, MT202) */
  messageType?: string;
  /** Detected format (dos_pcc or rje) */
  format?: SwiftMTFormat;
  /** Whether the message passed validation */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
  /** Extracted details from the message */
  details: {
    messageType?: string;
    format?: SwiftMTFormat;
    senderBIC?: string;
    senderLogicalTerminal?: string;
    receiverBIC?: string;
    receiverLogicalTerminal?: string;
    direction?: 'input' | 'output';
  };
}

/**
 * Validate a BIC/LT code structure
 * BIC8: 4 letters (bank) + 2 letters (country) + 2 alphanumeric (location)
 * BIC11: BIC8 + 3 alphanumeric (branch)
 * LT12: BIC8 + 1 alphanumeric (LT identifier) + 3 alphanumeric (branch)
 */
export function validateBIC(bic: string): { isValid: boolean; error?: string } {
  if (!bic) {
    return { isValid: false, error: 'BIC is empty' };
  }

  const trimmed = bic.trim().toUpperCase();
  
  if (trimmed.length !== 8 && trimmed.length !== 11 && trimmed.length !== 12) {
    return { isValid: false, error: `BIC/LT must be 8, 11, or 12 characters, found ${trimmed.length}` };
  }

  // First 4 characters: bank code (letters only)
  const bankCode = trimmed.substring(0, 4);
  if (!/^[A-Z]{4}$/.test(bankCode)) {
    return { isValid: false, error: 'Bank code (first 4 chars) must be letters only' };
  }

  // Characters 5-6: country code (letters only)
  const countryCode = trimmed.substring(4, 6);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { isValid: false, error: 'Country code (chars 5-6) must be letters only' };
  }

  // Characters 7-8: location code (alphanumeric)
  const locationCode = trimmed.substring(6, 8);
  if (!/^[A-Z0-9]{2}$/.test(locationCode)) {
    return { isValid: false, error: 'Location code (chars 7-8) must be alphanumeric' };
  }

  // If BIC11, characters 9-11: branch code (alphanumeric)
  if (trimmed.length === 11) {
    const branchCode = trimmed.substring(8, 11);
    if (!/^[A-Z0-9]{3}$/.test(branchCode)) {
      return { isValid: false, error: 'Branch code (chars 9-11) must be alphanumeric' };
    }
  }

  // If LT12, character 9: LT identifier (alphanumeric), characters 10-12: branch code
  if (trimmed.length === 12) {
    const ltIdentifier = trimmed.charAt(8);
    if (!/^[A-Z0-9]$/.test(ltIdentifier)) {
      return { isValid: false, error: 'LT identifier (char 9) must be alphanumeric' };
    }
    const branchCode = trimmed.substring(9, 12);
    if (!/^[A-Z0-9]{3}$/.test(branchCode)) {
      return { isValid: false, error: 'Branch code (chars 10-12) must be alphanumeric' };
    }
  }

  return { isValid: true };
}

/**
 * Extract BIC/LT from Logical Terminal address (12 characters)
 * LT format: BIC8 + LT identifier (1 char) + Branch (3 chars)
 * 
 * Returns the full Logical Terminal (12 chars) to preserve all information
 * Example: CENAIDJ0AXXX (LT) -> CENAIDJ0AXXX (full LT with identifier)
 * 
 * For comparison purposes, use compareBICs which handles BIC8/BIC11/LT comparison
 */
export function extractBICFromLT(logicalTerminal: string): string | null {
  if (!logicalTerminal || logicalTerminal.length < 8) {
    return null;
  }

  // Return the full Logical Terminal (up to 12 chars) to preserve LT identifier
  // This allows displaying the complete address: BIC8 + LT + Branch
  return logicalTerminal.substring(0, Math.min(logicalTerminal.length, 12));
}

/**
 * Compare two BIC/LT codes (handles BIC8, BIC11, and LT12 comparison)
 * 
 * BIC comparison rules:
 * - If both are same length, exact match required
 * - When comparing LT12 (12 chars) with BIC11, extract BIC11 from LT12 by removing LT identifier (char 9)
 * - BIC8 is equivalent to BIC11 with XXX branch (head office)
 * - BIC11 with specific branch (not XXX) must match exactly
 */
export function compareBICs(bic1: string, bic2: string): boolean {
  if (!bic1 || !bic2) return false;
  
  const b1 = bic1.toUpperCase().trim();
  const b2 = bic2.toUpperCase().trim();
  
  // If both are same length, exact match required (including LT identifier for LT12)
  if (b1.length === b2.length) {
    return b1 === b2;
  }
  
  // Different lengths - need normalization
  // LT12 format: BIC8 (8) + LT identifier (1) + Branch (3) = 12 chars
  // BIC11 format: BIC8 (8) + Branch (3) = 11 chars
  // BIC8 format: 8 chars
  
  const normalizeToBIC11 = (code: string): string => {
    if (code.length === 12) {
      // Extract BIC8 + Branch, skip LT identifier at position 8
      return code.substring(0, 8) + code.substring(9, 12);
    }
    return code;
  };
  
  const norm1 = normalizeToBIC11(b1);
  const norm2 = normalizeToBIC11(b2);
  
  // After normalization, if same length, exact match required
  if (norm1.length === norm2.length) {
    return norm1 === norm2;
  }
  
  // Different lengths after normalization - one is BIC8, other is BIC11
  // BIC8 is ONLY equivalent to BIC11 with XXX branch
  const bic8 = norm1.length === 8 ? norm1 : (norm2.length === 8 ? norm2 : null);
  const bic11 = norm1.length === 11 ? norm1 : (norm2.length === 11 ? norm2 : null);
  
  if (!bic8 || !bic11) {
    // Invalid lengths
    return false;
  }
  
  // BIC8 portions must match
  if (bic8 !== bic11.substring(0, 8)) {
    return false;
  }
  
  // BIC8 only matches BIC11 if branch is XXX (head office)
  const branch = bic11.substring(8, 11);
  return branch === 'XXX';
}

/**
 * Detect the format of a SWIFT MT message
 * 
 * DOS-PCC: Starts with SOH (0x01) and ends with ETX (0x03), sector-aligned (512 bytes)
 * RJE: Uses $ as delimiter BETWEEN multiple messages (not before blocks)
 *      Single RJE message looks identical to FIN: {1:...}{2:...}
 *      Multiple RJE messages: {1:...}{2:...}${1:...}{2:...}
 * FIN: Standard online format using { } block delimiters
 * 
 * Note: Single-message RJE and FIN files are indistinguishable by content alone.
 * When there's no $ delimiter, we return 'fin' as the default text format.
 * 
 * IMPORTANT: This function only detects the FORMAT, not whether it's a valid MT message.
 * A file must pass additional validation to be considered a SWIFT MT message.
 */
export function detectFormat(content: string): SwiftMTFormat {
  if (!content || content.length === 0) {
    return 'unknown';
  }

  // Check for DOS-PCC format: starts with SOH (0x01) character
  // In ASCII, charCode 1 is SOH (Start of Header)
  const firstChar = content.charCodeAt(0);
  if (firstChar === 0x01) {
    return 'dos_pcc';
  }
  
  // Check for RJE format: uses $ as delimiter BETWEEN messages
  // The $ appears at the end of one message before the next: }${1: or -}${1:
  // This only works when file contains multiple messages
  // Pattern: closing brace/block followed by $ then opening of next message
  if (/\}\s*\$\s*\{1:/.test(content) || /-\}\s*\$\s*\{1:/.test(content)) {
    return 'rje';
  }
  
  // For FIN format, we need stricter detection to avoid false positives
  // The file should start with {1: (possibly with whitespace) and contain proper MT structure
  const trimmed = content.trim();
  
  // Must start with {1: - this is the primary indicator
  if (!trimmed.startsWith('{1:')) {
    return 'unknown';
  }
  
  return 'fin';
}

/**
 * Parse Block 1 (Basic Header)
 * Format: {1:F01BANKBEBBAXXX1234567890}
 * - Position 1: Application ID (F=FIN, A=GPA, L=Login)
 * - Position 2-3: Service ID (01, 21, etc.)
 * - Position 4-15: Logical Terminal (12 chars)
 * - Position 16-19: Session Number (4 digits)
 * - Position 20-25: Sequence Number (6 digits)
 */
function parseBlock1(content: string): {
  applicationId?: string;
  serviceId?: string;
  logicalTerminal?: string;
  sessionNumber?: string;
  sequenceNumber?: string;
} | null {
  // Match Block 1 content
  const block1Match = content.match(/\{1:([^}]+)\}/);
  if (!block1Match) return null;
  
  const block1Value = block1Match[1];
  
  // Block 1 value should be at least 24 characters
  if (block1Value.length < 15) return null;
  
  return {
    applicationId: block1Value.substring(0, 1),
    serviceId: block1Value.substring(1, 3),
    logicalTerminal: block1Value.substring(3, 15),
    sessionNumber: block1Value.length >= 19 ? block1Value.substring(15, 19) : undefined,
    sequenceNumber: block1Value.length >= 25 ? block1Value.substring(19, 25) : undefined
  };
}

/**
 * Parse Block 2 (Application Header)
 * Input format: {2:I103BANKDEFFXXXXN}
 * - Position 1: I (Input)
 * - Position 2-4: Message Type (103, 202, etc.)
 * - Position 5-16: Receiver BIC (11 chars) + LT identifier (1 char) = 12 chars total
 * - Position 17: Priority (N=Normal, U=Urgent, S=System)
 * 
 * Note: In Input messages, the receiver is specified as BIC11 + optional LT identifier
 *       Example: CENAIDJ0AXXXN -> BIC11=CENAIDJ0AXXX, LT=implicit, Priority=N
 * 
 * Output format: {2:O1030803051028AAPBESMMAXXX54237368560510280803N}
 * - Position 1: O (Output)
 * - Position 2-4: Message Type
 * - Position 5-8: Input Time (HHMM)
 * - Position 9-14: MIR Date (YYMMDD)
 * - Position 15-26: MIR Logical Terminal (sender, 12 chars)
 * - Position 27-30: MIR Session Number
 * - Position 31-36: MIR Sequence Number
 * - Position 37-42: Output Date (YYMMDD)
 * - Position 43-46: Output Time (HHMM)
 * - Position 47: Priority
 */
function parseBlock2(content: string): {
  direction?: 'input' | 'output';
  messageType?: string;
  receiverLT?: string;
  senderLT?: string;
  priority?: string;
} | null {
  // Match Block 2 content
  const block2Match = content.match(/\{2:([^}]+)\}/);
  if (!block2Match) return null;
  
  const block2Value = block2Match[1];
  
  if (block2Value.length < 4) return null;
  
  const direction = block2Value.charAt(0);
  const messageType = block2Value.substring(1, 4);
  
  if (direction === 'I') {
    // Input message: receiver is Logical Terminal (12 chars)
    // Format: I + 3-digit MT + 12-char LT + 1-char priority (+ optional delivery monitoring)
    // Example: I799CENAIDJ0AXXXN2020
    //          I + 799 + CENAIDJ0AXXX (12-char LT) + N + 2020
    // LT format: BIC8 (8) + LT identifier (1) + Branch (3) = 12 chars
    const receiverLT = block2Value.length >= 16 ? block2Value.substring(4, 16) : undefined;
    const priority = block2Value.length >= 17 ? block2Value.charAt(16) : undefined;
    
    return {
      direction: 'input',
      messageType,
      receiverLT,  // Logical Terminal (12 chars), BIC will be extracted later
      priority
    };
  } else if (direction === 'O') {
    // Output message
    // MIR Logical Terminal starts at position 15 (index 14)
    return {
      direction: 'output',
      messageType,
      senderLT: block2Value.length >= 26 ? block2Value.substring(14, 26) : undefined,
      priority: block2Value.length >= 47 ? block2Value.charAt(46) : undefined
    };
  }
  
  return { messageType };
}

/**
 * Detect if content is a SWIFT MT message
 */
export function detectSwiftMT(content: string): {
  isSwiftMT: boolean;
  messageType?: string;
  format?: SwiftMTFormat;
} {
  if (!content || typeof content !== 'string') {
    return { isSwiftMT: false };
  }

  const format = detectFormat(content);
  
  // If format is unknown, this is not an MT file
  if (format === 'unknown') {
    return { isSwiftMT: false };
  }
  
  // For DOS-PCC, verify it has the required structure
  if (format === 'dos_pcc') {
    // Must start with SOH (0x01)
    if (content.charCodeAt(0) !== 0x01) {
      return { isSwiftMT: false };
    }
    // Must contain ETX (0x03) somewhere
    let hasETX = false;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 0x03) {
        hasETX = true;
        break;
      }
    }
    if (!hasETX) {
      return { isSwiftMT: false };
    }
  }
  
  // Normalize content for parsing
  let normalizedContent = content;
  if (format === 'rje') {
    normalizedContent = content.replace(/\$\{/g, '{').replace(/\}\$/g, '}');
    normalizedContent = normalizedContent.replace(/\$([1-5]:)/g, '{$1');
  } else if (format === 'dos_pcc') {
    normalizedContent = removeControlChars(content).trim();
  }
  
  // Find the actual MT message, skipping any ACK/NAK service messages
  const mtMessage = findActualMTMessage(normalizedContent);
  if (!mtMessage) {
    return { isSwiftMT: false };
  }
  
  // Try to parse Block 1 of the actual MT message
  const block1 = parseBlock1(mtMessage);
  if (!block1) {
    return { isSwiftMT: false };
  }
  
  // Validate Block 1 structure more strictly
  // Application ID should be F (FIN), A (GPA), or L (Login)
  if (!block1.applicationId || !['F', 'A', 'L'].includes(block1.applicationId)) {
    return { isSwiftMT: false };
  }
  
  // Service ID should be 01 or 21
  if (!block1.serviceId || !['01', '21'].includes(block1.serviceId)) {
    return { isSwiftMT: false };
  }
  
  // Logical Terminal should be 12 characters
  if (!block1.logicalTerminal || block1.logicalTerminal.length !== 12) {
    return { isSwiftMT: false };
  }
  
  // Try to get message type from Block 2
  const block2 = parseBlock2(mtMessage);
  
  // Block 2 is required for a valid MT message
  if (!block2 || !block2.messageType) {
    return { isSwiftMT: false };
  }
  
  // Message type should be 3 digits
  if (!/^\d{3}$/.test(block2.messageType)) {
    return { isSwiftMT: false };
  }
  
  const messageType = `MT${block2.messageType}`;
  
  return {
    isSwiftMT: true,
    messageType,
    format
  };
}

/**
 * Find the actual MT message in content, skipping ACK/NAK service messages
 * Output files are preceded by user ACK (F21) which should be skipped
 * 
 * Service IDs:
 * - 01: FIN/GPA message (the actual MT)
 * - 21: ACK/NAK message (should skip)
 */
function findActualMTMessage(content: string): string | null {
  // First, check if the content directly has a valid MT message structure
  // An MT message must have Block 1 with service ID 01 AND Block 2 with I or O
  
  // Find all {1:...} blocks
  const block1Matches = content.match(/\{1:([^}]+)\}/g);
  if (!block1Matches) {
    return null;
  }
  
  // Try each Block 1 to find one with service ID 01 that has a corresponding Block 2
  for (const block1Full of block1Matches) {
    const block1Value = block1Full.slice(3, -1); // Remove {1: and }
    
    // Check service ID (position 1-2 in the value, after Application ID at position 0)
    const serviceId = block1Value.substring(1, 3);
    
    // Service ID 01 is the actual FIN message, 21 is ACK/NAK
    if (serviceId === '01') {
      // Find where this Block 1 starts in the content
      const block1Index = content.indexOf(block1Full);
      const remainingContent = content.substring(block1Index);
      
      // Check if there's a Block 2 after this Block 1
      // Block 2 starts with {2:I (input) or {2:O (output)
      const block2Match = remainingContent.match(/\{2:([IO])/);
      if (block2Match) {
        // Found a valid MT message - return from this Block 1 onwards
        // Find the next Block 1 (if any) to determine message boundary
        const nextBlock1Index = remainingContent.indexOf('{1:', 4);
        if (nextBlock1Index > 0) {
          return remainingContent.substring(0, nextBlock1Index);
        }
        return remainingContent;
      }
    }
  }
  
  // Fallback: if no F01 with Block 2 found, check if content has any {2:I or {2:O
  // This handles edge cases where the service ID might be different
  if (/\{2:[IO]/.test(content)) {
    return content;
  }
  
  return null;
}

/**
 * Validate DOS-PCC sector alignment
 * DOS-PCC messages must be sector-aligned (512 bytes)
 * Each message starts on a sector boundary and ends with ETX (0x03)
 * Space between end of message and end of sector is filled with 0x20 or 0x00
 */
function validateDosPccSectorAlignment(content: string): { isValid: boolean; errors: string[] } {
  const SECTOR_SIZE = 512;
  const errors: string[] = [];
  
  // Check if file size is sector-aligned
  if (content.length % SECTOR_SIZE !== 0) {
    errors.push(`File size (${content.length} bytes) is not sector-aligned (must be multiple of ${SECTOR_SIZE} bytes)`);
  }
  
  // Find all messages (SOH to ETX boundaries)
  const messages: { start: number; end: number }[] = [];
  let currentStart = -1;
  
  for (let i = 0; i < content.length; i++) {
    const charCode = content.charCodeAt(i);
    if (charCode === 0x01) { // SOH
      currentStart = i;
    } else if (charCode === 0x03 && currentStart >= 0) { // ETX
      messages.push({ start: currentStart, end: i });
      currentStart = -1;
    }
  }
  
  if (messages.length === 0) {
    errors.push('No valid DOS-PCC message boundaries found (missing SOH/ETX markers)');
    return { isValid: false, errors };
  }
  
  // Check each message for sector alignment
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    // First message should start at position 0 (or a sector boundary)
    if (msg.start % SECTOR_SIZE !== 0) {
      errors.push(`Message ${i + 1}: Does not start on sector boundary (position ${msg.start}, expected multiple of ${SECTOR_SIZE})`);
    }
    
    // Check padding after ETX until next sector boundary or next message
    const etxPosition = msg.end;
    const nextSectorBoundary = Math.ceil((etxPosition + 1) / SECTOR_SIZE) * SECTOR_SIZE;
    
    // Check if there's missing padding (file ends before sector boundary)
    if (content.length < nextSectorBoundary) {
      const missingBytes = nextSectorBoundary - content.length;
      errors.push(`Message ${i + 1}: Missing ${missingBytes} bytes of padding after ETX (file ends at ${content.length}, sector boundary at ${nextSectorBoundary})`);
    } else {
      // Verify padding characters (should be 0x20 space or 0x00 null)
      for (let j = etxPosition + 1; j < nextSectorBoundary && j < content.length; j++) {
        const paddingChar = content.charCodeAt(j);
        // Next message's SOH is allowed
        if (paddingChar === 0x01) break;
        // Valid padding characters
        if (paddingChar !== 0x20 && paddingChar !== 0x00) {
          errors.push(`Message ${i + 1}: Invalid padding character at position ${j} (found 0x${paddingChar.toString(16).padStart(2, '0')}, expected 0x20 or 0x00)`);
          break; // Only report first invalid padding
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Normalize SWIFT MT content to standard FIN format for parsing
 */
function normalizeContent(content: string, format: SwiftMTFormat): string {
  if (format === 'rje') {
    // RJE format: ${1:...}${2:...} or $1:...$2:...
    // Convert to standard FIN format for parsing
    let normalized = content.replace(/\$\{/g, '{').replace(/\}\$/g, '}');
    // Also handle $1: pattern (without braces around $)
    normalized = normalized.replace(/\$([1-5]:)/g, '{$1');
    return normalized;
  } else if (format === 'dos_pcc') {
    // DOS-PCC format: remove SOH (0x01) and ETX (0x03) markers
    // Also remove any padding (0x00 or 0x20 at end)
    return removeControlChars(content).trim();
  }
  return content;
}

/**
 * Remove control characters (SOH, ETX, NULL) from content
 */
function removeControlChars(content: string): string {
  let result = '';
  for (let i = 0; i < content.length; i++) {
    const charCode = content.charCodeAt(i);
    // Skip SOH (0x01), ETX (0x03), and NULL (0x00)
    if (charCode !== 0x00 && charCode !== 0x01 && charCode !== 0x03) {
      result += content[i];
    }
  }
  return result;
}

/**
 * Validate a SWIFT MT message against criteria
 */
export function validateSwiftMT(
  content: string,
  criteria: SwiftMTValidationCriteria
): SwiftMTValidationResult {
  const detection = detectSwiftMT(content);
  
  if (!detection.isSwiftMT) {
    return {
      isSwiftMT: false,
      isValid: false,
      errors: ['Not a valid SWIFT MT message'],
      warnings: [],
      details: {}
    };
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: SwiftMTValidationResult['details'] = {
    messageType: detection.messageType,
    format: detection.format
  };
  
  // Normalize content for parsing, then find the actual MT message (skip ACK/NAK)
  const normalizedContent = normalizeContent(content, detection.format || 'fin');
  const mtMessage = findActualMTMessage(normalizedContent) || normalizedContent;
  
  // Parse blocks from the actual MT message
  const block1 = parseBlock1(mtMessage);
  const block2 = parseBlock2(mtMessage);
  
  // Extract sender and receiver BICs based on message direction
  let senderLT: string | undefined;
  let senderBIC: string | undefined;
  let receiverLT: string | undefined;
  let receiverBIC: string | undefined;
  
  if (block2?.direction === 'input') {
    // Input message: Block 1 LT is sender, Block 2 has receiver LT
    senderLT = block1?.logicalTerminal;
    senderBIC = senderLT ? extractBICFromLT(senderLT) ?? undefined : undefined;
    // For input messages, Block 2 contains receiver LT (12 chars)
    receiverLT = block2.receiverLT;
    receiverBIC = receiverLT ? extractBICFromLT(receiverLT) ?? undefined : undefined;
    details.direction = 'input';
  } else if (block2?.direction === 'output') {
    // Output message: Block 2 MIR LT is sender, Block 1 LT is receiver
    senderLT = block2.senderLT;
    senderBIC = senderLT ? extractBICFromLT(senderLT) ?? undefined : undefined;
    receiverLT = block1?.logicalTerminal;
    receiverBIC = receiverLT ? extractBICFromLT(receiverLT) ?? undefined : undefined;
    details.direction = 'output';
  } else {
    // Unknown direction, use Block 1 as sender
    senderLT = block1?.logicalTerminal;
    senderBIC = senderLT ? extractBICFromLT(senderLT) ?? undefined : undefined;
    warnings.push('Could not determine message direction (input/output)');
  }
  
  // Store extracted details
  details.senderLogicalTerminal = senderLT;
  details.senderBIC = senderBIC;
  details.receiverLogicalTerminal = receiverLT;
  details.receiverBIC = receiverBIC;
  
  // DOS-PCC specific validation: check 512-byte sector alignment
  // This always runs for DOS-PCC format since it's a structural requirement
  if (detection.format === 'dos_pcc') {
    const sectorValidation = validateDosPccSectorAlignment(content);
    if (!sectorValidation.isValid) {
      for (const error of sectorValidation.errors) {
        errors.push(error); // Add as error - sector alignment is required for DOS-PCC
      }
    }
  }
  
  // Validate sender BIC
  if (criteria.senderBIC) {
    if (!details.senderBIC) {
      errors.push('Sender BIC not found in message');
    } else if (!compareBICs(details.senderBIC, criteria.senderBIC)) {
      errors.push(`Sender BIC mismatch: expected "${criteria.senderBIC}", found "${details.senderBIC}"`);
    }
  }
  
  // Validate receiver BIC
  if (criteria.receiverBIC) {
    if (!details.receiverBIC) {
      errors.push('Receiver BIC not found in message');
    } else if (!compareBICs(details.receiverBIC, criteria.receiverBIC)) {
      errors.push(`Receiver BIC mismatch: expected "${criteria.receiverBIC}", found "${details.receiverBIC}"`);
    }
  }
  
  // Add informational warnings
  if (!detection.messageType) {
    warnings.push('Could not determine message type');
  }
  
  // Validate BIC structure
  if (details.senderBIC) {
    const bicValidation = validateBIC(details.senderBIC);
    if (!bicValidation.isValid) {
      warnings.push(`Sender BIC structure warning: ${bicValidation.error}`);
    }
  }
  
  if (details.receiverBIC) {
    const bicValidation = validateBIC(details.receiverBIC);
    if (!bicValidation.isValid) {
      warnings.push(`Receiver BIC structure warning: ${bicValidation.error}`);
    }
  }
  
  return {
    isSwiftMT: true,
    messageType: detection.messageType,
    format: detection.format,
    isValid: errors.length === 0,
    errors,
    warnings,
    details
  };
}

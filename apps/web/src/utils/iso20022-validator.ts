/**
 * ISO20022 XML Validation Utilities
 * Detects and validates ISO20022 standard messages (pacs, camt, pain, etc.)
 */

export interface ISO20022ValidationCriteria {
  senderDN: string;
  senderFullName: string;
  receiverDN: string;
  receiverFullName: string;
}

export interface ISO20022ValidationResult {
  isISO20022: boolean;
  messageType?: string; // e.g., pacs.009.001.08
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    messageType?: string;
    senderDN?: string;
    senderFullName?: string;
    receiverDN?: string;
    receiverFullName?: string;
  };
}

/**
 * Detect if XML content is an ISO20022 message
 */
export function detectISO20022(xmlContent: string): { isISO20022: boolean; messageType?: string } {
  try {
    // Priority 1: Check Saa:MessageIdentifier (most accurate for SWIFT Alliance messages)
    const messageIdentifierMatch = xmlContent.match(/<Saa:MessageIdentifier>([a-z]+\.\d+\.\d+\.\d+)<\/Saa:MessageIdentifier>/i);
    if (messageIdentifierMatch) {
      return { isISO20022: true, messageType: messageIdentifierMatch[1] };
    }

    // Priority 2: Check SWIFTNetNetworkInfo/RequestType
    const requestTypeMatch = xmlContent.match(/<Saa:RequestType>([a-z]+\.\d+\.\d+\.\d+)<\/Saa:RequestType>/i);
    if (requestTypeMatch) {
      return { isISO20022: true, messageType: requestTypeMatch[1] };
    }

    // Priority 3: Check for ISO20022 Document namespace with message type
    const documentMatch = xmlContent.match(/<Document xmlns="urn:iso:std:iso:20022:tech:xsd:([a-z]+\.\d+\.\d+\.\d+)">/i);
    if (documentMatch) {
      return { isISO20022: true, messageType: documentMatch[1] };
    }

    // Priority 4: Check generic ISO20022 namespace patterns (but these might be headers)
    const genericNamespaceMatch = xmlContent.match(/xmlns(?::[^=]+)?="urn:iso:std:iso:20022:tech:xsd:([a-z]+\.\d+\.\d+\.\d+)"/i);
    if (genericNamespaceMatch) {
      // Only use this if it's a payment message type (not head/auth headers)
      const msgType = genericNamespaceMatch[1];
      if (msgType.match(/^(pacs|camt|pain|acmt|reda|setr|semt|sese|trea|tsmt|colr)\./)) {
        return { isISO20022: true, messageType: msgType };
      }
    }

    // Priority 5: Check for common ISO20022 message types in root elements
    const messageTypePatterns = [
      /<(pacs|camt|pain|acmt|admi|auth|reda|setr|semt|sese|trea|tsmt|colr)\./,
      /<Document xmlns="urn:iso:std:iso:20022/
    ];

    for (const pattern of messageTypePatterns) {
      if (pattern.test(xmlContent)) {
        return { isISO20022: true };
      }
    }

    return { isISO20022: false };
  } catch {
    return { isISO20022: false };
  }
}

/**
 * Extract value from XML using simple text parsing
 */
function extractXMLValue(xmlContent: string, tagPath: string): string | null {
  try {
    // Handle nested tags like Sender/DN
    const tags = tagPath.split('/');
    let currentContent = xmlContent;

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const isLast = i === tags.length - 1;

      // Find the tag
      const openTagRegex = new RegExp(`<[^:]*:?${tag}[^>]*>`, 'i');
      const match = currentContent.match(openTagRegex);
      
      if (!match) return null;

      const startIndex = currentContent.indexOf(match[0]) + match[0].length;
      
      if (isLast) {
        // Extract value for the last tag
        const closeTagRegex = new RegExp(`</[^:]*:?${tag}>`, 'i');
        const closeMatch = currentContent.slice(startIndex).match(closeTagRegex);
        
        if (!closeMatch) return null;
        
        const value = currentContent.slice(startIndex, startIndex + currentContent.slice(startIndex).indexOf(closeMatch[0]));
        return value.trim();
      } else {
        // Move to the content inside this tag for the next iteration
        currentContent = currentContent.slice(startIndex);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate ISO20022 XML against testing environment criteria
 */
export function validateISO20022(
  xmlContent: string,
  criteria: ISO20022ValidationCriteria
): ISO20022ValidationResult {
  const detection = detectISO20022(xmlContent);

  if (!detection.isISO20022) {
    return {
      isISO20022: false,
      isValid: false,
      errors: ['Not an ISO20022 standard message'],
      warnings: [],
      details: {}
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const details: ISO20022ValidationResult['details'] = {};

  // Extract Sender information
  const senderDN = extractXMLValue(xmlContent, 'Sender/DN');
  const senderX1 = extractXMLValue(xmlContent, 'Sender/FullName/X1');
  
  details.senderDN = senderDN || undefined;
  details.senderFullName = senderX1 || undefined;

  // Extract Receiver information
  const receiverDN = extractXMLValue(xmlContent, 'Receiver/DN');
  const receiverX1 = extractXMLValue(xmlContent, 'Receiver/FullName/X1');
  
  details.receiverDN = receiverDN || undefined;
  details.receiverFullName = receiverX1 || undefined;

  // Validate Sender DN
  if (!senderDN) {
    errors.push('Sender DN not found in message');
  } else if (senderDN !== criteria.senderDN) {
    errors.push(`Sender DN mismatch: expected "${criteria.senderDN}", found "${senderDN}"`);
  }

  // Validate Sender Full Name
  if (!senderX1) {
    errors.push('Sender Full Name not found in message');
  } else if (senderX1 !== criteria.senderFullName) {
    errors.push(`Sender Full Name mismatch: expected "${criteria.senderFullName}", found "${senderX1}"`);
  }

  // Validate Receiver DN
  if (!receiverDN) {
    errors.push('Receiver DN not found in message');
  } else if (receiverDN !== criteria.receiverDN) {
    errors.push(`Receiver DN mismatch: expected "${criteria.receiverDN}", found "${receiverDN}"`);
  }

  // Validate Receiver Full Name
  if (!receiverX1) {
    errors.push('Receiver Full Name not found in message');
  } else if (receiverX1 !== criteria.receiverFullName) {
    errors.push(`Receiver Full Name mismatch: expected "${criteria.receiverFullName}", found "${receiverX1}"`);
  }

  // Add informational warnings if applicable
  if (detection.messageType) {
    const msgType = detection.messageType.split('.')[0];
    if (!['pacs', 'camt', 'pain'].includes(msgType)) {
      warnings.push(`Message type "${detection.messageType}" is less common for testing`);
    }
  }

  return {
    isISO20022: true,
    messageType: detection.messageType,
    isValid: errors.length === 0,
    errors,
    warnings,
    details: {
      ...details,
      messageType: detection.messageType
    }
  };
}

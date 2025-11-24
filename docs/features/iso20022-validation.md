# ISO20022 XML Validation Feature

## Overview
The ISO20022 validation feature automatically detects and validates ISO20022 XML files in the File Manager. When enabled, it checks whether files conform to expected criteria for the testing environment, such as Sender/Receiver Distinguished Names (DN) and Full Names.

## Components

### 1. Validation Utilities (`apps/web/src/utils/iso20022-validator.ts`)
Core validation logic with two main functions:

#### `detectISO20022(content: string): ISO20022Detection`
- Detects if an XML file is an ISO20022 message
- Identifies message type (pacs.009.001.08, camt.054.001.08, etc.)
- Returns detection result with namespace and message type

#### `validateISO20022(content: string, criteria: ISO20022ValidationCriteria): ISO20022ValidationResult`
- Validates ISO20022 messages against configurable criteria
- Extracts values from nested XML tags: `Sender/DN`, `Sender/FullName/X1`, `Receiver/DN`, `Receiver/FullName/X1`
- Returns validation result with:
  - `isValid`: Boolean indicating pass/fail
  - `errors[]`: List of validation errors (DN/FullName mismatches)
  - `warnings[]`: List of non-critical warnings (e.g., uncommon message types)
  - `details{}`: Extracted values (senderDN, senderFullName, receiverDN, receiverFullName, messageType)

### 2. Validation Settings Context (`apps/web/src/contexts/validation-settings-context.tsx`)
Manages validation criteria and enabled state with localStorage persistence.

**Default Criteria:**
```typescript
{
  senderDN: 'ou=xxx,o=cenaidja,o=swift',
  senderFullName: 'CENAIDJAXXX',
  receiverDN: 'ou=xxx,o=cenaidja,o=swift',
  receiverFullName: 'CENAIDJAXXX'
}
```

**Context API:**
- `criteria`: Current validation criteria
- `updateCriteria(criteria)`: Update criteria and persist to localStorage
- `isEnabled`: Toggle validation on/off
- `setIsEnabled(boolean)`: Update enabled state

**Storage Key:** `workspace-organizer-validation-settings`

### 3. Settings Page (`apps/web/src/pages/settings-page.tsx`)
User interface for configuring validation settings:
- Toggle to enable/disable automatic validation
- Input fields for:
  - Sender DN
  - Sender Full Name
  - Receiver DN
  - Receiver Full Name
- Save and Reset buttons
- Help text explaining how validation works

**Navigation:** Accessible via Settings item in the sidebar

### 4. Validation Result Component (`apps/web/src/features/file-manager/components/validation-result.tsx`)
Displays validation results in the preview panel:
- Color-coded border (green for pass, red for fail)
- Status icon (checkmark or alert)
- Message type badge (e.g., pacs.009.001.08)
- Error list with detailed messages
- Warning list (non-critical issues)
- Extracted values section showing Sender/Receiver DN and Full Names

### 5. Preview Panel Integration (`apps/web/src/features/file-manager/components/preview-panel.tsx`)
Automatic validation when previewing XML files:
- Runs when validation is enabled and file is `.xml`
- Detects ISO20022 messages using namespace/message type patterns
- Validates against configured criteria
- Updates when switching between Text/Edit modes
- Shows validation result above file content

## Supported Message Types
The validator recognizes ISO20022 namespaces for:
- `pacs.*` - Payments Clearing and Settlement
- `camt.*` - Cash Management
- `pain.*` - Payment Initiation
- `acmt.*` - Account Management
- `admi.*` - Administration
- `auth.*` - Authorities
- `reda.*` - Reference Data
- `seev.*` - Securities Events
- `semt.*` - Securities Management
- `sese.*` - Securities Settlement
- `setr.*` - Securities Trade

## Usage Flow

1. **Enable Validation**
   - Navigate to Settings page
   - Toggle "Enable automatic validation for ISO20022 files"
   - Configure criteria if different from defaults
   - Click "Save Settings"

2. **View Validation Results**
   - Open File Manager
   - Select an XML file
   - If it's ISO20022 and validation is enabled:
     - Message type badge appears
     - Validation status (pass/fail) is shown
     - Errors/warnings are listed
     - Extracted values are displayed

3. **Validation Triggers**
   - Opening an XML file
   - Switching from Edit mode back to Text mode
   - Changing validation criteria in Settings

## Technical Details

### XML Parsing Strategy
The validator uses text-based pattern matching (not DOM parsing) for performance and simplicity:
- Namespace detection via regex: `/xmlns(?::[^=]+)?="[^"]*iso:?20022/i`
- Message type extraction: `/Document[^>]*>/i`
- Nested tag extraction: Sequential regex matching from parent to child tags

### Storage
Settings are persisted to `localStorage` with key `workspace-organizer-validation-settings`:
```json
{
  "isEnabled": true,
  "criteria": {
    "senderDN": "ou=xxx,o=cenaidja,o=swift",
    "senderFullName": "CENAIDJAXXX",
    "receiverDN": "ou=xxx,o=cenaidja,o=swift",
    "receiverFullName": "CENAIDJAXXX"
  }
}
```

### Error Messages
Validation errors are specific and actionable:
- `"Sender DN not found in message"` - Missing required field
- `"Sender DN mismatch: expected 'X', found 'Y'"` - Value doesn't match criteria
- Similar patterns for Full Name, Receiver DN, and Receiver Full Name

### Performance Considerations
- Validation only runs on `.xml` files
- Skipped for binary files
- Pattern-based detection is fast (no full XML parsing)
- Results are cached until preview content changes

## Future Enhancements
Potential improvements:
- Support for additional ISO20022 message types
- Configurable validation rules (e.g., optional fields)
- Export validation reports
- Batch validation for multiple files
- Integration with automated testing workflows

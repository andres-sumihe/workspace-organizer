# File Merge & Extract System

## Overview
The File Manager includes a powerful merge/extract system designed to overcome Group Policy Object (GPO) restrictions that limit file transfers. This system allows you to:

1. **Merge** multiple files into a single document with special boundary markers
2. **Copy** the merged content to clipboard
3. **Paste** the content on a restricted server
4. **Extract** the original files from the pasted content

## Use Case: GPO Bypass Workflow

### The Problem
Many enterprise servers restrict direct file transfers due to GPO policies. This makes it difficult to move multiple files to restricted environments.

### The Solution
Use the boundary-based merge system to transfer files through the clipboard, bypassing file transfer restrictions.

## Merge Modes

### Simple Mode
Standard concatenation of files with configurable separators.

**Use cases:**
- Combining log files
- Creating documentation compilations
- Basic file concatenation

**Options:**
- Custom separator (default: `\n\n`)
- Include filename headers
- Overwrite protection
- Optional clipboard copy

### Boundary Mode (Recommended for GPO bypass)
Uses PowerShell-compatible boundary markers to preserve file metadata.

**Format:**
```
---FILE-BOUNDARY---|filename.txt|1|
{"Source":"filename.txt","Index":1}
[file content]

---FILE-BOUNDARY---|another.js|2|
{"Source":"another.js","Index":2}
[file content]
```

**Features:**
- Preserves original filenames
- Maintains file order
- Auto-detectable by split logic
- Clipboard-friendly format
- Compatible with PowerShell extraction script

**Auto-enabled options:**
- Clipboard copy (always on)
- Metadata preservation

## Step-by-Step GPO Bypass Guide

### Step 1: Merge Files (Local Machine)

1. Open File Manager in the Workspace Organizer app
2. Navigate to the files you want to transfer
3. Select multiple files using checkboxes
4. Click **"Merge selected"** button
5. In the merge dialog:
   - Select **"Boundary mode"** (recommended)
   - Set destination path (e.g., `transfer/merged-files.txt`)
   - Click **"Merge"**
6. The merged content is automatically copied to your clipboard
7. ✅ Message confirms: "Merged into [path] (content copied to clipboard)"

### Step 2: Transfer to Server

1. Connect to the restricted server (RDP, SSH, etc.)
2. Open a text editor on the server (Notepad, vim, nano, etc.)
3. Paste the clipboard content (`Ctrl+V`)
4. Save the file (e.g., `merged-files.txt`)

### Step 3: Extract Files (Server)

#### Option A: Using Workspace Organizer (if available on server)

1. Open File Manager
2. Click **"Extract from clipboard"** button in toolbar
3. The dialog opens in boundary mode automatically
4. Click **"Extract"**
5. Files are recreated with original names in the current directory

#### Option B: Using PowerShell Script

Use the provided `file-manager-v1.1.ps1` script:

```powershell
# Run the script
.\file-manager-v1.1.ps1

# Choose "Extract Files From Merged File"
# Select "Paste merged content from clipboard"
# Paste the content in the dialog
# Choose output folder
# Click Extract
```

#### Option C: Manual Extraction

1. Navigate to the merged file location
2. Select it in File Manager
3. Click the **Split** button in preview panel
4. The system auto-detects boundary mode
5. Click **"Split"** to extract

## Technical Details

### Boundary Format Specification

**Boundary Marker:**
```
---FILE-BOUNDARY---|{filename}|{index}|
```

- `{filename}`: Original filename with extension
- `{index}`: 1-based sequential index

**Metadata Line (JSON):**
```json
{"Source":"filename.txt","Index":1}
```

**File Content:**
Original file content follows the metadata line, terminated by a blank line before the next boundary.

### Auto-Detection

The split function automatically detects boundary format by checking for the presence of:
```regex
/^---FILE-BOUNDARY---\|(.+?)\|(\d+)\|$/m
```

If detected, boundary mode is activated regardless of user selection.

### Filename Collision Handling

When extracting files:
- If a file with the same name exists and overwrite is disabled
- A numeric suffix is added: `filename.1.txt`, `filename.2.txt`, etc.
- The system increments until a unique name is found

### Encoding

All operations use UTF-8 encoding by default. This ensures:
- Unicode character preservation
- Cross-platform compatibility
- Server-side text editor compatibility

## API Reference

### Merge API

```typescript
window.api.mergeTextFiles({
  rootPath: string,           // Workspace root path
  sources: string[],          // Array of relative file paths
  destination: string,        // Output file relative path
  separator?: string,         // Separator (simple mode only)
  includeHeaders?: boolean,   // Add filename headers (simple mode)
  overwrite?: boolean,        // Allow overwriting destination
  mode?: 'simple' | 'boundary', // Merge mode
  copyToClipboard?: boolean   // Copy result to clipboard
})
```

### Split API

```typescript
window.api.splitTextFile({
  rootPath: string,              // Workspace root path
  source?: string,               // Source file path (file mode)
  clipboardContent?: string,     // Content from clipboard
  separator?: string,            // Separator (simple mode)
  prefix?: string,               // Filename prefix (simple mode)
  extension?: string,            // File extension (simple mode)
  overwrite?: boolean,           // Allow overwriting files
  preserveOriginal?: boolean,    // Keep source file (file mode)
  mode?: 'simple' | 'boundary',  // Split mode (auto-detected)
  outputDir?: string             // Output directory relative path
})
```

## UI Components

### FileManagerToolbar
- **"Merge selected"** button: Opens merge dialog (requires 2+ files selected)
- **"Extract from clipboard"** button: Opens split dialog in clipboard mode

### MergeDialog
- Mode selector: Simple / Boundary
- Destination path input
- Separator textarea (simple mode only)
- Options: Include headers, Allow overwrite, Copy to clipboard

### SplitDialog
- Auto-adapts UI based on source mode (file vs clipboard)
- Shows boundary mode indicator when active
- Hides irrelevant fields in boundary mode
- Dynamic button text: "Split" vs "Extract"

## Troubleshooting

### "Clipboard is empty"
- Ensure content was copied before clicking Extract
- Check clipboard permissions in browser
- Try copying again from the source

### "Failed to read clipboard"
- Grant clipboard permissions when prompted
- Check browser security settings
- Use HTTPS or localhost (required for Clipboard API)

### "Split destination already exists"
- Enable "Allow overwrite" option
- Or manually delete conflicting files first

### Files extracted with wrong content
- Verify boundary markers are intact
- Check for clipboard truncation (some systems limit clipboard size)
- Ensure UTF-8 encoding throughout the process

### Boundary markers not detected
- Check the format matches exactly: `---FILE-BOUNDARY---|name|N|`
- Ensure no extra spaces or characters
- Verify the metadata JSON line follows the boundary

## Best Practices

1. **Test small batches first**: Try merging 2-3 files before large batches
2. **Check clipboard size**: Some systems limit clipboard to ~4MB
3. **Use descriptive names**: Include date/purpose in merged filename
4. **Verify after extraction**: Check file count and spot-check content
5. **Keep originals**: Always preserve original files until extraction is verified

## Limitations

- **Clipboard size**: System-dependent, typically 1-10MB
- **Binary files**: Not supported (text files only)
- **Large files**: Files >10MB may cause performance issues
- **Encoding**: Non-UTF-8 files may lose special characters

## PowerShell Script Integration

The PowerShell script `file-manager-v1.1.ps1` uses the same boundary format, ensuring compatibility:

**Workspace Organizer ↔ PowerShell Script**

You can:
- Merge in Workspace Organizer → Extract with PowerShell
- Merge with PowerShell → Extract in Workspace Organizer
- Mix and match tools as needed

This interoperability provides maximum flexibility in restricted environments.

## Security Considerations

This system is designed to overcome technical limitations, not security policies. Ensure you:

- Have authorization to transfer files to target systems
- Comply with your organization's security policies
- Don't transfer sensitive data through unsecured channels
- Verify file integrity after transfer
- Use approved methods when available

## Future Enhancements

Planned improvements:
- [ ] Compression support for larger file sets
- [ ] Base64 encoding option for binary-safe transfers
- [ ] Progress indicators for large operations
- [ ] Batch extraction from multiple merged files
- [ ] Encryption/decryption for sensitive transfers

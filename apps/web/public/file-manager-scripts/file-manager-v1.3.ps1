# Author: Andres | u073744
# Version: 1.3
# Description: File manager with multi-file transfer support (merge/extract/transfer unified)
# Changes from v1.2:
#   - Unified Transfer feature supporting 1 or more files
#   - Multi-file payload format with boundary markers
#   - Removed separate LAU-specific functions (now generic file transfer)
#   - Simplified menu: Merge → Transfer, Extract remains for boundary-based extraction

# Add Windows Forms assembly for dialogs
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

# Compute SHA256 hash string for byte array
function Get-Sha256String {
    param(
        [byte[]]$Bytes
    )

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($Bytes)
        return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
    }
}

# ============================================================
# MULTI-FILE PAYLOAD FUNCTIONS
# ============================================================

# Create JSON payload for transporting one or more files via clipboard/text
function New-FileTransferPayload {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$FilePaths
    )

    $files = @()
    $totalSize = 0

    foreach ($filePath in $FilePaths) {
        if (-not (Test-Path $filePath)) {
            throw "File not found: $filePath"
        }

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $totalSize += $bytes.Length

        $fileEntry = [ordered]@{
            fileName       = [System.IO.Path]::GetFileName($filePath)
            sizeBytes      = $bytes.Length
            checksumSha256 = Get-Sha256String -Bytes $bytes
            data           = [Convert]::ToBase64String($bytes)
        }

        $files += $fileEntry
    }

    $payload = [ordered]@{
        kind         = 'FILE_TRANSFER_PAYLOAD'
        version      = '1.1'
        metadata     = [ordered]@{
            fileCount    = $files.Count
            totalBytes   = $totalSize
            createdAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        }
        files        = $files
    }

    return [pscustomobject]@{
        PayloadObject = $payload
        Json          = $payload | ConvertTo-Json -Depth 10 -Compress
        FileCount     = $files.Count
        TotalSize     = $totalSize
    }
}

# Parse JSON payload back into object, validating the structure
function Parse-FileTransferPayload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PayloadText
    )

    # Trim whitespace/BOM that might cause parsing issues
    $cleanText = $PayloadText.Trim()

    try {
        $parsed = $cleanText | ConvertFrom-Json
    } catch {
        throw "Payload is not valid JSON. Error: $($_.Exception.Message)"
    }

    # Support both old LAU_PAYLOAD format and new FILE_TRANSFER_PAYLOAD format
    if ($parsed.kind -eq 'LAU_PAYLOAD') {
        # Convert old format to new format for compatibility
        $converted = [ordered]@{
            kind     = 'FILE_TRANSFER_PAYLOAD'
            version  = '1.0'
            metadata = [ordered]@{
                fileCount    = 1
                totalBytes   = $parsed.metadata.sizeBytes
                createdAtUtc = $parsed.metadata.createdAtUtc
            }
            files    = @(
                [ordered]@{
                    fileName       = $parsed.metadata.fileName
                    sizeBytes      = $parsed.metadata.sizeBytes
                    checksumSha256 = $parsed.metadata.checksumSha256
                    data           = $parsed.data
                }
            )
        }
        return [pscustomobject]$converted
    }
    
    if ($parsed.kind -eq 'FILE_PAYLOAD') {
        # Convert FILE_PAYLOAD (single file) to multi-file format
        $converted = [ordered]@{
            kind     = 'FILE_TRANSFER_PAYLOAD'
            version  = '1.0'
            metadata = [ordered]@{
                fileCount    = 1
                totalBytes   = $parsed.metadata.sizeBytes
                createdAtUtc = $parsed.metadata.createdAtUtc
            }
            files    = @(
                [ordered]@{
                    fileName       = $parsed.metadata.fileName
                    sizeBytes      = $parsed.metadata.sizeBytes
                    checksumSha256 = $parsed.metadata.checksumSha256
                    data           = $parsed.data
                }
            )
        }
        return [pscustomobject]$converted
    }

    if (-not $parsed -or $parsed.kind -ne 'FILE_TRANSFER_PAYLOAD' -or -not $parsed.files) {
        throw "Payload is missing FILE_TRANSFER metadata or files array."
    }

    return $parsed
}

# ============================================================
# TRANSFER PACK OPERATION (Pack 1 or more files)
# ============================================================

function Invoke-TransferPack {
    Write-Host "`n=== TRANSFER PACK MODE ===" -ForegroundColor Cyan
    Write-Host "Pack one or more files for clipboard transfer" -ForegroundColor Gray

    $openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
    $openFileDialog.Title = "Select file(s) to pack (hold Ctrl/Shift for multiple)"
    $openFileDialog.Filter = "All files (*.*)|*.*"
    $openFileDialog.Multiselect = $true
    $openFileDialog.InitialDirectory = [Environment]::GetFolderPath("MyDocuments")

    if ($openFileDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host "No files selected." -ForegroundColor Yellow
        return
    }

    $filePaths = $openFileDialog.FileNames
    Write-Host "Selected $($filePaths.Count) file(s) to pack" -ForegroundColor Green

    try {
        $payloadInfo = New-FileTransferPayload -FilePaths $filePaths
    } catch {
        Write-Host "Failed to build payload: $($_.Exception.Message)" -ForegroundColor Red
        [System.Windows.Forms.MessageBox]::Show(
            "Failed to pack files:`n$($_.Exception.Message)",
            "Pack Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        return
    }

    # Generate default filename
    if ($filePaths.Count -eq 1) {
        $defaultName = ([System.IO.Path]::GetFileNameWithoutExtension($filePaths[0])) + '.transfer.txt'
    } else {
        $defaultName = "transfer-$($filePaths.Count)-files.txt"
    }

    $saveFileDialog = New-Object System.Windows.Forms.SaveFileDialog
    $saveFileDialog.Title = "Save transfer payload as"
    $saveFileDialog.Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*"
    $saveFileDialog.DefaultExt = "txt"
    $saveFileDialog.FileName = $defaultName
    $saveFileDialog.InitialDirectory = [System.IO.Path]::GetDirectoryName($filePaths[0])

    if ($saveFileDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $payloadInfo.Json | Set-Content -Path $saveFileDialog.FileName -Encoding UTF8
        Write-Host "Payload saved to: $($saveFileDialog.FileName)" -ForegroundColor Green
    }

    # Copy to clipboard
    try {
        Set-Clipboard -Value $payloadInfo.Json
        Write-Host "Payload copied to clipboard." -ForegroundColor Cyan
    } catch {
        Write-Host "Unable to copy payload to clipboard." -ForegroundColor Yellow
    }

    # Show summary
    $fileList = ($filePaths | ForEach-Object { [System.IO.Path]::GetFileName($_) }) -join "`n  - "
    $sizeKb = [math]::Round($payloadInfo.TotalSize / 1024, 2)
    
    [System.Windows.Forms.MessageBox]::Show(
        "Files packed successfully!`n`nFiles ($($payloadInfo.FileCount)):`n  - $fileList`n`nTotal size: $sizeKb KB`nPayload copied to clipboard.",
        "Transfer Pack Complete",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null

    Write-Host "`nPack complete! $($payloadInfo.FileCount) file(s), $sizeKb KB total" -ForegroundColor Green
}

# ============================================================
# TRANSFER UNPACK OPERATION (Restore files from payload)
# ============================================================

function Invoke-TransferUnpack {
    Write-Host "`n=== TRANSFER UNPACK MODE ===" -ForegroundColor Cyan
    Write-Host "Restore files from transfer payload" -ForegroundColor Gray

    $sourceChoice = [System.Windows.Forms.MessageBox]::Show(
        "Choose payload source:`n`nYES = Paste from clipboard`nNO = Select payload file",
        "Payload Source",
        [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($sourceChoice -eq [System.Windows.Forms.DialogResult]::Cancel) {
        Write-Host "Transfer unpack cancelled." -ForegroundColor Yellow
        return
    }

    $payloadText = $null

    if ($sourceChoice -eq [System.Windows.Forms.DialogResult]::Yes) {
        try {
            $payloadText = Get-Clipboard -Raw
        } catch {
            Write-Host "Clipboard does not contain text payload." -ForegroundColor Red
            return
        }
    } else {
        $openPayloadDialog = New-Object System.Windows.Forms.OpenFileDialog
        $openPayloadDialog.Title = "Select payload text file"
        $openPayloadDialog.Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*"
        $openPayloadDialog.InitialDirectory = [Environment]::GetFolderPath("MyDocuments")

        if ($openPayloadDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
            Write-Host "No payload file selected." -ForegroundColor Yellow
            return
        }

        $payloadText = Get-Content -Path $openPayloadDialog.FileName -Raw
    }

    if (-not $payloadText) {
        Write-Host "Payload content is empty." -ForegroundColor Red
        return
    }

    # Parse payload
    try {
        $payload = Parse-FileTransferPayload -PayloadText $payloadText
    } catch {
        Write-Host "Invalid payload: $($_.Exception.Message)" -ForegroundColor Red
        [System.Windows.Forms.MessageBox]::Show(
            "Invalid payload:`n$($_.Exception.Message)",
            "Parse Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        return
    }

    $fileCount = $payload.files.Count
    Write-Host "Payload contains $fileCount file(s)" -ForegroundColor Cyan

    # Select output folder
    $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
    $folderBrowser.Description = "Select output folder for restored files ($fileCount file(s))"
    $folderBrowser.RootFolder = [Environment+SpecialFolder]::MyComputer
    $folderBrowser.ShowNewFolderButton = $true

    if ($folderBrowser.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host "No destination folder selected." -ForegroundColor Yellow
        return
    }

    $outputFolder = $folderBrowser.SelectedPath
    Write-Host "Output folder: $outputFolder" -ForegroundColor Green

    if (-not (Test-Path $outputFolder)) {
        New-Item -ItemType Directory -Path $outputFolder | Out-Null
    }

    # Restore each file
    $restored = @()
    $warnings = @()

    foreach ($fileEntry in $payload.files) {
        $fileName = $fileEntry.fileName
        $targetPath = Join-Path $outputFolder $fileName

        # Handle file name collision
        if (Test-Path $targetPath) {
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
            $ext = [System.IO.Path]::GetExtension($fileName)
            $i = 1
            while (Test-Path $targetPath) {
                $targetPath = Join-Path $outputFolder "$baseName ($i)$ext"
                $i++
            }
        }

        try {
            $bytes = [Convert]::FromBase64String($fileEntry.data)
        } catch {
            Write-Host "  [ERROR] $fileName - Invalid base64 data" -ForegroundColor Red
            $warnings += "$fileName - Invalid base64 data"
            continue
        }

        # Verify checksum
        $calculatedHash = Get-Sha256String -Bytes $bytes
        $expectedHash = $fileEntry.checksumSha256
        $hashMatches = $calculatedHash -eq $expectedHash

        # Write file
        [System.IO.File]::WriteAllBytes($targetPath, $bytes)

        if (-not $hashMatches) {
            Write-Host "  [WARN] $fileName - Checksum mismatch (file may be corrupted)" -ForegroundColor Yellow
            $warnings += "$fileName - Checksum mismatch"
        } else {
            Write-Host "  [OK] $fileName" -ForegroundColor Green
        }

        $restored += [System.IO.Path]::GetFileName($targetPath)
    }

    # Show summary
    $restoredList = $restored -join "`n  - "
    $message = "Files restored: $($restored.Count) / $fileCount`n`nFiles:`n  - $restoredList"

    if ($warnings.Count -gt 0) {
        $warnList = $warnings -join "`n  - "
        $message += "`n`nWarnings:`n  - $warnList"
        
        [System.Windows.Forms.MessageBox]::Show(
            $message,
            "Transfer Unpack Complete (with warnings)",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            $message,
            "Transfer Unpack Complete",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    }

    Write-Host "`nUnpack complete! $($restored.Count) file(s) restored" -ForegroundColor Green
}

# ============================================================
# TRANSFER HELPER (Menu for Pack/Unpack)
# ============================================================

function Invoke-TransferHelper {
    Write-Host "`n=== FILE TRANSFER ===" -ForegroundColor Cyan
    $prompt = "Choose transfer operation:`n`nYES = Pack file(s) for transfer`nNO = Unpack files from payload"
    $modeChoice = [System.Windows.Forms.MessageBox]::Show(
        $prompt,
        "File Transfer",
        [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($modeChoice -eq [System.Windows.Forms.DialogResult]::Cancel) {
        Write-Host "Transfer cancelled." -ForegroundColor Yellow
        return
    }

    if ($modeChoice -eq [System.Windows.Forms.DialogResult]::Yes) {
        Invoke-TransferPack
    } else {
        Invoke-TransferUnpack
    }
}

# ============================================================
# LEGACY EXTRACT OPERATION (For boundary-formatted merged files)
# ============================================================

function Invoke-LegacyExtract {
    Write-Host "`n=== EXTRACT MODE (Legacy Boundary Format) ===" -ForegroundColor Cyan
    
    $sourceChoice = [System.Windows.Forms.MessageBox]::Show(
        "Choose extraction source:`n`nYES = Paste merged content from clipboard`nNO = Select merged file from disk",
        "Extract Source",
        [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    
    if ($sourceChoice -eq [System.Windows.Forms.DialogResult]::Cancel) {
        Write-Host "Operation cancelled." -ForegroundColor Yellow
        return
    }
    
    $mergedContent = $null
    
    if ($sourceChoice -eq [System.Windows.Forms.DialogResult]::Yes) {
        Write-Host "Paste mode selected" -ForegroundColor Cyan
        
        $pasteForm = New-Object System.Windows.Forms.Form
        $pasteForm.Text = "Paste Merged Content"
        $pasteForm.Size = New-Object System.Drawing.Size(700, 500)
        $pasteForm.StartPosition = "CenterScreen"
        
        $pasteLabel = New-Object System.Windows.Forms.Label
        $pasteLabel.Location = New-Object System.Drawing.Point(10, 10)
        $pasteLabel.Size = New-Object System.Drawing.Size(660, 20)
        $pasteLabel.Text = "Paste the merged content below (Ctrl+V):"
        $pasteForm.Controls.Add($pasteLabel)
        
        $textBox = New-Object System.Windows.Forms.TextBox
        $textBox.Location = New-Object System.Drawing.Point(10, 35)
        $textBox.Size = New-Object System.Drawing.Size(660, 370)
        $textBox.Multiline = $true
        $textBox.ScrollBars = "Both"
        $textBox.WordWrap = $false
        $textBox.Font = New-Object System.Drawing.Font("Consolas", 9)
        
        try {
            $clipboardText = Get-Clipboard -Raw
            if ($clipboardText -match "---FILE-BOUNDARY---") {
                $textBox.Text = $clipboardText
                Write-Host "Auto-filled from clipboard" -ForegroundColor Green
            }
        } catch { }
        
        $pasteForm.Controls.Add($textBox)
        
        $okButton = New-Object System.Windows.Forms.Button
        $okButton.Location = New-Object System.Drawing.Point(480, 415)
        $okButton.Size = New-Object System.Drawing.Size(90, 30)
        $okButton.Text = "Extract"
        $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $pasteForm.Controls.Add($okButton)
        
        $cancelButton = New-Object System.Windows.Forms.Button
        $cancelButton.Location = New-Object System.Drawing.Point(580, 415)
        $cancelButton.Size = New-Object System.Drawing.Size(90, 30)
        $cancelButton.Text = "Cancel"
        $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $pasteForm.Controls.Add($cancelButton)
        
        $pasteForm.AcceptButton = $okButton
        $pasteForm.CancelButton = $cancelButton
        
        $result = $pasteForm.ShowDialog()
        
        if ($result -ne [System.Windows.Forms.DialogResult]::OK -or [string]::IsNullOrWhiteSpace($textBox.Text)) {
            Write-Host "No content provided." -ForegroundColor Red
            return
        }
        
        $mergedContent = $textBox.Text
        Write-Host "Content received from paste" -ForegroundColor Green
    }
    else {
        Write-Host "File selection mode" -ForegroundColor Cyan
        
        $openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
        $openFileDialog.Title = "Select merged file to extract"
        $openFileDialog.Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*"
        $openFileDialog.InitialDirectory = [Environment]::GetFolderPath("MyDocuments")
        
        if ($openFileDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
            Write-Host "No file selected." -ForegroundColor Red
            return
        }
        $mergedFile = $openFileDialog.FileName
        Write-Host "Merged file: $mergedFile" -ForegroundColor Green
        
        $mergedContent = Get-Content -Path $mergedFile -Raw
    }
    
    $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
    $folderBrowser.Description = "Select output folder for extracted files"
    $folderBrowser.RootFolder = [Environment+SpecialFolder]::MyComputer
    $folderBrowser.ShowNewFolderButton = $true
    
    if ($folderBrowser.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host "No folder selected." -ForegroundColor Red
        return
    }
    $outputFolder = $folderBrowser.SelectedPath
    Write-Host "Output folder: $outputFolder" -ForegroundColor Green
    
    if (-not (Test-Path $outputFolder)) {
        New-Item -ItemType Directory -Path $outputFolder | Out-Null
    }
    
    $boundaryPrefix = "---FILE-BOUNDARY---|"
    $writer = $null
    $fileCount = 0
    
    $mergedContent -split "`r?`n" | ForEach-Object {
        $line = $_
        if ($line.StartsWith($boundaryPrefix)) {
            if ($writer) { $writer.Close(); $writer = $null }
            
            $parts = $line.Split("|")
            $filename = $parts[1]
            $target = Join-Path $outputFolder $filename
            
            if (Test-Path $target) {
                $i = 1
                while (Test-Path ("{0}.{1}" -f $target, $i)) { $i++ }
                $target = "{0}.{1}" -f $target, $i
            }
            
            $writer = [System.IO.File]::CreateText($target)
            $fileCount++
            Write-Host "  Extracting: $filename" -ForegroundColor Gray
        }
        elseif ($line -match '^\{.*\}$' -and $writer -ne $null) {
            # Skip metadata line
        }
        else {
            if ($writer) { $writer.WriteLine($line) }
        }
    }
    
    if ($writer) { $writer.Close() }
    
    Write-Host "`nExtraction complete! Files extracted: $fileCount" -ForegroundColor Green
    
    [System.Windows.Forms.MessageBox]::Show(
        "Extraction complete!`n`nFiles extracted: $fileCount`nOutput folder: $outputFolder",
        "Extract Complete",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}

# ============================================================
# MAIN MENU
# ============================================================

$form = New-Object System.Windows.Forms.Form
$form.Text = "File Manager v1.3"
$form.Size = New-Object System.Drawing.Size(420, 220)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$label = New-Object System.Windows.Forms.Label
$label.Location = New-Object System.Drawing.Point(20, 20)
$label.Size = New-Object System.Drawing.Size(380, 30)
$label.Text = "Choose an operation:"
$label.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($label)

# Transfer button (primary - handles both single and multiple files)
$transferButton = New-Object System.Windows.Forms.Button
$transferButton.Location = New-Object System.Drawing.Point(85, 60)
$transferButton.Size = New-Object System.Drawing.Size(250, 45)
$transferButton.Text = "Transfer Files (Pack/Unpack)"
$transferButton.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$transferButton.DialogResult = [System.Windows.Forms.DialogResult]::Yes
$form.Controls.Add($transferButton)

# Legacy extract button (for boundary-formatted files)
$extractButton = New-Object System.Windows.Forms.Button
$extractButton.Location = New-Object System.Drawing.Point(85, 115)
$extractButton.Size = New-Object System.Drawing.Size(250, 45)
$extractButton.Text = "Extract (Legacy Boundary Format)"
$extractButton.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$extractButton.ForeColor = [System.Drawing.Color]::Gray
$extractButton.DialogResult = [System.Windows.Forms.DialogResult]::No
$form.Controls.Add($extractButton)

$form.AcceptButton = $transferButton

$choice = $form.ShowDialog()

if ($choice -eq [System.Windows.Forms.DialogResult]::Cancel) {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit
}

if ($choice -eq [System.Windows.Forms.DialogResult]::Yes) {
    Invoke-TransferHelper
}
elseif ($choice -eq [System.Windows.Forms.DialogResult]::No) {
    Invoke-LegacyExtract
}

Write-Host "`nDone!" -ForegroundColor Cyan

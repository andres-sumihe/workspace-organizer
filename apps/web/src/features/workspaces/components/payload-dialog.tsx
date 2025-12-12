import { AlertCircle, Download, FileUp, Package } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePayloadTransfer } from '../hooks/use-payload-transfer';

interface PayloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected files from directory browser (optional) */
  selectedFiles?: { name: string; path: string }[];
  /** Callback to read file content by path */
  onReadFile?: (path: string) => Promise<ArrayBuffer>;
}

export const PayloadDialog = ({ open, onOpenChange, selectedFiles = [], onReadFile }: PayloadDialogProps) => {
  const [mode, setMode] = useState<'pack' | 'unpack'>('pack');
  const [unpackSource, setUnpackSource] = useState<'clipboard' | 'file'>('clipboard');
  const { isLoading, error, packFiles, unpackFromClipboard, unpackFromFile } = usePayloadTransfer();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pack from file input (browser file picker)
  const handlePack = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setSuccessMessage(null);
      try {
        const { json, payload } = await packFiles(Array.from(files));

        // Copy to clipboard
        await navigator.clipboard.writeText(json);
        
        const fileCount = payload.metadata.fileCount;
        const totalKb = (payload.metadata.totalBytes / 1024).toFixed(2);
        setSuccessMessage(
          `✓ Packed ${fileCount} file(s) (${totalKb} KB total) and copied to clipboard`
        );

        // Reset file input
        e.target.value = '';
      } catch {
        // Error is handled by the hook
      }
    },
    [packFiles]
  );

  // Pack pre-selected files from directory browser
  const handlePackSelected = useCallback(async () => {
    if (selectedFiles.length === 0 || !onReadFile) return;

    setSuccessMessage(null);
    try {
      // Read each file's content from API
      const files: File[] = [];
      for (const { name, path } of selectedFiles) {
        const buffer = await onReadFile(path);
        const file = new File([buffer], name, { type: 'application/octet-stream' });
        files.push(file);
      }

      const { json, payload } = await packFiles(files);

      // Copy to clipboard
      await navigator.clipboard.writeText(json);
      
      const fileCount = payload.metadata.fileCount;
      const totalKb = (payload.metadata.totalBytes / 1024).toFixed(2);
      setSuccessMessage(
        `✓ Packed ${fileCount} file(s) (${totalKb} KB total) and copied to clipboard`
      );
    } catch {
      // Error is handled by the hook
    }
  }, [selectedFiles, onReadFile, packFiles]);

  const handleUnpackFromClipboard = useCallback(async () => {
    setSuccessMessage(null);
    try {
      const extractedFiles = await unpackFromClipboard();

      // Download each file
      const warnings: string[] = [];
      for (const { file, hashMatches, fileName } of extractedFiles) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (!hashMatches) {
          warnings.push(fileName);
        }
      }

      let message = `✓ Unpacked ${extractedFiles.length} file(s) and downloaded`;
      if (warnings.length > 0) {
        message += ` (⚠ checksum mismatch: ${warnings.join(', ')})`;
      }
      setSuccessMessage(message);
    } catch {
      // Error is handled by the hook
    }
  }, [unpackFromClipboard]);

  const handleUnpackFromFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setSuccessMessage(null);
      try {
        const extractedFiles = await unpackFromFile(file);

        // Download each file
        const warnings: string[] = [];
        for (const { file: unpackedFile, hashMatches, fileName } of extractedFiles) {
          const url = URL.createObjectURL(unpackedFile);
          const a = document.createElement('a');
          a.href = url;
          a.download = unpackedFile.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          if (!hashMatches) {
            warnings.push(fileName);
          }
        }

        let message = `✓ Unpacked ${extractedFiles.length} file(s) and downloaded`;
        if (warnings.length > 0) {
          message += ` (⚠ checksum mismatch: ${warnings.join(', ')})`;
        }
        setSuccessMessage(message);

        // Reset file input
        e.target.value = '';
      } catch {
        // Error is handled by the hook
      }
    },
    [unpackFromFile]
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSuccessMessage(null);
    }
    onOpenChange(newOpen);
  };

  const hasPreselectedFiles = selectedFiles.length > 0 && onReadFile;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4" />
            File Transfer
          </DialogTitle>
          <DialogDescription>
            Pack/unpack files for clipboard transfer (binary-safe via Base64)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selection */}
          <div>
            <Label className="text-base font-medium">Operation</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'pack' | 'unpack')}>
              <div className="flex items-center gap-2 mt-2">
                <RadioGroupItem value="pack" id="mode-pack" />
                <Label htmlFor="mode-pack" className="font-normal cursor-pointer flex items-center gap-2">
                  <FileUp className="size-3.5" />
                  Pack file(s) for transfer
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="unpack" id="mode-unpack" />
                <Label htmlFor="mode-unpack" className="font-normal cursor-pointer flex items-center gap-2">
                  <Download className="size-3.5" />
                  Unpack file(s) from payload
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Pack mode */}
          {mode === 'pack' && (
            <div className="space-y-3">
              {/* Option 1: Pack pre-selected files */}
              {hasPreselectedFiles && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                  <p className="text-sm text-blue-900 font-medium">
                    Selected files ({selectedFiles.length}):
                  </p>
                  <ul className="text-xs text-blue-800 list-disc list-inside max-h-24 overflow-auto">
                    {selectedFiles.map(({ name, path }) => (
                      <li key={path} title={path}>{name}</li>
                    ))}
                  </ul>
                  <Button
                    onClick={handlePackSelected}
                    disabled={isLoading}
                    className="w-full"
                    size="sm"
                  >
                    <Package className="mr-2 size-4" />
                    Pack Selected Files
                  </Button>
                </div>
              )}

              {/* Option 2: Pick files from disk */}
              <div>
                <Label htmlFor="pack-file" className="text-sm">
                  {hasPreselectedFiles ? 'Or select file(s) from disk' : 'Select file(s) to pack'}
                </Label>
                <Input
                  id="pack-file"
                  type="file"
                  multiple
                  onChange={handlePack}
                  disabled={isLoading}
                  className="mt-1"
                />
              </div>

              <div className="bg-muted/50 border rounded p-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>How it works:</strong> Files are encoded as Base64 with SHA256 checksums and
                  automatically copied to clipboard as JSON. Perfect for bypassing file transfer restrictions!
                </p>
              </div>
            </div>
          )}

          {/* Unpack mode */}
          {mode === 'unpack' && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Source</Label>
                <RadioGroup
                  value={unpackSource}
                  onValueChange={(value) => setUnpackSource(value as 'clipboard' | 'file')}
                  className="mt-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="clipboard" id="source-clipboard" />
                    <Label htmlFor="source-clipboard" className="font-normal cursor-pointer">
                      From clipboard
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="file" id="source-file" />
                    <Label htmlFor="source-file" className="font-normal cursor-pointer">
                      From .txt file
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {unpackSource === 'clipboard' ? (
                <Button onClick={handleUnpackFromClipboard} disabled={isLoading} className="w-full">
                  <Download className="mr-2 size-4" />
                  Unpack from Clipboard & Download
                </Button>
              ) : (
                <div>
                  <Label htmlFor="unpack-file" className="text-sm">
                    Select payload file
                  </Label>
                  <Input
                    id="unpack-file"
                    type="file"
                    accept=".txt"
                    onChange={handleUnpackFromFile}
                    disabled={isLoading}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* Error alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success message */}
          {successMessage && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

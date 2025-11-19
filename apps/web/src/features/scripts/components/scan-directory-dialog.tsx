import { FolderSearch, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ScanDirectoryFormValues {
  directoryPath: string;
  recursive: boolean;
  filePattern: string;
  replaceExisting: boolean;
}

interface ScanDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (values: ScanDirectoryFormValues) => Promise<{ count: number }>;
  canSelectFolder: boolean;
}

export const ScanDirectoryDialog = ({ open, onOpenChange, onScan, canSelectFolder }: ScanDirectoryDialogProps) => {
  const [scanning, setScanning] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ count: number } | null>(null);

  const form = useForm<ScanDirectoryFormValues>({
    defaultValues: {
      directoryPath: '',
      recursive: true,
      filePattern: '*.bat',
      replaceExisting: false
    }
  });

  const handleSelectFolder = async () => {
    if (!canSelectFolder || !window.api?.selectDirectory) {
      setError('Folder selection requires desktop mode');
      return;
    }

    setSelectingFolder(true);
    try {
      const result = await window.api.selectDirectory();
      if (!result.canceled && result.path) {
        form.setValue('directoryPath', result.path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select folder');
    } finally {
      setSelectingFolder(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!values.directoryPath.trim()) {
      setError('Directory path is required');
      return;
    }

    setScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const result = await onScan(values);
      setScanResult(result);
      setTimeout(() => {
        onOpenChange(false);
        form.reset();
        setScanResult(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!scanning) {
      onOpenChange(newOpen);
      if (!newOpen) {
        form.reset();
        setError(null);
        setScanResult(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSearch className="h-5 w-5" />
            Scan Directory for Scripts
          </DialogTitle>
          <DialogDescription>
            Scan a directory to discover and import batch scripts into the database
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="directoryPath">Directory Path</Label>
            <div className="flex gap-2">
              <Input
                id="directoryPath"
                placeholder="C:\Scripts\..."
                {...form.register('directoryPath')}
                disabled={scanning}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFolder}
                disabled={!canSelectFolder || selectingFolder || scanning}
              >
                {selectingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Browse'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filePattern">File Pattern</Label>
            <Input
              id="filePattern"
              placeholder="*.bat, *.cmd"
              {...form.register('filePattern')}
              disabled={scanning}
            />
            <p className="text-xs text-muted-foreground">Glob pattern for script files (e.g., *.bat, *.cmd)</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recursive"
                checked={form.watch('recursive')}
                onCheckedChange={(checked) => form.setValue('recursive', !!checked)}
                disabled={scanning}
              />
              <Label htmlFor="recursive" className="text-sm font-normal cursor-pointer">
                Scan subdirectories recursively
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="replaceExisting"
                checked={form.watch('replaceExisting')}
                onCheckedChange={(checked) => form.setValue('replaceExisting', !!checked)}
                disabled={scanning}
              />
              <Label htmlFor="replaceExisting" className="text-sm font-normal cursor-pointer">
                Replace existing scripts with same file path
              </Label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {scanResult && <p className="text-sm text-green-600">✓ Scan completed! Found {scanResult.count} scripts</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={scanning}>
              Cancel
            </Button>
            <Button type="submit" disabled={scanning}>
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                'Start Scan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { Upload, AlertCircle, CheckCircle, Loader2, FileText } from 'lucide-react';
import React, { useRef, useState } from 'react';

import type { ControlMImportResult } from '@workspace/shared';

import { importJobs } from '@/api/controlm-jobs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface JobImportDialogProps {
  onImportComplete?: () => void;
}

export const JobImportDialog = ({ onImportComplete }: JobImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ControlMImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // Read file content
      const csvContent = await file.text();

      // Import jobs
      const importResult = await importJobs(csvContent, replaceExisting);

      setResult(importResult);

      if (importResult.importedCount > 0) {
        onImportComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Upload className="h-4 w-4 mr-2" />
          Import Jobs
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Control-M Jobs</DialogTitle>
          <DialogDescription>
            Upload a Control-M export CSV file to import job definitions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop CSV file here or click to browse
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="replace-existing"
                checked={replaceExisting}
                onCheckedChange={(checked) => setReplaceExisting(checked === true)}
              />
              <Label htmlFor="replace-existing" className="text-sm text-destructive">
                Replace existing jobs (clear all before import)
              </Label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <Alert variant={result.errors.length > 0 ? 'default' : 'default'}>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">
                      Imported {result.importedCount} jobs
                      {result.updatedCount > 0 && `, updated ${result.updatedCount}`}
                      {result.skippedCount > 0 && `, skipped ${result.skippedCount}`}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Error details */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-destructive">
                    {result.errors.length} error{result.errors.length > 1 ? 's' : ''} occurred:
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded border bg-muted/50 p-2">
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {result.errors.map((err, idx) => (
                        <li key={idx} className="flex gap-2">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-destructive" />
                          <span>{err}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { Save, SplitSquareHorizontal } from 'lucide-react';

import { toHex } from '../utils';

import type { PreviewMode } from '../types';
import type { WorkspaceFilePreview } from '@/types/desktop';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PreviewPanelProps {
  preview: WorkspaceFilePreview | null;
  previewError: string | null;
  previewMode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  editBuffer: string;
  onEditBufferChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  binaryPreview: boolean;
  desktopAvailable: boolean;
  onOpenSplitDialog: () => void;
}

export const PreviewPanel = ({
  preview,
  previewError,
  previewMode,
  onModeChange,
  editMode,
  onToggleEditMode,
  editBuffer,
  onEditBufferChange,
  onSave,
  saving,
  binaryPreview,
  desktopAvailable,
  onOpenSplitDialog
}: PreviewPanelProps) => {
  const disablePreviewButtons = !preview || binaryPreview;

  return (
    <div className="rounded-lg border border-border p-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Preview</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={previewMode === 'text' ? 'bg-muted' : ''}
            disabled={disablePreviewButtons}
            onClick={() => onModeChange('text')}
          >
            Text
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={previewMode === 'hex' ? 'bg-muted' : ''}
            disabled={disablePreviewButtons}
            onClick={() => onModeChange('hex')}
          >
            Hex
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={editMode ? 'bg-muted' : ''}
            disabled={disablePreviewButtons}
            onClick={onToggleEditMode}
          >
            {editMode ? 'Editing' : 'Edit'}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Validate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={onSave}
            disabled={!editMode || !preview || saving || binaryPreview}
          >
            <Save className="size-4" />
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={onOpenSplitDialog}
            disabled={!desktopAvailable || !preview?.path}
          >
            <SplitSquareHorizontal className="size-4" />
            Split file
          </Button>
        </div>
      </div>
      <div className="mt-3">
        {previewError ? (
          <p className="text-sm text-destructive">{previewError}</p>
        ) : preview ? (
          <div className="space-y-2 text-sm overflow-hidden">
            <p className="font-mono text-xs text-muted-foreground break-all">{preview.path}</p>
            <div className="rounded-md border border-border bg-muted/40 w-full max-w-full max-h-[60vh] overflow-auto">
              {binaryPreview ? (
                <p className="text-xs text-muted-foreground p-3">
                  Binary file preview is unavailable. Download or open the file with an external editor.
                </p>
              ) : editMode ? (
                <Textarea
                  value={editBuffer}
                  onChange={(event) => onEditBufferChange(event.target.value)}
                  rows={10}
                  className="h-full min-h-[200px] text-xs font-mono"
                />
              ) : (
                <pre className="whitespace-pre text-xs text-foreground min-w-max p-3">
                  {previewMode === 'hex' ? toHex(preview.content) : preview.content}
                </pre>
              )}
            </div>
            {preview.truncated ? <p className="text-xs text-muted-foreground">Preview truncated to 512KB.</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a file to see its contents.</p>
        )}
      </div>
    </div>
  );
};

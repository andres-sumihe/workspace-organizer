import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { Save, SplitSquareHorizontal } from 'lucide-react';
import { useMemo } from 'react';

import { toHex } from '../utils';

import type { PreviewMode } from '../types';
import type { WorkspaceFilePreview } from '@/types/desktop';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const getLanguageExtension = (filePath: string) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: ext.startsWith('ts') });
    case 'json':
      return json();
    case 'xml':
      return xml();
    case 'html':
    case 'htm':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'py':
      return python();
    case 'sql':
      return sql();
    default:
      return undefined;
  }
};

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
  
  const languageExtension = useMemo(
    () => (preview?.path ? getLanguageExtension(preview.path) : undefined),
    [preview?.path]
  );
  
  const extensions = useMemo(() => {
    const exts = [];
    if (languageExtension) exts.push(languageExtension);
    return exts;
  }, [languageExtension]);

  return (
    <div className="rounded-lg border border-border overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">File Preview</span>
          <Tabs value={editMode ? 'edit' : previewMode} onValueChange={(v) => {
            if (v === 'edit') {
              if (!editMode) onToggleEditMode();
            } else {
              if (editMode) onToggleEditMode();
              onModeChange(v as PreviewMode);
            }
          }}>
            <TabsList className="h-7">
              <TabsTrigger value="text" className="text-xs h-6 px-2" disabled={disablePreviewButtons}>
                Text
              </TabsTrigger>
              <TabsTrigger value="hex" className="text-xs h-6 px-2" disabled={disablePreviewButtons}>
                Hex
              </TabsTrigger>
              <TabsTrigger value="edit" className="text-xs h-6 px-2" disabled={disablePreviewButtons}>
                Edit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onSave}
            disabled={!editMode || !preview || saving || binaryPreview}
          >
            <Save className="size-3 mr-1" />
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onOpenSplitDialog}
            disabled={!desktopAvailable || !preview?.path}
          >
            <SplitSquareHorizontal className="size-3 mr-1" />
            Split
          </Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {previewError ? (
          <div className="p-4">
            <p className="text-sm text-destructive">{previewError}</p>
          </div>
        ) : preview ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-1 bg-muted/20 border-b border-border">
              <p className="font-mono text-xs text-muted-foreground truncate">{preview.path}</p>
            </div>
            <div className="flex-1 overflow-hidden">
              {binaryPreview ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    Binary file preview is unavailable. Download or open the file with an external editor.
                  </p>
                </div>
              ) : editMode ? (
                <CodeMirror
                  value={editBuffer}
                  height="500px"
                  extensions={extensions}
                  onChange={onEditBufferChange}
                  theme="light"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true
                  }}
                />
              ) : previewMode === 'hex' ? (
                <div className="h-[500px] overflow-auto">
                  <pre className="whitespace-pre text-xs text-foreground font-mono p-3">
                    {toHex(preview.content)}
                  </pre>
                </div>
              ) : (
                <CodeMirror
                  value={preview.content}
                  height="500px"
                  extensions={extensions}
                  editable={false}
                  theme="light"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: false,
                    highlightSpecialChars: true,
                    foldGutter: true,
                    highlightActiveLine: false
                  }}
                />
              )}
            </div>
            {preview.truncated && (
              <div className="px-3 py-1 bg-amber-50 border-t border-amber-200">
                <p className="text-xs text-amber-800">Preview truncated to 512KB</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a file to see its contents</p>
          </div>
        )}
      </div>
    </div>
  );
};

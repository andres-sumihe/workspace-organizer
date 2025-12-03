import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { highlightSelectionMatches } from '@codemirror/search';
import { EditorSelection } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { Save, Search, SplitSquareHorizontal, X, ChevronDown, ChevronUp, Image, Film, Music, FileText } from 'lucide-react';
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';

import { toHex, type MediaType } from '../utils';
import { ValidationResult, type ValidationResultData } from './validation-result';

import type { PreviewMode } from '../types';
import type { WorkspaceFilePreview, WorkspaceMediaPreview } from '@/types/desktop';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useValidationSettings } from '@/contexts/validation-settings-context';
import { detectISO20022, validateISO20022 } from '@/utils/iso20022-validator';
import { detectSwiftMT, validateSwiftMT } from '@/utils/swift-mt-validator';

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
  mediaPreview?: WorkspaceMediaPreview | null;
  mediaType?: MediaType;
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
  onOpenSplitDialog,
  mediaPreview,
  mediaType
}: PreviewPanelProps) => {
  const { theme } = useTheme();
  const {
    isEnabled: validationEnabled,
    criteria,
    isMTEnabled,
    mtCriteria
  } = useValidationSettings();
  const disablePreviewButtons = !preview || binaryPreview;
  const [validationResult, setValidationResult] = useState<ValidationResultData | null>(null);
  
  const languageExtension = useMemo(
    () => (preview?.path ? getLanguageExtension(preview.path) : undefined),
    [preview?.path]
  );
  
  const editorViewRef = useRef<EditorView | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const extensions = useMemo(() => {
    const exts = [highlightSelectionMatches()];
    if (languageExtension) exts.push(languageExtension);
    return exts;
  }, [languageExtension]);

  const matchesRef = useRef<number[]>([]);

  const performSearch = useCallback(() => {
    if (!searchQuery || !editorViewRef.current) {
      setTotalMatches(0);
      setCurrentMatch(0);
      matchesRef.current = [];
      return;
    }

    const view = editorViewRef.current;
    const text = view.state.doc.toString();
    const searchText = caseSensitive ? text : text.toLowerCase();
    const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    
    const matches: number[] = [];
    let index = 0;
    while ((index = searchText.indexOf(query, index)) !== -1) {
      matches.push(index);
      index += query.length;
    }
    
    matchesRef.current = matches;
    setTotalMatches(matches.length);
    
    if (matches.length > 0) {
      setCurrentMatch(0);
      const pos = matches[0];
      view.dispatch({
        selection: EditorSelection.create([EditorSelection.range(pos, pos + searchQuery.length)]),
        scrollIntoView: true
      });
    } else {
      setCurrentMatch(0);
    }
  }, [searchQuery, caseSensitive])

  useEffect(() => {
    performSearch();
  }, [searchQuery, caseSensitive, performSearch]);

  const handleNext = () => {
    if (matchesRef.current.length === 0 || !editorViewRef.current) return;
    const next = (currentMatch + 1) % matchesRef.current.length;
    setCurrentMatch(next);
    const pos = matchesRef.current[next];
    editorViewRef.current.dispatch({
      selection: EditorSelection.create([EditorSelection.range(pos, pos + searchQuery.length)]),
      scrollIntoView: true
    });
  };

  const handlePrevious = () => {
    if (matchesRef.current.length === 0 || !editorViewRef.current) return;
    const prev = currentMatch === 0 ? matchesRef.current.length - 1 : currentMatch - 1;
    setCurrentMatch(prev);
    const pos = matchesRef.current[prev];
    editorViewRef.current.dispatch({
      selection: EditorSelection.create([EditorSelection.range(pos, pos + searchQuery.length)]),
      scrollIntoView: true
    });
  };

  const handleSearchToggle = () => {
    setSearchOpen(!searchOpen);
    if (!searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      setSearchQuery('');
      setCurrentMatch(0);
      setTotalMatches(0);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && preview && !binaryPreview && previewMode !== 'hex') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (searchOpen && e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, binaryPreview, previewMode, searchOpen]);

  const editorTheme = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    // For 'system', check the actual applied theme
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }, [theme]);

  // Run validation when preview changes and validation is enabled
  useEffect(() => {
    if (!preview || binaryPreview) {
      setValidationResult(null);
      return;
    }

    const content = editMode ? editBuffer : preview.content;
    const isXmlFile = preview.path.toLowerCase().endsWith('.xml');

    // First, check ISO20022 (MX) validation for XML files
    if (validationEnabled && isXmlFile) {
      const detection = detectISO20022(content);
      if (detection.isISO20022) {
        const result = validateISO20022(content, criteria);
        setValidationResult({ ...result, type: 'iso20022' });
        return;
      }
    }

    // SWIFT MT validation only runs when enabled in settings
    if (isMTEnabled) {
      const mtDetection = detectSwiftMT(content);
      if (mtDetection.isSwiftMT) {
        const result = validateSwiftMT(content, mtCriteria);
        setValidationResult({ ...result, type: 'swift-mt' });
        return;
      }
    }

    // No validation matched
    setValidationResult(null);
  }, [validationEnabled, preview, binaryPreview, editMode, editBuffer, criteria, isMTEnabled, mtCriteria]);

  return (
    <div className="rounded-lg border border-border overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">File Preview</span>
          {mediaType ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {mediaType === 'image' && <Image className="size-3" />}
              {mediaType === 'video' && <Film className="size-3" />}
              {mediaType === 'audio' && <Music className="size-3" />}
              {mediaType === 'pdf' && <FileText className="size-3" />}
              <span className="capitalize">{mediaType}</span>
            </div>
          ) : (
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
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleSearchToggle}
            disabled={disablePreviewButtons || previewMode === 'hex'}
            title="Search (Ctrl+F)"
          >
            <Search className="size-3" />
          </Button>
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
        ) : mediaPreview && mediaType ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-1 bg-muted/20 border-b border-border flex items-center justify-between gap-2">
              <p className="font-mono text-xs text-muted-foreground truncate">{mediaPreview.path}</p>
              <span className="text-xs text-muted-foreground">{(mediaPreview.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/10">
              {mediaType === 'image' && (
                <img
                  src={`data:${mediaPreview.mimeType};base64,${mediaPreview.base64}`}
                  alt={mediaPreview.path}
                  className="max-w-full max-h-[500px] object-contain rounded shadow-md"
                />
              )}
              {mediaType === 'video' && (
                <video
                  src={`data:${mediaPreview.mimeType};base64,${mediaPreview.base64}`}
                  controls
                  className="max-w-full max-h-[500px] rounded shadow-md"
                >
                  Your browser does not support the video tag.
                </video>
              )}
              {mediaType === 'audio' && (
                <div className="flex flex-col items-center gap-4">
                  <Music className="size-16 text-muted-foreground" />
                  <audio
                    src={`data:${mediaPreview.mimeType};base64,${mediaPreview.base64}`}
                    controls
                    className="w-full max-w-md"
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              )}
              {mediaType === 'pdf' && (
                <iframe
                  src={`data:${mediaPreview.mimeType};base64,${mediaPreview.base64}`}
                  className="w-full h-[500px] rounded shadow-md"
                  title={mediaPreview.path}
                />
              )}
            </div>
          </div>
        ) : preview ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-1 bg-muted/20 border-b border-border flex items-center justify-between gap-2">
              <p className="font-mono text-xs text-muted-foreground truncate">{preview.path}</p>
              {validationResult && (
                <div className="relative shrink-0">
                  <ValidationResult result={validationResult} />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {binaryPreview ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    Binary file preview is unavailable. Download or open the file with an external editor.
                  </p>
                </div>
              ) : editMode ? (
                <div className="relative h-[500px]">
                  {searchOpen && (
                    <div className="absolute top-2 right-2 z-10 bg-background border border-border rounded-md shadow-lg p-2 flex items-center gap-1">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Find"
                        className="w-48 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.shiftKey ? handlePrevious() : handleNext();
                          }
                        }}
                      />
                      <span className="text-xs text-muted-foreground px-1">
                        {totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : 'No results'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handlePrevious}
                        disabled={totalMatches === 0}
                      >
                        <ChevronUp className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleNext}
                        disabled={totalMatches === 0}
                      >
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${caseSensitive ? 'bg-primary/20 hover:bg-primary/30' : ''}`}
                        onClick={() => setCaseSensitive(!caseSensitive)}
                        title="Match Case"
                      >
                        <span className={`text-xs font-semibold ${caseSensitive ? 'text-primary' : 'text-muted-foreground'}`}>Aa</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleSearchToggle}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}
                  <CodeMirror
                    value={editBuffer}
                    height="500px"
                    extensions={extensions}
                    onChange={onEditBufferChange}
                    theme={editorTheme}
                    onCreateEditor={(view) => {
                      editorViewRef.current = view;
                    }}
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
                </div>
              ) : previewMode === 'hex' ? (
                <div className="h-[500px] overflow-auto">
                  <pre className="whitespace-pre text-xs text-foreground font-mono p-3">
                    {toHex(preview.content)}
                  </pre>
                </div>
              ) : (
                <div className="relative h-[500px]">
                  {searchOpen && (
                    <div className="absolute top-2 right-2 z-10 bg-background border border-border rounded-md shadow-lg p-2 flex items-center gap-1">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Find"
                        className="w-48 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.shiftKey ? handlePrevious() : handleNext();
                          }
                        }}
                      />
                      <span className="text-xs text-muted-foreground px-1">
                        {totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : 'No results'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handlePrevious}
                        disabled={totalMatches === 0}
                      >
                        <ChevronUp className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleNext}
                        disabled={totalMatches === 0}
                      >
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${caseSensitive ? 'bg-primary/20 hover:bg-primary/30' : ''}`}
                        onClick={() => setCaseSensitive(!caseSensitive)}
                        title="Match Case"
                      >
                        <span className={`text-xs font-semibold ${caseSensitive ? 'text-primary' : 'text-muted-foreground'}`}>Aa</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleSearchToggle}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}
                  <CodeMirror
                    value={preview.content}
                    height="500px"
                    extensions={extensions}
                    editable={false}
                    theme={editorTheme}
                    onCreateEditor={(view) => {
                      editorViewRef.current = view;
                    }}
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLineGutter: false,
                      highlightSpecialChars: true,
                      foldGutter: true,
                      highlightActiveLine: false
                    }}
                  />
                </div>
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
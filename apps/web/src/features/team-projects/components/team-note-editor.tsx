import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as TiptapMarkdown } from 'tiptap-markdown';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import LinkExtension from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import UnderlineExtension from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table/table';
import { TableRow } from '@tiptap/extension-table/row';
import { TableCell } from '@tiptap/extension-table/cell';
import { TableHeader } from '@tiptap/extension-table/header';
import {
  MarkdownSuperscript,
  MarkdownSubscript,
  MarkdownHighlight,
  MarkdownInlineMath,
  MarkdownBlockMath
} from '@/features/notes/components/markdown-extensions';
import 'katex/dist/katex.min.css';
import { PasteMarkdown } from '@/features/notes/components/paste-markdown';
import { common, createLowlight } from 'lowlight';
import { CustomGlobalDragHandle } from '@/features/notes/components/custom-drag-handle';
import { Circle, Check, Clock, Loader2, Pin, PinOff, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { Doc as YDoc } from 'yjs';
import type { TeamNote, CollaborationUser } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import { useImageClickPreview } from '@/components/ui/image-preview';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useAuth } from '@/contexts/auth-context';
import { NoteBubbleMenu } from '@/features/notes/components/bubble-menu';
import { TableContextMenu } from '@/features/notes/components/table-bubble-menu';
import { MathContextMenu } from '@/features/notes/components/math-context-menu';
import { AdmonitionContextMenu } from '@/features/notes/components/admonition-context-menu';
import { MathInputDialog, type MathMode } from '@/features/notes/components/math-input-dialog';
import { SlashCommands, createSlashCommandSuggestion } from '@/features/notes/components/slash-command';
import { Admonition } from '@/features/notes/components/admonition-extension';
import { NoteHistoryPanel } from './note-history-panel';
import { createManualSnapshot } from '@/features/team-projects/api/team-notes';

// ---------------------------------------------------------------------------
// lowlight instance
// ---------------------------------------------------------------------------
const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Base64 image helpers (replaces server upload for team notes)
// ---------------------------------------------------------------------------

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.type);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function insertImageAtCursor(
  ed: ReturnType<typeof useEditor> | null,
  src: string,
): void {
  if (!ed) return;

  ed.commands.focus();

  const imageType = ed.state.schema.nodes.image;
  if (!imageType) return;

  const { $from } = ed.state.selection;

  if ($from.parent.isTextblock && $from.parent.content.size > 0) {
    try {
      const insertPos = $from.after($from.depth);
      const imageNode = imageType.create({ src });
      const tr = ed.state.tr.insert(insertPos, imageNode);
      ed.view.dispatch(tr);
      return;
    } catch {
      // fall through
    }
  }

  if (ed.chain().focus().setImage({ src }).run()) return;

  try {
    const endPos = ed.state.doc.content.size;
    const imageNode = imageType.create({ src });
    const tr = ed.state.tr.insert(endPos, imageNode);
    ed.view.dispatch(tr);
  } catch {
    console.error('[Image Insert] All insertion methods failed');
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Deterministic hex color from a string (e.g. user ID).
 * Returns #RRGGBB — Tiptap CollaborationCaret doesn't support HSL.
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 0.7, l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface TeamNoteEditorProps {
  note: TeamNote | null;
  teamId: string;
  projectId: string;
  onSave: (id: string | null, data: { title: string; content: string; isPinned: boolean }) => Promise<void>;
  onClose: () => void;
  /** Collaboration props — when provided, editor runs in collaborative mode */
  collaboration?: {
    provider: HocuspocusProvider;
    ydoc: YDoc;
    isConnected: boolean;
    isSynced: boolean;
    connectedUsers: CollaborationUser[];
  };
}

export function TeamNoteEditor({ note, teamId, projectId, onSave, onClose, collaboration }: TeamNoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [historyOpen, setHistoryOpen] = useState(false);

  const { user: authUser } = useAuth();

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const imagePreviewDialog = useImageClickPreview(editorContainerRef);
  const initialContentLoadedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether content has been modified since last save
  const isDirtyRef = useRef(false);

  // Math dialog state
  const [mathDialog, setMathDialog] = useState<{
    open: boolean;
    mode: MathMode;
    initialLatex: string;
    editPos: number | null;
  }>({ open: false, mode: 'inline', initialLatex: '', editPos: null });

  const openMathDialog = useCallback((mode: MathMode) => {
    setMathDialog({ open: true, mode, initialLatex: '', editPos: null });
  }, []);

  const openMathEdit = useCallback((latex: string, mode: MathMode, pos: number) => {
    setMathDialog({ open: true, mode, initialLatex: latex, editPos: pos });
  }, []);

  const closeMathDialog = useCallback(() => {
    setMathDialog((prev) => ({ ...prev, open: false }));
    editorRef.current?.commands.focus();
  }, []);

  const handleMathConfirm = useCallback(
    (latex: string, mode: MathMode) => {
      const ed = editorRef.current;
      if (!ed) return;

      if (mathDialog.editPos !== null) {
        const node = ed.state.doc.nodeAt(mathDialog.editPos);
        if (node) {
          if (mode === 'inline') {
            ed.chain().setNodeSelection(mathDialog.editPos).updateInlineMath({ latex }).focus().run();
          } else {
            ed.chain().setNodeSelection(mathDialog.editPos).updateBlockMath({ latex }).focus().run();
          }
        }
      } else {
        const { state } = ed;
        const nodeName = mode === 'inline' ? 'inlineMath' : 'blockMath';
        const nodeType = state.schema.nodes[nodeName];
        if (nodeType) {
          const newNode = nodeType.create({ latex });
          const tr = state.tr;
          if (mode === 'block') {
            const { $from } = state.selection;
            if ($from.parent.content.size === 0) {
              tr.replaceWith($from.before(), $from.after(), newNode);
            } else {
              tr.insert($from.after(), newNode);
            }
          } else {
            tr.replaceSelectionWith(newNode);
          }
          ed.view.dispatch(tr);
          ed.commands.focus();
        }
      }

      setMathDialog((prev) => ({ ...prev, open: false }));
    },
    [mathDialog.editPos]
  );

  // Image upload: read file as base64 data URI
  const handleImageInsert = useCallback(async (file: File) => {
    try {
      const dataUrl = await readFileAsBase64(file);
      insertImageAtCursor(editorRef.current, dataUrl);
    } catch {
      // silently fail
    }
  }, []);

  const triggerImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !isImageFile(file)) return;
      await handleImageInsert(file);
    };
    input.click();
  }, [handleImageInsert]);

  // Build the user identity for collaboration caret
  const collabUser = useMemo(() => {
    if (!authUser) return { name: 'Anonymous', color: '#888888' };
    return {
      name: authUser.displayName || authUser.username,
      color: stringToColor(authUser.id),
    };
  }, [authUser]);

  const isCollaborative = !!collaboration?.provider;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        // Disable built-in history when collaboration is active
        ...(isCollaborative ? { undoRedo: false } : {}),
      }),
      TiptapMarkdown.configure({
        html: false,
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Image.configure({ inline: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      MarkdownHighlight,
      Typography,
      UnderlineExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Type "/" for commands...' }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      MarkdownSuperscript,
      MarkdownSubscript,
      MarkdownInlineMath.configure({ katexOptions: { throwOnError: false } }),
      MarkdownBlockMath.configure({ katexOptions: { throwOnError: false } }),
      Admonition,
      PasteMarkdown,
      CustomGlobalDragHandle.configure({ dragHandleWidth: 20, scrollTreshold: 100 }),
      SlashCommands.configure({
        suggestion: createSlashCommandSuggestion({
          onImageUpload: triggerImageUpload,
          onMathInsert: openMathDialog,
        }),
      }),
      // Collaboration extensions (only when provider is available)
      ...(isCollaborative
        ? [
            Collaboration.configure({ document: collaboration.ydoc }),
            CollaborationCaret.configure({
              provider: collaboration.provider,
              user: collabUser,
            }),
          ]
        : []),
    ],
    // In collaborative mode, content comes from Yjs; otherwise use note.content
    content: isCollaborative ? '' : (note?.content ?? ''),
    editorProps: {
      attributes: {
        class: 'tiptap-note-editor tiptap-rich-text outline-none min-h-full p-6',
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter(isImageFile);
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        imageFiles.forEach((file) => handleImageInsert(file));
        return true;
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter(isImageFile);
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        imageFiles.forEach((file) => handleImageInsert(file));
        return true;
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e as ReturnType<typeof useEditor>;
    },
    onUpdate: ({ editor: e }) => {
      editorRef.current = e as ReturnType<typeof useEditor>;
      // Schedule auto-save on content changes (existing notes only)
      if (note?.id) scheduleAutoSave();
    },
  });

  useEffect(() => {
    if (editor) editorRef.current = editor;
  }, [editor]);

  // Seed initial content into the Yjs document on first sync when the doc is empty
  useEffect(() => {
    if (
      !isCollaborative ||
      !collaboration?.isSynced ||
      !editor ||
      initialContentLoadedRef.current
    )
      return;

    initialContentLoadedRef.current = true;

    // Check if the Yjs doc already has content (from another client or persistence)
    const ydoc = collaboration.ydoc;
    const xmlFragment = ydoc.getXmlFragment('default');
    if (xmlFragment.length === 0 && note?.content) {
      // First time — seed with existing markdown content
      editor.commands.setContent(note.content);
    }
  }, [isCollaborative, collaboration?.isSynced, collaboration?.ydoc, editor, note?.content]);

  const getMarkdownContent = useCallback(() => {
    if (!editor) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((editor.storage as any).markdown as { getMarkdown?: () => string })?.getMarkdown?.() ?? '';
  }, [editor]);

  // Auto-save: debounced save that persists markdown content
  const performAutoSave = useCallback(async () => {
    if (!note?.id || !title.trim()) return;
    if (!isDirtyRef.current) return;
    isDirtyRef.current = false;
    setSaveStatus('saving');
    try {
      const content = getMarkdownContent();
      await onSave(note.id, { title: title.trim(), content, isPinned });
      setSaveStatus('saved');
      // Clear "saved" indicator after 2s
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [note?.id, title, isPinned, getMarkdownContent, onSave]);

  const scheduleAutoSave = useCallback(() => {
    // Only auto-save existing notes (not new unsaved notes)
    if (!note?.id) return;
    isDirtyRef.current = true;
    setSaveStatus('idle');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 2000);
  }, [note?.id, performAutoSave]);

  // Auto-save on title or pin changes (for existing notes)
  useEffect(() => {
    if (!note?.id) return;
    // Skip initial render
    if (title === (note?.title ?? '') && isPinned === (note?.isPinned ?? false)) return;
    scheduleAutoSave();
  }, [title, isPinned]); // intentionally narrow deps — scheduleAutoSave is stable per note

  // --- Session-end snapshot on TRUE unmount only ---
  // We store the cleanup logic in a ref so the empty-deps useEffect always
  // calls the latest version (avoids stale closures). This ensures we only
  // create a session_end snapshot when the component is truly destroyed
  // (editor closed / navigated away), NOT on every title keystroke or
  // dependency change — which was the previous bug.
  const unmountCleanupRef = useRef<() => void>(() => {});
  unmountCleanupRef.current = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (savedIndicatorTimerRef.current) {
      clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = null;
    }

    // In collaborative mode the Hocuspocus server creates a "disconnect"
    // snapshot when the last client leaves — no need to duplicate from here.
    if (isCollaborative) return;

    const noteId = note?.id;
    const trimmedTitle = title.trim();
    if (noteId && trimmedTitle) {
      const flush = isDirtyRef.current
        ? (() => { isDirtyRef.current = false; return onSave(noteId, { title: trimmedTitle, content: getMarkdownContent(), isPinned }); })()
        : Promise.resolve();
      flush
        .then(() => createManualSnapshot(teamId, projectId, noteId, 'session_end'))
        .catch(() => {});
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally empty: cleanup must only run on true unmount
  useEffect(() => () => unmountCleanupRef.current(), []);

  // Manual save for new notes (no id yet)
  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      const content = getMarkdownContent();
      await onSave(note?.id ?? null, { title: title.trim(), content, isPinned });
    } finally {
      setIsSaving(false);
    }
  }, [note?.id, title, isPinned, getMarkdownContent, onSave]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 flex-1 mr-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="text-md font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Collaboration status & connected users */}
          {isCollaborative && (
            <div className="flex items-center gap-1.5 mr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Circle
                    className="h-2.5 w-2.5"
                    fill={collaboration?.isConnected ? '#22c55e' : '#ef4444'}
                    stroke="none"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {collaboration?.isConnected
                    ? collaboration?.isSynced
                      ? 'Connected & synced'
                      : 'Connected, syncing...'
                    : 'Disconnected'}
                </TooltipContent>
              </Tooltip>

              {(collaboration?.connectedUsers?.length ?? 0) > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-default">
                      <Users className="h-3.5 w-3.5" />
                      <span>{collaboration!.connectedUsers.length}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex flex-col gap-1">
                      {collaboration!.connectedUsers.map((u, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Circle
                            className="h-2 w-2"
                            fill={u.color}
                            stroke="none"
                          />
                          <span>{u.name}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* History button (only for existing notes) */}
          {note?.id && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHistoryOpen(true)}
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Version History</TooltipContent>
            </Tooltip>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* WYSIWYG Editor */}
      <div className="flex-1 overflow-y-auto" ref={editorContainerRef}>
        {editor && <NoteBubbleMenu editor={editor} />}
        {editor && <TableContextMenu editor={editor} />}
        {editor && <MathContextMenu editor={editor} onEdit={openMathEdit} />}
        {editor && <AdmonitionContextMenu editor={editor} />}
        <EditorContent editor={editor} className="h-full" />
      </div>

      {imagePreviewDialog}

      <MathInputDialog
        open={mathDialog.open}
        mode={mathDialog.mode}
        initialLatex={mathDialog.initialLatex}
        onConfirm={handleMathConfirm}
        onCancel={closeMathDialog}
      />

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 p-4 border-t">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {note?.id && saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {note?.id && saveStatus === 'saved' && (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
          {/* Show Save button only for new (unsaved) notes */}
          {!note?.id && (
            <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* History Panel */}
      {note?.id && (
        <NoteHistoryPanel
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          teamId={teamId}
          projectId={projectId}
          noteId={note.id}
          currentContent={getMarkdownContent()}
        />
      )}
    </div>
  );
}

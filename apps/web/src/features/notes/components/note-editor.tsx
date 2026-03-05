import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as TiptapMarkdown } from 'tiptap-markdown';
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
import { MarkdownSuperscript, MarkdownSubscript, MarkdownHighlight, MarkdownInlineMath, MarkdownBlockMath, MarkdownBlockImage } from './markdown-extensions';
import 'katex/dist/katex.min.css';
import { PasteMarkdown } from './paste-markdown';
import { common, createLowlight } from 'lowlight';
import { CustomGlobalDragHandle } from './custom-drag-handle';
import {
  Loader2,
  Pin,
  PinOff,
  ExternalLink
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Note,
  PersonalProject
} from '@workspace/shared';

import { Button } from '@/components/ui/button';
import { useImageClickPreview } from '@/components/ui/image-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { NoteBubbleMenu } from './bubble-menu';
import { TableContextMenu } from './table-bubble-menu';
import { MathContextMenu } from './math-context-menu';
import { AdmonitionContextMenu } from './admonition-context-menu';
import { MathInputDialog, type MathMode } from './math-input-dialog';
import { SlashCommands, createSlashCommandSuggestion } from './slash-command';
import { Admonition } from './admonition-extension';

// ---------------------------------------------------------------------------
// lowlight instance (syntax highlighting for code blocks)
// ---------------------------------------------------------------------------
const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Image upload helper (reused from mention-input)
// ---------------------------------------------------------------------------
const API_URL = (import.meta as { env?: Record<string, unknown> }).env?.VITE_API_URL ?? '';

async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('auth_access_token');
  const res = await fetch(`${API_URL}/api/v1/uploads/images`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error('Image upload failed');

  const json = (await res.json()) as { data: { url: string; filename: string } };
  return json.data.url;
}

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.type);
}

/** Extract uploaded image filenames from content string */
function extractImageFilenames(content: string): Set<string> {
  const filenames = new Set<string>();
  const pattern = /\/api\/v1\/uploads\/images\/([\da-f-]+\.\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    filenames.add(match[1]);
  }
  return filenames;
}

/** Extract filename from an upload URL */
function extractFilenameFromUrl(url: string): string | null {
  const match = /\/api\/v1\/uploads\/images\/([\da-f-]+\.\w+)/i.exec(url);
  return match ? match[1] : null;
}

/**
 * Insert a block-level image into the editor.
 * When the cursor sits inside a non-empty text block (e.g. a paragraph with
 * text) the standard `setImage` command silently fails because it cannot
 * place a block node at an inline position.  This helper detects that case
 * and uses a raw ProseMirror transaction to insert the image *after* the
 * current text block instead.
 */
function insertImageAtCursor(
  ed: ReturnType<typeof useEditor> | null,
  src: string,
): void {
  if (!ed) return;

  // Always re-focus first — the async upload gap may have defocused the editor
  ed.commands.focus();

  const imageType = ed.state.schema.nodes.image;
  if (!imageType) return;

  const { $from } = ed.state.selection;

  // Inside a non-empty text block → insert image block right after it
  if ($from.parent.isTextblock && $from.parent.content.size > 0) {
    try {
      const insertPos = $from.after($from.depth);
      const imageNode = imageType.create({ src });
      const tr = ed.state.tr.insert(insertPos, imageNode);
      ed.view.dispatch(tr);
      return;
    } catch {
      // tr.insert position invalid — fall through to next strategy
    }
  }

  // Standard command — works when cursor is in an empty block or between blocks
  if (ed.chain().focus().setImage({ src }).run()) return;

  // Last resort: append at end of document
  try {
    const endPos = ed.state.doc.content.size;
    const imageNode = imageType.create({ src });
    const tr = ed.state.tr.insert(endPos, imageNode);
    ed.view.dispatch(tr);
  } catch {
    console.error('[Image Insert] All insertion methods failed for:', src);
  }
}

/** Delete an uploaded image by filename */
async function deleteUploadedImage(filename: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('auth_access_token');
    const res = await fetch(`${API_URL}/api/v1/uploads/images/${filename}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok && res.status !== 404) {
      console.warn('[Image Cleanup] DELETE failed:', res.status, filename);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Image Cleanup] DELETE error:', filename, err);
    return false;
  }
}



// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoteEditorProps {
  note: Note | null;
  projects: PersonalProject[];
  onSave: (id: string | null, data: { title: string; content: string; isPinned: boolean; projectId?: string }) => Promise<void>;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  saveRequestId?: number;
  onSaveCompleted?: () => void;
  onPopout?: () => void;
  hideCloseButton?: boolean;
}

export function NoteEditor({ 
  note, 
  projects, 
  onSave, 
  onClose, 
  onDirtyChange, 
  saveRequestId, 
  onSaveCompleted,
  onPopout,
  hideCloseButton 
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [projectId, setProjectId] = useState<string>(note?.projectId ?? 'none');
  const [isSaving, setIsSaving] = useState(false);

  const initialRef = useRef({
    title: note?.title ?? '',
    content: note?.content ?? '',
    isPinned: note?.isPinned ?? false,
    projectId: note?.projectId ?? 'none',
  });

  // Ref to hold latest editor ref for image upload callbacks
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // Image preview on click
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const imagePreviewDialog = useImageClickPreview(editorContainerRef);

  // Track images uploaded during this editing session for orphan cleanup
  const sessionUploadsRef = useRef<Set<string>>(new Set());

  // Clean up orphaned uploads on unmount (Scenario II: close without saving)
  useEffect(() => {
    const uploadsRef = sessionUploadsRef;
    return () => {
      if (uploadsRef.current.size > 0) {
        const orphans = [...uploadsRef.current];
        console.warn('[Image Cleanup] Unmount — deleting orphaned uploads:', orphans);
        orphans.forEach((fn) => deleteUploadedImage(fn));
        uploadsRef.current.clear();
      }
    };
  }, []);

  // Math dialog state
  const [mathDialog, setMathDialog] = useState<{
    open: boolean;
    mode: MathMode;
    initialLatex: string;
    editPos: number | null; // non-null when editing existing node
  }>({ open: false, mode: 'inline', initialLatex: '', editPos: null });

  const openMathDialog = useCallback((mode: MathMode) => {
    setMathDialog({ open: true, mode, initialLatex: '', editPos: null });
  }, []);

  const openMathEdit = useCallback((latex: string, mode: MathMode, pos: number) => {
    setMathDialog({ open: true, mode, initialLatex: latex, editPos: pos });
  }, []);

  const closeMathDialog = useCallback(() => {
    setMathDialog(prev => ({ ...prev, open: false }));
    editorRef.current?.commands.focus();
  }, []);

  const handleMathConfirm = useCallback((latex: string, mode: MathMode) => {
    const ed = editorRef.current;
    if (!ed) return;

    if (mathDialog.editPos !== null) {
      // Editing existing node
      const node = ed.state.doc.nodeAt(mathDialog.editPos);
      if (node) {
        if (mode === 'inline') {
          ed.chain().setNodeSelection(mathDialog.editPos).updateInlineMath({ latex }).focus().run();
        } else {
          ed.chain().setNodeSelection(mathDialog.editPos).updateBlockMath({ latex }).focus().run();
        }
      }
    } else {
      // Inserting new node via ProseMirror transaction (bypasses tiptap-markdown override)
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

    setMathDialog(prev => ({ ...prev, open: false }));
  }, [mathDialog.editPos]);

  // Image upload trigger (called from slash command)
  const triggerImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !isImageFile(file)) return;
      try {
        const url = await uploadImageFile(file);
        const fn = extractFilenameFromUrl(url);
        if (fn) {
          sessionUploadsRef.current.add(fn);
          console.warn('[Image Cleanup] Tracked upload (file picker):', fn);
        }
        insertImageAtCursor(editorRef.current, url);
      } catch {
        // silently fail — image upload failed
      }
    };
    input.click();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      TiptapMarkdown.configure({
        html: false,
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      MarkdownBlockImage.configure({ inline: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
      }),
      MarkdownHighlight,
      Typography,
      UnderlineExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Type "/" for commands...',
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      MarkdownSuperscript,
      MarkdownSubscript,
      MarkdownInlineMath.configure({
        katexOptions: { throwOnError: false },
      }),
      MarkdownBlockMath.configure({
        katexOptions: { throwOnError: false },
      }),
      Admonition,
      PasteMarkdown,
      CustomGlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      SlashCommands.configure({
        suggestion: createSlashCommandSuggestion({
          onImageUpload: triggerImageUpload,
          onMathInsert: openMathDialog,
        }),
      }),
    ],
    content: note?.content ?? '',
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
        imageFiles.forEach(async (file) => {
          try {
            const url = await uploadImageFile(file);
            const fn = extractFilenameFromUrl(url);
            if (fn) {
              sessionUploadsRef.current.add(fn);
              console.warn('[Image Cleanup] Tracked upload (drop):', fn);
            }
            insertImageAtCursor(editorRef.current, url);
          } catch {
            // silently fail
          }
        });
        return true;
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length) return false;

        const imageFiles = Array.from(files).filter(isImageFile);
        if (imageFiles.length === 0) return false;

        event.preventDefault();
        imageFiles.forEach(async (file) => {
          try {
            const url = await uploadImageFile(file);
            const fn = extractFilenameFromUrl(url);
            if (fn) {
              sessionUploadsRef.current.add(fn);
              console.warn('[Image Cleanup] Tracked upload (paste):', fn);
            }
            insertImageAtCursor(editorRef.current, url);
          } catch {
            // silently fail
          }
        });
        return true;
      },
    },
    // Load markdown content on init
    onCreate: ({ editor: e }) => {
      if (note?.content) {
        // tiptap-markdown parses md content automatically via the extension
        // Content is already set via `content` prop which gets parsed by Markdown extension
      }
      editorRef.current = e as ReturnType<typeof useEditor>;
    },
    onUpdate: ({ editor: e }) => {
      editorRef.current = e as ReturnType<typeof useEditor>;
    },
  });

  // Keep editorRef in sync
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Get current content as markdown
  const getMarkdownContent = useCallback(() => {
    if (!editor) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((editor.storage as any).markdown as { getMarkdown?: () => string })?.getMarkdown?.() ?? '';
  }, [editor]);

  // Dirty tracking
  const currentContent = editor ? getMarkdownContent() : '';
  const dirty =
    title !== initialRef.current.title ||
    currentContent !== initialRef.current.content ||
    isPinned !== initialRef.current.isPinned ||
    projectId !== initialRef.current.projectId;

  const handleSave = useCallback(async (closeAfterSave = true) => {
    if (!title.trim()) return;
    setIsSaving(true);
    const content = getMarkdownContent();
    try {
      await onSave(note?.id ?? null, {
        title: title.trim(),
        content,
        isPinned,
        projectId: projectId !== 'none' ? projectId : undefined,
      });

      // Clean up images uploaded this session but removed before saving
      if (sessionUploadsRef.current.size > 0) {
        const savedImages = extractImageFilenames(content);
        const orphans = [...sessionUploadsRef.current].filter(fn => !savedImages.has(fn));
        if (orphans.length > 0) {
          console.warn('[Image Cleanup] Save — deleting orphaned uploads:', orphans);
          await Promise.all(orphans.map(fn => deleteUploadedImage(fn)));
        }
        sessionUploadsRef.current.clear();
      }

      initialRef.current = { title: title.trim(), content, isPinned, projectId };
      onDirtyChange?.(false);

      if (closeAfterSave && !hideCloseButton) onClose();
    } finally {
      setIsSaving(false);
    }
  }, [note?.id, title, isPinned, projectId, getMarkdownContent, onSave, onClose, onDirtyChange, hideCloseButton]);

  // Notify parent when draft becomes dirty/clean
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Respond to parent's save token
  useEffect(() => {
    if (saveRequestId && saveRequestId > 0) {
      (async () => {
        await handleSave(false);
        onSaveCompleted?.();
      })();
    }
  }, [saveRequestId, onSaveCompleted, handleSave]);

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
          {onPopout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPopout}
              title="Open in new window"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
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

      {/* Metadata */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Project:</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      {/* Math Input Dialog */}
      <MathInputDialog
        open={mathDialog.open}
        mode={mathDialog.mode}
        initialLatex={mathDialog.initialLatex}
        onConfirm={handleMathConfirm}
        onCancel={closeMathDialog}
      />

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t">
        {!hideCloseButton && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button onClick={() => handleSave()} disabled={isSaving || !title.trim()}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

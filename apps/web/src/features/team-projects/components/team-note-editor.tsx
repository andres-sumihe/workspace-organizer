import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as TiptapMarkdown } from 'tiptap-markdown';
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
import { Loader2, Pin, PinOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TeamNote } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import { useImageClickPreview } from '@/components/ui/image-preview';
import { Input } from '@/components/ui/input';

import { NoteBubbleMenu } from '@/features/notes/components/bubble-menu';
import { TableContextMenu } from '@/features/notes/components/table-bubble-menu';
import { MathContextMenu } from '@/features/notes/components/math-context-menu';
import { AdmonitionContextMenu } from '@/features/notes/components/admonition-context-menu';
import { MathInputDialog, type MathMode } from '@/features/notes/components/math-input-dialog';
import { SlashCommands, createSlashCommandSuggestion } from '@/features/notes/components/slash-command';
import { Admonition } from '@/features/notes/components/admonition-extension';

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

interface TeamNoteEditorProps {
  note: TeamNote | null;
  onSave: (id: string | null, data: { title: string; content: string; isPinned: boolean }) => Promise<void>;
  onClose: () => void;
}

export function TeamNoteEditor({ note, onSave, onClose }: TeamNoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [isSaving, setIsSaving] = useState(false);

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const imagePreviewDialog = useImageClickPreview(editorContainerRef);

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      TiptapMarkdown.configure({
        html: false,
        linkify: true,
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
    },
  });

  useEffect(() => {
    if (editor) editorRef.current = editor;
  }, [editor]);

  const getMarkdownContent = useCallback(() => {
    if (!editor) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((editor.storage as any).markdown as { getMarkdown?: () => string })?.getMarkdown?.() ?? '';
  }, [editor]);

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
      <div className="flex items-center justify-end gap-2 p-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

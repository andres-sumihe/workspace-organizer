import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as TiptapMarkdown } from 'tiptap-markdown';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import LinkExtension from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import UnderlineExtension from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table/table';
import { TableRow } from '@tiptap/extension-table/row';
import { TableCell } from '@tiptap/extension-table/cell';
import { TableHeader } from '@tiptap/extension-table/header';
import SuperscriptExtension from '@tiptap/extension-superscript';
import SubscriptExtension from '@tiptap/extension-subscript';
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
import { SlashCommands, createSlashCommandSuggestion } from './slash-command';

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

  const json = (await res.json()) as { data: { url: string } };
  return json.data.url;
}

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.type);
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
        editorRef.current?.chain().focus().setImage({ src: url }).run();
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
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Image.configure({ inline: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
      }),
      Highlight,
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
      SuperscriptExtension,
      SubscriptExtension,
      CustomGlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      SlashCommands.configure({
        suggestion: createSlashCommandSuggestion(triggerImageUpload),
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
            editorRef.current?.chain().focus().setImage({ src: url }).run();
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
            editorRef.current?.chain().focus().setImage({ src: url }).run();
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
      <div className="flex-1 overflow-y-auto">
        {editor && <NoteBubbleMenu editor={editor} />}
        <EditorContent editor={editor} className="h-full" />
      </div>

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

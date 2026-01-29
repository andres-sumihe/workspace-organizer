import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { search, searchKeymap } from '@codemirror/search';
import CodeMirror from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import {
  Eye,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  ExternalLink
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import type {
  Note,
  PersonalProject
} from '@workspace/shared';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { markdownComponents, remarkPlugins, rehypePlugins } from './markdown-config';

interface NoteEditorProps {
  note: Note | null;
  projects: PersonalProject[];
  onSave: (id: string | null, data: { title: string; content: string; isPinned: boolean; projectId?: string }) => Promise<void>;
  onClose: () => void;
  // Called when the draft becomes dirty/clean
  onDirtyChange?: (dirty: boolean) => void;
  // Token to request a save action from parent; increment to request another save
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
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [projectId, setProjectId] = useState<string>(note?.projectId ?? 'none');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const initialRef = useRef({ title: note?.title ?? '', content: note?.content ?? '', isPinned: note?.isPinned ?? false, projectId: note?.projectId ?? 'none' });
  const dirty = title !== initialRef.current.title || content !== initialRef.current.content || isPinned !== initialRef.current.isPinned || projectId !== initialRef.current.projectId;

  const editorTheme = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }, [theme]);

  const extensions = useMemo(() => [
    markdown({ codeLanguages: languages }),
    search({ top: true }),
    keymap.of(searchKeymap)
  ], []);

  const handleSave = useCallback(async (closeAfterSave = true) => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave(note?.id ?? null, {
        title: title.trim(),
        content,
        isPinned,
        projectId: projectId !== 'none' ? projectId : undefined
      });

      // Update initial snapshot after successful save
      initialRef.current = { title: title.trim(), content, isPinned, projectId };
      onDirtyChange?.(false);

      if (closeAfterSave && !hideCloseButton) onClose();
    } finally {
      setIsSaving(false);
    }
  }, [note?.id, title, content, isPinned, projectId, onSave, onClose, onDirtyChange, hideCloseButton]);

  // Notify parent when draft becomes dirty/clean
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Respond to parent's save token (save without closing)
  useEffect(() => {
    if (saveRequestId && saveRequestId > 0) {
      // save without closing, then notify parent via callback
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewMode(!previewMode)}
            title={previewMode ? 'Edit' : 'Preview'}
          >
            {previewMode ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

      {/* Editor/Preview */}
      <div className="flex-1 overflow-hidden">
        {previewMode ? (
          <ScrollArea className="h-full">
            <div className="p-6 prose prose-slate dark:prose-invert max-w-none note-preview">
              <Markdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {content || '*No content*'}
              </Markdown>
            </div>
          </ScrollArea>
        ) : (
          <CodeMirror
            value={content}
            height="100%"
            extensions={extensions}
            onChange={setContent}
            theme={editorTheme}
            placeholder="Write your notes in Markdown..."
            basicSetup={{
              lineNumbers: false,
              highlightActiveLineGutter: false,
              foldGutter: false,
              highlightActiveLine: false
            }}
            className="h-full note-editor"
          />
        )}
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

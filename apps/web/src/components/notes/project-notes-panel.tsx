import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import CodeMirror from '@uiw/react-codemirror';
import {
  Eye,
  FileText,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2
} from 'lucide-react';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkDeflist from 'remark-deflist';
import remarkEmoji from 'remark-emoji';
import remarkFlexibleContainers from 'remark-flexible-containers';
import remarkFlexibleMarkers from 'remark-flexible-markers';
import remarkGfm from 'remark-gfm';
import remarkIns from 'remark-ins';
import remarkMath from 'remark-math';
import remarkSupersub from 'remark-supersub';

import type { Note } from '@workspace/shared';

import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

import { notesApi } from '@/api/notes-vault';
import { useTheme } from '@/components/theme-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { ScrollArea } from '@/components/ui/scroll-area';


// Reuse markdown configuration
const markdownComponents = {
  h1: (props: React.ComponentProps<'h1'>) => <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />,
  h2: (props: React.ComponentProps<'h2'>) => <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />,
  h3: (props: React.ComponentProps<'h3'>) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
  h4: (props: React.ComponentProps<'h4'>) => <h4 className="text-lg font-bold mt-3 mb-2" {...props} />,
  h5: (props: React.ComponentProps<'h5'>) => <h5 className="text-base font-bold mt-2 mb-1" {...props} />,
  h6: (props: React.ComponentProps<'h6'>) => <h6 className="text-sm font-bold mt-2 mb-1" {...props} />,
  p: (props: React.ComponentProps<'p'>) => <p className="mb-4 leading-7" {...props} />,
  ul: (props: React.ComponentProps<'ul'>) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
  ol: (props: React.ComponentProps<'ol'>) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
  li: (props: React.ComponentProps<'li'>) => <li className="leading-7" {...props} />,
  code: (props: React.ComponentProps<'code'>) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
  pre: (props: React.ComponentProps<'pre'>) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm" {...props} />,
  blockquote: (props: React.ComponentProps<'blockquote'>) => <blockquote className="border-l-4 border-primary pl-4 italic my-4" {...props} />,
  a: (props: React.ComponentProps<'a'>) => <a className="text-blue-500 hover:text-blue-700 underline cursor-pointer" target="_blank" rel="noopener noreferrer" {...props} />,
  table: (props: React.ComponentProps<'table'>) => <table className="w-full border-collapse my-4" {...props} />,
  thead: (props: React.ComponentProps<'thead'>) => <thead className="bg-muted" {...props} />,
  tbody: (props: React.ComponentProps<'tbody'>) => <tbody {...props} />,
  tr: (props: React.ComponentProps<'tr'>) => <tr className="border-b" {...props} />,
  th: (props: React.ComponentProps<'th'>) => <th className="border px-4 py-2 text-left font-semibold" {...props} />,
  td: (props: React.ComponentProps<'td'>) => <td className="border px-4 py-2" {...props} />,
  hr: (props: React.ComponentProps<'hr'>) => <hr className="my-8 border-border" {...props} />,
  img: (props: React.ComponentProps<'img'>) => <img className="max-w-full h-auto rounded-lg my-4" {...props} />,
  del: (props: React.ComponentProps<'del'>) => <del className="line-through opacity-60" {...props} />,
  ins: (props: React.ComponentProps<'ins'>) => <ins className="decoration-green-500 underline bg-green-100 dark:bg-green-900/30" {...props} />,
  mark: (props: React.ComponentProps<'mark'>) => <mark className="bg-yellow-200 dark:bg-yellow-900/40 px-1" {...props} />,
  sup: (props: React.ComponentProps<'sup'>) => <sup className="text-[0.75em] relative -top-[0.5em]" {...props} />,
  sub: (props: React.ComponentProps<'sub'>) => <sub className="text-[0.75em] relative top-[0.25em]" {...props} />,
  dl: (props: React.ComponentProps<'dl'>) => <dl className="my-4" {...props} />,
  dt: (props: React.ComponentProps<'dt'>) => <dt className="font-bold mt-2" {...props} />,
  dd: (props: React.ComponentProps<'dd'>) => <dd className="ml-4 mb-2 text-muted-foreground" {...props} />,
  input: (props: React.ComponentProps<'input'>) => {
    if (props.type === 'checkbox') {
      return <input className="mr-2 align-middle" {...props} />;
    }
    return <input {...props} />;
  },
};

const remarkPlugins: Parameters<typeof Markdown>[0]['remarkPlugins'] = [
  remarkGfm,
  remarkMath,
  remarkDeflist,
  [remarkEmoji, { emoticon: true }],
  remarkSupersub,
  remarkFlexibleMarkers,
  remarkIns,
  remarkFlexibleContainers,
];
const rehypePlugins = [rehypeRaw, rehypeHighlight, rehypeKatex];

interface NoteEditorProps {
  note: Note | null;
  projectId?: string;
  onSave: (id: string | null, data: { title: string; content: string; isPinned: boolean; projectId?: string }) => Promise<void>;
  onClose: () => void;
}

function NoteEditor({ note, projectId: defaultProjectId, onSave, onClose }: NoteEditorProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [projectId, _setProjectId] = useState<string>(note?.projectId ?? defaultProjectId ?? 'none');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const editorTheme = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }, [theme]);

  const extensions = useMemo(() => [markdown({ codeLanguages: languages })], []);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave(note?.id ?? null, {
        title: title.trim(),
        content,
        isPinned,
        projectId: projectId !== 'none' ? projectId : undefined
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="text-md font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
        />
        <div className="flex items-center gap-2">
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

interface ProjectNotesPanelProps {
  projectId: string;
}

export function ProjectNotesPanel({ projectId }: ProjectNotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const notesRes = await notesApi.list({ projectId });
      setNotes(notesRes.items);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveNote = useCallback(
    async (id: string | null, data: { title: string; content: string; isPinned: boolean; projectId?: string }) => {
      try {
        if (id) {
          setNotes((prev) => prev.map((n) => 
            n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
          ));
          const savedNote = await notesApi.update(id, data);
          if (savedNote?.note) setSelectedNote(savedNote.note);
        } else {
          const savedNote = await notesApi.create(data);
          if (savedNote?.note) {
            setNotes((prev) => [savedNote.note, ...prev]);
            setSelectedNote(savedNote.note);
          }
        }
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to save note:', error);
        fetchData();
      }
    },
    [fetchData]
  );

  const handleDeleteNote = useCallback(async () => {
    if (!deleteNoteId) return;
    setNotes((prev) => prev.filter((n) => n.id !== deleteNoteId));
    if (selectedNote?.id === deleteNoteId) {
      setSelectedNote(null);
      setIsEditing(false);
    }
    setDeleteNoteId(null);
    try {
      await notesApi.delete(deleteNoteId);
    } catch (error) {
      console.error('Failed to delete note:', error);
      fetchData();
    }
  }, [deleteNoteId, selectedNote, fetchData]);

  return (
    <div className="h-[600px] flex gap-4">
      {/* List */}
      <div className="w-1/3 border rounded-lg flex flex-col overflow-hidden">
        <div className="p-3 border-b bg-muted/30 flex justify-between items-center">
          <span className="font-medium text-sm">Notes ({notes.length})</span>
          <Button size="sm" variant="ghost" onClick={() => { setSelectedNote(null); setIsEditing(true); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => { setSelectedNote(note); setIsEditing(false); }}
                className={`flex w-full items-start gap-2 p-2 text-left text-sm rounded-md hover:bg-muted/80 ${
                  selectedNote?.id === note.id ? 'bg-muted' : ''
                }`}
              >
                <div className="mt-1">
                  {note.isPinned ? <Pin className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{note.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {note.content?.slice(0, 50) || 'No content'}
                  </p>
                </div>
              </button>
            ))}
            {notes.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No notes found
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor/Preview */}
      <div className="flex-1 flex flex-col overflow-hidden border rounded-lg">
        {isEditing ? (
          <NoteEditor
            note={selectedNote}
            projectId={projectId}
            onSave={handleSaveNote}
            onClose={() => setIsEditing(false)}
          />
        ) : selectedNote ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{selectedNote.title}</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteNoteId(selectedNote.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <Markdown
                  remarkPlugins={remarkPlugins}
                  rehypePlugins={rehypePlugins}
                  components={markdownComponents}
                >
                  {selectedNote.content || '*No content*'}
                </Markdown>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a note or create a new one
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>Irreversible action.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNote}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

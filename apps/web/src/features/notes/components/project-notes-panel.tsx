import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Loader2,
  Pin,
  Plus,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import type { Note } from '@workspace/shared';

import {
  useNotesList,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from '@/features/notes/hooks/use-notes';
import { NoteEditor } from './note-editor';
import { NoteViewer } from './note-viewer';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------

interface ProjectNotesPanelProps {
  projectId: string;
}

export function ProjectNotesPanel({ projectId }: ProjectNotesPanelProps) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // TanStack Query
  const { data, isLoading } = useNotesList({ projectId });
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const notes = data?.items ?? [];

  // Sort: pinned first, then by updatedAt desc
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleSaveNote = useCallback(
    async (
      id: string | null,
      data: { title: string; content: string; isPinned: boolean; projectId?: string },
    ) => {
      if (id) {
        const result = await updateNote.mutateAsync({
          noteId: id,
          data: { ...data, projectId: data.projectId ?? projectId },
        });
        if (result?.note) setSelectedNote(result.note);
      } else {
        const result = await createNote.mutateAsync({
          ...data,
          projectId: data.projectId ?? projectId,
        });
        if (result?.note) setSelectedNote(result.note);
      }
      setIsEditing(false);
    },
    [projectId, createNote, updateNote],
  );

  const handleDeleteNote = useCallback(async () => {
    if (!deleteNoteId) return;
    await deleteNote.mutateAsync(deleteNoteId);
    if (selectedNote?.id === deleteNoteId) {
      setSelectedNote(null);
      setIsEditing(false);
    }
    setDeleteNoteId(null);
  }, [deleteNoteId, selectedNote, deleteNote]);

  const handlePopout = useCallback(() => {
    if (!selectedNote) return;
    const width = 800;
    const height = 900;
    const popoutUrl = `/popout/notes/${selectedNote.id}`;
    const electronApi = (window as Window & { api?: { openPopoutWindow?: (url: string, options: { width: number; height: number; title: string }) => Promise<{ ok: boolean }> } }).api;
    if (electronApi?.openPopoutWindow) {
      electronApi.openPopoutWindow(popoutUrl, { width, height, title: 'Note - Workspace Organizer' });
    } else {
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        popoutUrl,
        `note_${selectedNote.id}`,
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    }
  }, [selectedNote]);

  return (
    <div className="h-full flex gap-0 relative">
      {/* Collapsible sidebar - uses data-state for CSS-driven animation */}
      <div
        data-state={sidebarOpen ? 'expanded' : 'collapsed'}
        className="group/pn-sidebar border rounded-lg flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-linear data-[state=expanded]:w-64 data-[state=collapsed]:w-12"
      >
        {/* Header */}
        <div className="h-10 border-b bg-muted/30 flex items-center shrink-0 px-2 overflow-hidden">
          <h3 className="flex-1 flex items-center gap-1.5 text-sm font-medium whitespace-nowrap truncate min-w-0 transition-all duration-200 ease-linear group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:opacity-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            Notes ({notes.length})
          </h3>
          <div className="flex items-center gap-0.5 shrink-0 transition-all duration-200 ease-linear group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:opacity-0 group-data-[state=collapsed]/pn-sidebar:overflow-hidden">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setSelectedNote(null);
                setIsEditing(true);
              }}
              title="New note"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 w-full min-w-0">
          <div className="flex flex-col gap-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {sortedNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => {
                  setSelectedNote(note);
                  setIsEditing(false);
                }}
                className={`flex items-center gap-2 p-2 text-left text-sm transition-all duration-200 ease-linear hover:bg-muted/80 min-h-11 group-data-[state=collapsed]/pn-sidebar:justify-center group-data-[state=collapsed]/pn-sidebar:gap-0 ${
                  selectedNote?.id === note.id ? 'bg-muted' : ''
                }`}
                title={note.title}
              >
                <div className="shrink-0 flex items-center">
                  {note.isPinned ? (
                    <Pin className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden transition-all duration-200 ease-linear opacity-100 w-full group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:flex-none group-data-[state=collapsed]/pn-sidebar:opacity-0 group-data-[state=collapsed]/pn-sidebar:max-h-0">
                  <p className="font-medium truncate">{note.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {note.content?.slice(0, 50) || 'No content'}
                  </p>
                </div>
              </button>
            ))}
            {notes.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-50" />
                <p className="mt-2 text-xs overflow-hidden transition-all duration-200 ease-linear group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:opacity-0 group-data-[state=collapsed]/pn-sidebar:h-0">
                  No notes yet
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor / Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden border rounded-lg ml-2">
        {isEditing ? (
          <NoteEditor
            note={selectedNote}
            projects={[]}
            onSave={handleSaveNote}
            onClose={() => setIsEditing(false)}
            hideCloseButton={false}
            onPopout={handlePopout}
          />
        ) : selectedNote ? (
          <NoteViewer
            note={selectedNote}
            onEdit={() => setIsEditing(true)}
            onDelete={(id) => setDeleteNoteId(id)}
            onPopout={handlePopout}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteNoteId}
        onOpenChange={(open) => !open && setDeleteNoteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
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

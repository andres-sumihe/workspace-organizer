import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import type { Note, PersonalProject } from '@workspace/shared';
import { notesApi } from '@/api/notes-vault';
import { personalProjectsApi } from '@/api/journal';
import { NoteEditor } from '@/components/notes/note-editor';
import { NoteViewer } from '@/components/notes/note-viewer';

// BroadcastChannel for cross-window coordination
const NOTE_CHANNEL_NAME = 'note-pip-channel';

type NoteChannelMessage =
  | { type: 'pip-opened'; noteId: string }
  | { type: 'pip-closed'; noteId: string }
  | { type: 'pip-editing'; noteId: string; isEditing: boolean }
  | { type: 'note-updated'; noteId: string }
  | { type: 'request-focus'; noteId: string };

export function NotePopoutPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!noteId) return;
    setIsLoading(true);
    try {
      const [noteRes, projectsRes] = await Promise.all([
        notesApi.getById(noteId),
        personalProjectsApi.list()
      ]);
      setNote(noteRes.note);
      setProjects(projectsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Notify main page when PiP window opens/closes
  useEffect(() => {
    if (!noteId) return;

    const channel = new BroadcastChannel(NOTE_CHANNEL_NAME);
    
    // Notify that PiP window opened
    channel.postMessage({ type: 'pip-opened', noteId } as NoteChannelMessage);

    // Listen for messages from main page
    const handleMessage = (event: MessageEvent<NoteChannelMessage>) => {
      if (event.data.noteId !== noteId) return;
      
      if (event.data.type === 'note-updated') {
        fetchData();
      } else if (event.data.type === 'request-focus') {
        window.focus();
      }
    };
    channel.addEventListener('message', handleMessage);

    // Notify when window closes
    const handleUnload = () => {
      channel.postMessage({ type: 'pip-closed', noteId } as NoteChannelMessage);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      channel.postMessage({ type: 'pip-closed', noteId } as NoteChannelMessage);
      channel.removeEventListener('message', handleMessage);
      channel.close();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [noteId, fetchData]);

  // Notify main page when editing state changes
  useEffect(() => {
    if (!noteId) return;
    const channel = new BroadcastChannel(NOTE_CHANNEL_NAME);
    channel.postMessage({ type: 'pip-editing', noteId, isEditing } as NoteChannelMessage);
    return () => channel.close();
  }, [noteId, isEditing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update document title
  useEffect(() => {
    if (note) {
      document.title = `${note.title} - Note${isEditing ? ' (Editing)' : ''}`;
    }
  }, [note?.title, isEditing]);

  const handleSave = useCallback(async (id: string | null, data: { title: string; content: string; isPinned: boolean; projectId?: string }) => {
    try {
      if (id) {
        const savedNote = await notesApi.update(id, data);
        setNote(savedNote.note);
        
        // Notify main page that note was updated
        const channel = new BroadcastChannel(NOTE_CHANNEL_NAME);
        channel.postMessage({ type: 'note-updated', noteId: id } as NoteChannelMessage);
        channel.close();
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    // In PiP mode, just close the window after delete
    try {
      await notesApi.delete(id);
      // Notify main page
      const channel = new BroadcastChannel(NOTE_CHANNEL_NAME);
      channel.postMessage({ type: 'note-updated', noteId: id } as NoteChannelMessage);
      channel.close();
      window.close();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex items-center justify-center h-screen text-destructive">
        {error || 'Note not found'}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      {isEditing ? (
        <NoteEditor
          note={note}
          projects={projects}
          onSave={handleSave}
          onClose={handleCloseEditor}
          hideCloseButton={false}
        />
      ) : (
        <NoteViewer
          note={note}
          onEdit={() => setIsEditing(true)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

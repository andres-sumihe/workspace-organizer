import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import type { TeamNote } from '@workspace/shared';
import { fetchTeamNote, updateTeamNote, deleteTeamNote } from '@/features/team-projects/api/team-notes';
import { TeamNoteEditor } from '@/features/team-projects/components/team-note-editor';
import { TeamNoteContentViewer } from '@/features/team-projects/components/team-note-content-viewer';
import {
  useCollaborationStatus,
  useCollaborationProvider,
} from '@/features/team-projects/hooks/use-collaboration';

// BroadcastChannel for cross-window coordination
const TEAM_NOTE_CHANNEL_NAME = 'team-note-pip-channel';

type TeamNoteChannelMessage =
  | { type: 'pip-opened'; noteId: string }
  | { type: 'pip-closed'; noteId: string }
  | { type: 'pip-editing'; noteId: string; isEditing: boolean }
  | { type: 'note-updated'; noteId: string }
  | { type: 'request-focus'; noteId: string };

export function TeamNotePopoutPage() {
  const { teamId, projectId, noteId } = useParams<{
    teamId: string;
    projectId: string;
    noteId: string;
  }>();
  const [note, setNote] = useState<TeamNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Collaboration hooks
  const { data: collabStatus } = useCollaborationStatus();
  const collabAvailable = collabStatus?.available ?? false;
  const documentName = noteId && teamId ? `team-note:${teamId}:${noteId}` : '';
  const collabResult = useCollaborationProvider({
    documentName,
    enabled: collabAvailable && isEditing && !!noteId,
  });

  const fetchData = useCallback(async () => {
    if (!teamId || !projectId || !noteId) return;
    setIsLoading(true);
    try {
      const res = await fetchTeamNote(teamId, projectId, noteId);
      setNote(res.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, projectId, noteId]);

  // Notify main page when PiP window opens/closes
  useEffect(() => {
    if (!noteId) return;

    const channel = new BroadcastChannel(TEAM_NOTE_CHANNEL_NAME);

    channel.postMessage({ type: 'pip-opened', noteId } as TeamNoteChannelMessage);

    const handleMessage = (event: MessageEvent<TeamNoteChannelMessage>) => {
      if (event.data.noteId !== noteId) return;

      if (event.data.type === 'note-updated') {
        fetchData();
      } else if (event.data.type === 'request-focus') {
        window.focus();
      }
    };
    channel.addEventListener('message', handleMessage);

    const handleUnload = () => {
      channel.postMessage({ type: 'pip-closed', noteId } as TeamNoteChannelMessage);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      channel.postMessage({ type: 'pip-closed', noteId } as TeamNoteChannelMessage);
      channel.removeEventListener('message', handleMessage);
      channel.close();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [noteId, fetchData]);

  // Notify main page when editing state changes
  useEffect(() => {
    if (!noteId) return;
    const channel = new BroadcastChannel(TEAM_NOTE_CHANNEL_NAME);
    channel.postMessage({ type: 'pip-editing', noteId, isEditing } as TeamNoteChannelMessage);
    return () => channel.close();
  }, [noteId, isEditing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update document title
  useEffect(() => {
    if (note) {
      document.title = `${note.title} - Team Note${isEditing ? ' (Editing)' : ''}`;
    }
  }, [note?.title, isEditing]);

  const handleSave = useCallback(
    async (
      id: string | null,
      data: { title: string; content: string; isPinned: boolean }
    ) => {
      if (!teamId || !projectId || !id) return;
      try {
        const res = await updateTeamNote(teamId, projectId, id, {
          title: data.title,
          content: data.content,
          isPinned: data.isPinned,
        });
        setNote(res.note);

        // Notify main page that note was updated
        const channel = new BroadcastChannel(TEAM_NOTE_CHANNEL_NAME);
        channel.postMessage({ type: 'note-updated', noteId: id } as TeamNoteChannelMessage);
        channel.close();
      } catch (err) {
        console.error('Failed to save note:', err);
      }
    },
    [teamId, projectId]
  );

  const handleCloseEditor = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!teamId || !projectId) return;
      try {
        await deleteTeamNote(teamId, projectId, id);
        // Notify main page
        const channel = new BroadcastChannel(TEAM_NOTE_CHANNEL_NAME);
        channel.postMessage({ type: 'note-updated', noteId: id } as TeamNoteChannelMessage);
        channel.close();
        window.close();
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    },
    [teamId, projectId]
  );

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
      {isEditing && collabAvailable && !collabResult.provider ? (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting to collaboration server…</span>
          </div>
        </div>
      ) : isEditing ? (
        <TeamNoteEditor
          key={collabResult.provider ? `collab-${documentName}` : `solo-${noteId}`}
          note={note}
          teamId={teamId!}
          projectId={projectId!}
          onSave={handleSave}
          onClose={handleCloseEditor}
          collaboration={
            collabResult.provider
              ? {
                  provider: collabResult.provider,
                  ydoc: collabResult.ydoc,
                  isConnected: collabResult.isConnected,
                  isSynced: collabResult.isSynced,
                  connectedUsers: collabResult.connectedUsers,
                }
              : undefined
          }
        />
      ) : (
        <TeamNoteContentViewer
          note={note}
          onEdit={() => setIsEditing(true)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

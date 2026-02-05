import {
  FileText,
  FolderOpen,
  Key,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Search,
  Trash2,
  Unlock,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Pencil,
  Pin
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';

import type {
  Note,
  Credential,
  CredentialWithData,
  CredentialType,
  PersonalProject,
  CredentialData
} from '@workspace/shared';

import { notesApi, credentialsApi, vaultApi } from '@/api/notes-vault';
import { useNotesList } from '@/hooks/use-notes';
import { usePersonalProjectsList } from '@/hooks/use-personal-projects';
import { useVaultStatus, useCredentialsList } from '@/hooks/use-vault';
import { AppPage, AppPageContent } from '@/components/layout/app-page';
import { NoteEditor } from '@/components/notes/note-editor';
import { NoteViewer } from '@/components/notes/note-viewer';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// Constants
// ============================================================================

const CREDENTIAL_TYPE_CONFIG: Record<CredentialType, { label: string; icon: typeof Key }> = {
  password: { label: 'Password', icon: Lock },
  api_key: { label: 'API Key', icon: Key },
  ssh: { label: 'SSH Key', icon: Key },
  database: { label: 'Database', icon: Key },
  generic: { label: 'Generic', icon: Key }
};

// ============================================================================
// Internal hooks replaced with TanStack Query hooks in NotesPage component
// ============================================================================

// ============================================================================
// Vault Setup Dialog
// ============================================================================

interface VaultSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetup: (password: string) => Promise<void>;
  isUnlock?: boolean;
}

function VaultSetupDialog({ open, onOpenChange, onSetup, isUnlock }: VaultSetupDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!isUnlock && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await onSetup(password);
      onOpenChange(false);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup vault');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isUnlock ? 'Unlock Vault' : 'Setup Vault'}</DialogTitle>
          <DialogDescription>
            {isUnlock
              ? 'Enter your master password to unlock the vault.'
              : 'Create a master password to protect your credentials. This password cannot be recovered if lost.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Master Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
            />
          </div>

          {!isUnlock && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm master password"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isUnlock ? 'Unlock' : 'Setup Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Credential Form Dialog
// ============================================================================

interface CredentialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: CredentialWithData | null;
  projects: PersonalProject[];
  onSave: (data: { title: string; type: CredentialType; projectId?: string; data: CredentialData }) => Promise<void>;
}

function CredentialFormDialog({ open, onOpenChange, credential, projects, onSave }: CredentialFormDialogProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CredentialType>('generic');
  const [projectId, setProjectId] = useState<string>('none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [database, setDatabase] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && credential) {
      setTitle(credential.title);
      setType(credential.type);
      setProjectId(credential.projectId ?? 'none');
      setUsername(credential.data.username ?? '');
      setPassword(credential.data.password ?? '');
      setApiKey(credential.data.apiKey ?? '');
      setHost(credential.data.host ?? '');
      setPort(credential.data.port?.toString() ?? '');
      setDatabase(credential.data.database ?? '');
      setNotes(credential.data.notes ?? '');
    } else if (open) {
      setTitle('');
      setType('generic');
      setProjectId('none');
      setUsername('');
      setPassword('');
      setApiKey('');
      setHost('');
      setPort('');
      setDatabase('');
      setNotes('');
    }
  }, [open, credential]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const data: CredentialData = { notes: notes || undefined };

      switch (type) {
        case 'password':
          data.username = username || undefined;
          data.password = password || undefined;
          break;
        case 'api_key':
          data.apiKey = apiKey || undefined;
          break;
        case 'database':
          data.username = username || undefined;
          data.password = password || undefined;
          data.host = host || undefined;
          data.port = port ? parseInt(port, 10) : undefined;
          data.database = database || undefined;
          break;
        case 'ssh':
        case 'generic':
          data.username = username || undefined;
          data.password = password || undefined;
          break;
      }

      await onSave({
        title: title.trim(),
        type,
        projectId: projectId !== 'none' ? projectId : undefined,
        data
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{credential ? 'Edit Credential' : 'New Credential'}</DialogTitle>
          <DialogDescription>
            Store sensitive information securely in the vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Production DB"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CredentialType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CREDENTIAL_TYPE_CONFIG).map(([t, c]) => (
                    <SelectItem key={t} value={t}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
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

          {/* Type-specific fields */}
          {(type === 'password' || type === 'database' || type === 'ssh' || type === 'generic') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
            </div>
          )}

          {type === 'api_key' && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
              />
            </div>
          )}

          {type === 'database' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="5432"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">Database</Label>
                <Input
                  id="database"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="mydb"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Credential Reveal Dialog
// ============================================================================

interface CredentialRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: CredentialWithData | null;
}

function CredentialRevealDialog({ open, onOpenChange, credential }: CredentialRevealDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!credential) return null;

  const { data } = credential;
  const config = CREDENTIAL_TYPE_CONFIG[credential.type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <config.icon className="h-4 w-4" />
            {credential.title}
          </DialogTitle>
          <DialogDescription>
            Click on a field to copy it to clipboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {data.username && (
            <div
              className="flex items-center justify-between p-3 rounded-md bg-muted cursor-pointer hover:bg-muted/80"
              onClick={() => copyToClipboard(data.username!, 'username')}
            >
              <div>
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="font-mono">{data.username}</p>
              </div>
              <Badge variant={copiedField === 'username' ? 'default' : 'outline'}>
                {copiedField === 'username' ? 'Copied!' : 'Click to copy'}
              </Badge>
            </div>
          )}

          {data.password && (
            <div
              className="flex items-center justify-between p-3 rounded-md bg-muted cursor-pointer hover:bg-muted/80"
              onClick={() => copyToClipboard(data.password!, 'password')}
            >
              <div>
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="font-mono">{'•'.repeat(12)}</p>
              </div>
              <Badge variant={copiedField === 'password' ? 'default' : 'outline'}>
                {copiedField === 'password' ? 'Copied!' : 'Click to copy'}
              </Badge>
            </div>
          )}

          {data.apiKey && (
            <div
              className="flex items-center justify-between p-3 rounded-md bg-muted cursor-pointer hover:bg-muted/80"
              onClick={() => copyToClipboard(data.apiKey!, 'apiKey')}
            >
              <div>
                <p className="text-xs text-muted-foreground">API Key</p>
                <p className="font-mono">{data.apiKey.slice(0, 8)}{'•'.repeat(20)}</p>
              </div>
              <Badge variant={copiedField === 'apiKey' ? 'default' : 'outline'}>
                {copiedField === 'apiKey' ? 'Copied!' : 'Click to copy'}
              </Badge>
            </div>
          )}

          {data.host && (
            <div className="flex items-center gap-4 p-3 rounded-md bg-muted">
              <div>
                <p className="text-xs text-muted-foreground">Host</p>
                <p className="font-mono">{data.host}</p>
              </div>
              {data.port && (
                <div>
                  <p className="text-xs text-muted-foreground">Port</p>
                  <p className="font-mono">{data.port}</p>
                </div>
              )}
              {data.database && (
                <div>
                  <p className="text-xs text-muted-foreground">Database</p>
                  <p className="font-mono">{data.database}</p>
                </div>
              )}
            </div>
          )}

          {data.notes && (
            <div className="p-3 rounded-md bg-muted">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{data.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function NotesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'notes' | 'vault'>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, _setProjectFilter] = useState<string | undefined>(undefined);

  // TanStack Query hooks for notes and projects
  const { data: notesData, isLoading: notesQueryLoading, refetch: refetchNotes } = useNotesList({ projectId: projectFilter });
  const { data: projectsData, isLoading: projectsLoading } = usePersonalProjectsList();
  
  // TanStack Query hooks for vault
  const { data: vaultStatusData, isLoading: vaultStatusLoading, refetch: refetchVaultStatus } = useVaultStatus();
  const vaultStatus = vaultStatusData ?? { isSetup: false, isUnlocked: false };
  const { data: credentialsData, isLoading: credentialsLoading, refetch: refetchCredentials } = useCredentialsList(
    undefined,
    { enabled: vaultStatus.isUnlocked }
  );
  
  // Local state for optimistic updates (synced with query data)
  const [localNotes, setNotes] = useState<Note[]>([]);
  const [localCredentials, setCredentials] = useState<Credential[]>([]);
  
  // Sync local state with query data
  useEffect(() => {
    if (notesData?.items) {
      setNotes(notesData.items);
    }
  }, [notesData?.items]);
  
  useEffect(() => {
    if (credentialsData?.items) {
      setCredentials(credentialsData.items);
    }
  }, [credentialsData?.items]);
  
  // Derive data
  const notes = localNotes.length > 0 || !notesData ? localNotes : (notesData?.items ?? []);
  const projects = projectsData?.items ?? [];
  const credentials = localCredentials.length > 0 || !credentialsData ? localCredentials : (credentialsData?.items ?? []);
  const notesLoading = notesQueryLoading || projectsLoading;
  const vaultLoading = vaultStatusLoading || credentialsLoading;
  
  // Combined refetch for vault
  const refetchVault = useCallback(async () => {
    await refetchVaultStatus();
    await refetchCredentials();
  }, [refetchVaultStatus, refetchCredentials]);
  
  const refreshStatus = refetchVaultStatus;

  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [urlNoteHandled, setUrlNoteHandled] = useState(false);

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Vault UI state
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [credentialFormOpen, setCredentialFormOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialWithData | null>(null);
  const [revealedCredential, setRevealedCredential] = useState<CredentialWithData | null>(null);
  const [deleteCredentialId, setDeleteCredentialId] = useState<string | null>(null);

  // Unsaved / navigation helpers (editor)
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingNoteToSelect, setPendingNoteToSelect] = useState<Note | null | undefined>(undefined);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  // Use an incremental id to request a save; avoids repeated boolean triggers
  const [saveRequestId, setSaveRequestId] = useState(0);
  const [navigateAfterSave, setNavigateAfterSave] = useState(false);

  // PiP window tracking - track which notes are open/editing in PiP windows
  const [pipOpenNotes, setPipOpenNotes] = useState<Set<string>>(new Set());
  const [pipEditingNotes, setPipEditingNotes] = useState<Set<string>>(new Set());

  // Listen for PiP window messages via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('note-pip-channel');
    
    const handleMessage = (event: MessageEvent) => {
      const { type, noteId, isEditing: pipEditing } = event.data;
      
      switch (type) {
        case 'pip-opened':
          setPipOpenNotes(prev => new Set(prev).add(noteId));
          break;
        case 'pip-closed':
          setPipOpenNotes(prev => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
          setPipEditingNotes(prev => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
          });
          break;
        case 'pip-editing':
          setPipEditingNotes(prev => {
            const next = new Set(prev);
            if (pipEditing) {
              next.add(noteId);
            } else {
              next.delete(noteId);
            }
            return next;
          });
          break;
        case 'note-updated':
          // Refresh notes list when PiP updates a note
          refetchNotes();
          break;
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [refetchNotes]);

  // Handle URL params to select a note from dashboard or external link
  useEffect(() => {
    if (urlNoteHandled || notesLoading || notes.length === 0) return;
    
    const noteIdParam = searchParams.get('noteId');
    if (noteIdParam) {
      const noteToSelect = notes.find(n => n.id === noteIdParam);
      if (noteToSelect) {
        setSelectedNote(noteToSelect);
        setActiveTab('notes');
        // Clear the URL param after selecting
        setSearchParams({}, { replace: true });
      }
      setUrlNoteHandled(true);
    }
  }, [searchParams, setSearchParams, notes, notesLoading, urlNoteHandled]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  // Note handlers
  const handleSaveNote = useCallback(
    async (id: string | null, data: { title: string; content: string; isPinned: boolean; projectId?: string }) => {
      try {
        if (id) {
          // Optimistic update: Update note in list immediately
          setNotes((prev) => prev.map((n) => 
            n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
          ));
          const savedNote = await notesApi.update(id, data);
          // Update selected note with fresh data from server
          if (savedNote?.note) {
            setSelectedNote(savedNote.note);
            // Notify PiP windows about the update
            const channel = new BroadcastChannel('note-pip-channel');
            channel.postMessage({ type: 'note-updated', noteId: id });
            channel.close();
          }
          // Invalidate dashboard notes query so it reflects pinned changes
          queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
        } else {
          const savedNote = await notesApi.create(data);
          // Add new note to list and set as selected
          if (savedNote?.note) {
            setNotes((prev) => [savedNote.note, ...prev]);
            setSelectedNote(savedNote.note);
          }
          // Invalidate dashboard notes query
          queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
        }
      } catch (error) {
        console.error('Failed to save note:', error);
        // Rollback: refetch to restore state on error
        refetchNotes();
      }
    },
    [setNotes, refetchNotes, queryClient]
  );

  const handleDeleteNote = useCallback(async () => {
    if (!deleteNoteId) return;
    
    // Optimistic update: Remove note from UI immediately
    const noteToDelete = deleteNoteId;
    setNotes((prev) => prev.filter((n) => n.id !== noteToDelete));
    
    // Clear selection if deleted note was selected
    if (selectedNote?.id === noteToDelete) {
      setSelectedNote(null);
      setIsEditing(false);
    }
    setDeleteNoteId(null);
    
    try {
      // Delete from server in background
      await notesApi.delete(noteToDelete);
      // Invalidate dashboard notes query
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    } catch (error) {
      console.error('Failed to delete note:', error);
      // Rollback: refetch to restore state on error
      refetchNotes();
    }
  }, [deleteNoteId, selectedNote, setNotes, refetchNotes, queryClient]);

  // Handle Note Popout
  const handlePopout = useCallback(() => {
    if (!selectedNote) return;
    
    // If PiP is already open for this note, request focus via BroadcastChannel
    if (pipOpenNotes.has(selectedNote.id)) {
      const channel = new BroadcastChannel('note-pip-channel');
      channel.postMessage({ type: 'request-focus', noteId: selectedNote.id });
      channel.close();
      return;
    }
    
    const width = 800;
    const height = 900;
    const popoutUrl = `/popout/notes/${selectedNote.id}`;
    
    // In Electron, use the native window API for proper desktop app behavior
    // Check if we're in Electron by checking for window.api
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
  }, [selectedNote, pipOpenNotes]);

  // Attempt to select a note; if editor is open with unsaved changes, prompt
  const attemptSelectNote = (note: Note | null) => {
    // If same note, no-op
    if (note?.id && selectedNote?.id === note.id) return;

    if (isEditing && editorDirty) {
      setPendingNoteToSelect(note);
      setUnsavedDialogOpen(true);
      return;
    }

    // Safe to switch
    setSelectedNote(note);
    // If user requested a new note (note === null), open editor; otherwise show note in read-only mode
    setIsEditing(note === null ? true : false);
    setEditorDirty(false);
  };

  const handleDiscardAndContinue = () => {
    setUnsavedDialogOpen(false);
    setEditorDirty(false);
    setSelectedNote(pendingNoteToSelect ?? null);
    // If destination is new note (null) we should open editor for creation
    setIsEditing(pendingNoteToSelect == null ? true : false);
    setPendingNoteToSelect(undefined);
  };

  const handleSaveAndContinue = () => {
    setUnsavedDialogOpen(false);
    // increment token so child runs save exactly once per token
    setSaveRequestId((id) => id + 1);
    setNavigateAfterSave(true);
  };

  // Vault handlers
  const handleSetupVault = useCallback(
    async (password: string) => {
      await vaultApi.setup({ masterPassword: password });
      await refreshStatus();
      refetchVault();
    },
    [refreshStatus, refetchVault]
  );

  const handleUnlockVault = useCallback(
    async (password: string) => {
      await vaultApi.unlock({ masterPassword: password });
      await refreshStatus();
      refetchVault();
    },
    [refreshStatus, refetchVault]
  );

  const handleLockVault = useCallback(async () => {
    await vaultApi.lock();
    await refreshStatus();
    setCredentials([]);
  }, [refreshStatus, setCredentials]);

  const handleSaveCredential = useCallback(
    async (data: { title: string; type: CredentialType; projectId?: string; data: CredentialData }) => {
      if (editingCredential) {
        await credentialsApi.update(editingCredential.id, data);
      } else {
        await credentialsApi.create(data);
      }
      refetchVault();
      setEditingCredential(null);
    },
    [editingCredential, refetchVault]
  );

  const handleRevealCredential = useCallback(async (id: string) => {
    const res = await credentialsApi.reveal(id);
    setRevealedCredential(res.credential);
  }, []);

  const handleEditCredential = useCallback(async (id: string) => {
    const res = await credentialsApi.reveal(id);
    setEditingCredential(res.credential);
    setCredentialFormOpen(true);
  }, []);

  const handleDeleteCredential = useCallback(async () => {
    if (!deleteCredentialId) return;
    await credentialsApi.delete(deleteCredentialId);
    setCredentials((prev) => prev.filter((c) => c.id !== deleteCredentialId));
    setDeleteCredentialId(null);
  }, [deleteCredentialId, setCredentials]);

  return (
    <AppPage
      title="Notes & Vault"
      description="Manage notes and secure credentials"
      actions={
        <div className="flex items-center gap-2">
          {activeTab === 'notes' && (
            <Button
              size="sm"
              onClick={() => attemptSelectNote(null)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          )}
          {activeTab === 'vault' && vaultStatus.isUnlocked && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLockVault}
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                Lock Vault
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingCredential(null);
                  setCredentialFormOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Credential
              </Button>
            </>
          )}
        </div>
      }
    >
      <AppPageContent className="flex flex-col h-full overflow-hidden">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'vault')} className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <TabsList>
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="vault" className="gap-2">
                <Key className="h-4 w-4" />
                Vault
                {vaultStatus.isUnlocked && <LockOpen className="h-3 w-3 text-green-500" />}
                {vaultStatus.isSetup && !vaultStatus.isUnlocked && <Lock className="h-3 w-3 text-orange-500" />}
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8 w-64"
              />
            </div>
          </div>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 flex overflow-hidden m-0">
            {notesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Notes List Sidebar - uses data-state for stable animation */}
                <div 
                  data-state={sidebarCollapsed ? 'collapsed' : 'expanded'}
                  className="group/notes-sidebar flex flex-col border rounded-lg shrink-0 overflow-hidden transition-[width] duration-200 ease-linear data-[state=collapsed]:w-12 data-[state=expanded]:w-80"
                > 
                  <div className="h-12 border-b bg-muted/30 flex items-center shrink-0 px-2 overflow-hidden">
                    <h3 className="flex-1 text-sm font-medium whitespace-nowrap truncate min-w-0 transition-all duration-200 ease-linear group-data-[state=collapsed]/notes-sidebar:w-0 group-data-[state=collapsed]/notes-sidebar:opacity-0">
                      All Notes ({filteredNotes.length})
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setSidebarCollapsed((v) => !v)}
                      aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                      {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-1">
                      {filteredNotes.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => attemptSelectNote(note)}
                          className={`flex w-full items-center gap-2 p-2 text-left text-sm transition-all duration-200 ease-linear hover:bg-muted/80 min-h-[2.8125rem] ${
                            selectedNote?.id === note.id ? 'bg-muted' : ''
                          }`}
                          title={note.title}
                        >
                          <div className="shrink-0 flex items-center ml-2">
                            {note.isPinned ? (
                              <Pin className="h-4 w-4 text-primary" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden transition-all duration-200 ease-linear opacity-100 max-h-20 group-data-[state=collapsed]/notes-sidebar:w-0 group-data-[state=collapsed]/notes-sidebar:opacity-0 group-data-[state=collapsed]/notes-sidebar:max-h-0">
                            <p className="font-medium truncate">{note.title}</p>
                            <p className="text-xs text-muted-foreground truncate opacity-80">
                              {note.content?.slice(0, 50) || 'No content'}
                            </p>
                            {note.project && (
                              <Badge variant="secondary" className="text-[10px] gap-1 w-fit mt-1">
                                <FolderOpen className="h-2.5 w-2.5" />
                                {note.project.title}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                      {filteredNotes.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-50 icon-scale-transition" />
                          <p className="mt-2 text-xs overflow-hidden transition-all duration-200 ease-linear group-data-[state=collapsed]/notes-sidebar:w-0 group-data-[state=collapsed]/notes-sidebar:opacity-0 group-data-[state=collapsed]/notes-sidebar:h-0">
                            No notes yet
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Note Preview / Editor */}
                <div className="flex-1 border rounded-lg overflow-hidden">
                  {isEditing ? (
                    <NoteEditor
                      note={selectedNote}
                      projects={projects}
                      onSave={handleSaveNote}
                      onClose={() => setIsEditing(false)}
                      onDirtyChange={setEditorDirty}
                      saveRequestId={saveRequestId}
                      onSaveCompleted={() => {
                        // clear the pending save token
                        setSaveRequestId(0);
                        if (navigateAfterSave) {
                          setSelectedNote(pendingNoteToSelect ?? null);
                          // If destination is new note (null) open editor, else show note read-only
                          setIsEditing(pendingNoteToSelect == null ? true : false);
                          setNavigateAfterSave(false);
                          setPendingNoteToSelect(undefined);
                          setEditorDirty(false);
                        }
                      }}
                      onPopout={handlePopout}
                    />
                  ) : (
                    <NoteViewer
                      note={selectedNote}
                      onEdit={() => setIsEditing(true)}
                      onDelete={(id) => setDeleteNoteId(id)}
                      onPopout={handlePopout}
                      isPipOpen={selectedNote ? pipOpenNotes.has(selectedNote.id) : false}
                      isPipEditing={selectedNote ? pipEditingNotes.has(selectedNote.id) : false}
                    />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Vault Tab */}
          <TabsContent value="vault" className="flex-1 flex flex-col overflow-hidden m-0">
            {vaultLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !vaultStatus.isSetup ? (
              <div className="flex-1 flex items-center justify-center">
                <Card className="w-96">
                  <CardHeader className="text-center">
                    <Lock className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <CardTitle>Setup Vault</CardTitle>
                    <CardDescription>
                      Create a master password to protect your credentials. This password cannot be
                      recovered if lost.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Button onClick={() => setSetupDialogOpen(true)} className="gap-2">
                      <Key className="h-4 w-4" />
                      Setup Vault
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : !vaultStatus.isUnlocked ? (
              <div className="flex-1 flex items-center justify-center">
                <Card className="w-96">
                  <CardHeader className="text-center">
                    <Lock className="h-12 w-12 mx-auto mb-2 text-orange-500" />
                    <CardTitle>Vault Locked</CardTitle>
                    <CardDescription>
                      Enter your master password to access your credentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Button onClick={() => setUnlockDialogOpen(true)} className="gap-2">
                      <Unlock className="h-4 w-4" />
                      Unlock Vault
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                  {credentials.map((cred) => {
                    const config = CREDENTIAL_TYPE_CONFIG[cred.type];
                    return (
                      <Card key={cred.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4 text-muted-foreground" />
                              <CardTitle className="text-base">{cred.title}</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                          {cred.project && (
                            <Badge variant="secondary" className="text-[10px] w-fit gap-1">
                              <FolderOpen className="h-2 w-2" />
                              {cred.project.title}
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="pt-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-2"
                              onClick={() => handleRevealCredential(cred.id)}
                            >
                              <Eye className="h-3 w-3" />
                              Reveal
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditCredential(cred.id)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteCredentialId(cred.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {credentials.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No credentials stored yet</p>
                      <Button
                        variant="link"
                        onClick={() => {
                          setEditingCredential(null);
                          setCredentialFormOpen(true);
                        }}
                      >
                        Add your first credential
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </AppPageContent>

      {/* Dialogs */}
      <VaultSetupDialog
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        onSetup={handleSetupVault}
      />

      <VaultSetupDialog
        open={unlockDialogOpen}
        onOpenChange={setUnlockDialogOpen}
        onSetup={handleUnlockVault}
        isUnlock
      />

      <CredentialFormDialog
        open={credentialFormOpen}
        onOpenChange={setCredentialFormOpen}
        credential={editingCredential}
        projects={projects}
        onSave={handleSaveCredential}
      />

      <CredentialRevealDialog
        open={!!revealedCredential}
        onOpenChange={(open) => !open && setRevealedCredential(null)}
        credential={revealedCredential}
      />

      {/* Delete Note Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteNoteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNote} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Confirmation */}
      <AlertDialog open={unsavedDialogOpen} onOpenChange={(open) => !open && setUnsavedDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the editor. Do you want to save them before switching notes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUnsavedDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndContinue} className="mr-2">Discard</AlertDialogAction>
            <AlertDialogAction onClick={() => { handleSaveAndContinue(); setUnsavedDialogOpen(false); }} className="bg-primary">Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Credential Confirmation */}
      <AlertDialog open={!!deleteCredentialId} onOpenChange={() => setDeleteCredentialId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this credential? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCredential}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}

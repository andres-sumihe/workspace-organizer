import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import CodeMirror from '@uiw/react-codemirror';
import {
  Eye,
  FileText,
  FolderOpen,
  Key,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Unlock
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import type {
  Note,
  Credential,
  CredentialWithData,
  CredentialType,
  PersonalProject,
  CredentialData
} from '@workspace/shared';

import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

import { personalProjectsApi } from '@/api/journal';
import { notesApi, credentialsApi, vaultApi } from '@/api/notes-vault';
import { AppPage, AppPageContent } from '@/components/layout/app-page';
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

// Memoized markdown components configuration
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

// Memoized remark/rehype plugin arrays to prevent recreation
const remarkPlugins: Parameters<typeof Markdown>[0]['remarkPlugins'] = [
  remarkGfm,
  remarkMath,
  remarkDeflist,
  [remarkEmoji, { emoticon: true }], // Enable emoticon conversion :-) :D <3
  remarkSupersub,           // H~2~O for subscript, x^2^ for superscript
  remarkFlexibleMarkers,    // ==highlighted text==
  remarkIns,                // ++inserted text++
  remarkFlexibleContainers, // ::: note/warning/tip containers
];
const rehypePlugins = [rehypeRaw, rehypeHighlight, rehypeKatex];

// ============================================================================
// Hooks
// ============================================================================

function useNotesData(projectFilter?: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  const [error, setError] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);

  // Migration: Sync personal project notes to Notes feature (run once)
  const migrateProjectNotes = useCallback(async () => {
    if (migrated) return;
    try {
      const projectsRes = await personalProjectsApi.list();
      const projectsWithNotes = projectsRes.items.filter(p => p.notes && p.notes.trim());
      
      for (const project of projectsWithNotes) {
        // Check if a note already exists for this project
        const existingNotes = await notesApi.list({ projectId: project.id });
        if (existingNotes.items.length === 0) {
          // Create a note from the project notes
          await notesApi.create({
            title: `${project.title} Notes`,
            content: project.notes!,
            projectId: project.id,
            isPinned: false
          });
        }
      }
      setMigrated(true);
    } catch (err) {
      console.error('Failed to migrate project notes:', err);
    }
  }, [migrated]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [notesRes, projectsRes] = await Promise.all([
        notesApi.list({ projectId: projectFilter }),
        personalProjectsApi.list()
      ]);
      setNotes(notesRes.items);
      setProjects(projectsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter]);

  useEffect(() => {
    migrateProjectNotes().then(() => fetchData());
  }, [migrateProjectNotes, fetchData]);

  return { notes, projects, isLoading, error, refetch: fetchData, setNotes };
}

function useVaultData() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [vaultStatus, setVaultStatus] = useState<{ isSetup: boolean; isUnlocked: boolean }>({
    isSetup: false,
    isUnlocked: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await vaultApi.getStatus();
      setVaultStatus(status);
      return status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get vault status');
      return null;
    }
  }, []);

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await credentialsApi.list();
      setCredentials(res.items);
    } catch {
      // Credentials list might fail if vault is locked - that's okay
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const status = await fetchStatus();
    if (status?.isUnlocked) {
      await fetchCredentials();
    }
    setIsLoading(false);
  }, [fetchStatus, fetchCredentials]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    credentials,
    vaultStatus,
    isLoading,
    error,
    refetch: fetchData,
    refreshStatus: fetchStatus,
    setCredentials
  };
}

// ============================================================================
// Note Editor Component
// ============================================================================

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
}

function NoteEditor({ note, projects, onSave, onClose, onDirtyChange, saveRequestId, onSaveCompleted }: NoteEditorProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [projectId, setProjectId] = useState<string>(note?.projectId ?? 'none');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const initialRef = React.useRef({ title: note?.title ?? '', content: note?.content ?? '', isPinned: note?.isPinned ?? false, projectId: note?.projectId ?? 'none' });
  const dirty = title !== initialRef.current.title || content !== initialRef.current.content || isPinned !== initialRef.current.isPinned || projectId !== initialRef.current.projectId;

  const editorTheme = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }, [theme]);

  const extensions = useMemo(() => [markdown({ codeLanguages: languages })], []);

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

      if (closeAfterSave) onClose();
    } finally {
      setIsSaving(false);
    }
  }, [note?.id, title, content, isPinned, projectId, onSave, onClose, onDirtyChange]);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
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
            <div className="p-6 prose prose-slate dark:prose-invert max-w-none">
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
            className="h-full"
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => handleSave()} disabled={isSaving || !title.trim()}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<'notes' | 'vault'>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, _setProjectFilter] = useState<string | undefined>(undefined);

  // Notes state
  const { notes, projects, isLoading: notesLoading, refetch: refetchNotes, setNotes } = useNotesData(projectFilter);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  // Vault state
  const { credentials, vaultStatus, isLoading: vaultLoading, refetch: refetchVault, refreshStatus, setCredentials } = useVaultData();
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
          }
        } else {
          const savedNote = await notesApi.create(data);
          // Add new note to list and set as selected
          if (savedNote?.note) {
            setNotes((prev) => [savedNote.note, ...prev]);
            setSelectedNote(savedNote.note);
          }
        }
      } catch (error) {
        console.error('Failed to save note:', error);
        // Rollback: refetch to restore state on error
        refetchNotes();
      }
    },
    [setNotes, refetchNotes]
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
    } catch (error) {
      console.error('Failed to delete note:', error);
      // Rollback: refetch to restore state on error
      refetchNotes();
    }
  }, [deleteNoteId, selectedNote, setNotes, refetchNotes]);

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
    setIsEditing(false);
    setEditorDirty(false);
  };

  const handleDiscardAndContinue = () => {
    setUnsavedDialogOpen(false);
    setEditorDirty(false);
    setSelectedNote(pendingNoteToSelect ?? null);
    setIsEditing(false);
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
                {/* Notes List */}
                <div className="w-80 border rounded-lg overflow-hidden flex flex-col">
                  <div className="p-3 border-b bg-muted/30">
                    <h3 className="text-sm font-medium">All Notes ({filteredNotes.length})</h3>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {filteredNotes.map((note) => (
                        <div
                          key={note.id}
                          className={`p-3 rounded-md cursor-pointer hover:bg-muted/80 transition-colors ${
                            selectedNote?.id === note.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => attemptSelectNote(note)}
                        >
                          <div className="flex items-start gap-2">
                            {note.isPinned && <Pin className="h-3 w-3 text-primary shrink-0 mt-1" />}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{note.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {note.content.slice(0, 50) || 'No content'}
                              </p>
                              {note.project && (
                                <Badge variant="secondary" className="text-[10px] mt-1 gap-1">
                                  <FolderOpen className="h-2 w-2" />
                                  {note.project.title}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredNotes.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No notes yet</p>
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
                          setIsEditing(false);
                          setNavigateAfterSave(false);
                          setPendingNoteToSelect(undefined);
                          setEditorDirty(false);
                        }
                      }}
                    />
                  ) : selectedNote ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between p-4 border-b">
                        <div className="flex items-center gap-2">
                          {selectedNote.isPinned && <Pin className="h-4 w-4 text-primary" />}
                          <h2 className="text-[14px] font-semibold">{selectedNote.title}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteNoteId(selectedNote.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-6 prose prose-slate dark:prose-invert max-w-none">
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
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Select a note to view</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Vault Tab */}
          <TabsContent value="vault" className="flex-1 overflow-hidden m-0">
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

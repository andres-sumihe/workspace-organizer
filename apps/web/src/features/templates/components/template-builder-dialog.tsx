import { Loader2, Trash2 } from 'lucide-react';

import type { BuilderMeta, EditableFile, EditableFolder, EditableToken } from '../types';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TemplateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  builderForm: UseFormReturn<BuilderMeta>;
  folders: EditableFolder[];
  files: EditableFile[];
  tokens: EditableToken[];
  onAddFolder: () => void;
  onUpdateFolder: (id: string, value: string) => void;
  onRemoveFolder: (id: string) => void;
  onAddFile: () => void;
  onUpdateFile: (id: string, patch: Partial<EditableFile>) => void;
  onRemoveFile: (id: string) => void;
  onAddToken: () => void;
  onUpdateToken: (id: string, patch: Partial<EditableToken>) => void;
  onRemoveToken: (id: string) => void;
  builderError: string | null;
  builderLoading: boolean;
  builderSaving: boolean;
  onSave: () => void;
  title: string;
}

export const TemplateBuilderDialog = ({
  open,
  onOpenChange,
  builderForm,
  folders,
  files,
  tokens,
  onAddFolder,
  onUpdateFolder,
  onRemoveFolder,
  onAddFile,
  onUpdateFile,
  onRemoveFile,
  onAddToken,
  onUpdateToken,
  onRemoveToken,
  builderError,
  builderLoading,
  builderSaving,
  onSave,
  title
}: TemplateBuilderDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Define folders, files, and tokens to scaffold future projects.</DialogDescription>
      </DialogHeader>
      {builderLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading template...
        </div>
      ) : (
        <div className="space-y-4">
          {builderError ? <p className="text-xs text-destructive">{builderError}</p> : null}
          <Form {...builderForm}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={builderForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Template name" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={builderForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional description" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </Form>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Folders</p>
                <p className="text-xs text-muted-foreground">Relative to the project root.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={onAddFolder}>
                Add folder
              </Button>
            </div>
            <div className="space-y-2">
              {folders.map((folder) => (
                <div key={folder.id} className="flex gap-2">
                  <Input value={folder.path} onChange={(event) => onUpdateFolder(folder.id, event.target.value)} placeholder="src/docs" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveFolder(folder.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {folders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No folders yet. Add one to create directory structure.</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Files</p>
                <p className="text-xs text-muted-foreground">Provide relative paths and starter contents.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={onAddFile}>
                Add file
              </Button>
            </div>
            <div className="space-y-4">
              {files.map((file) => (
                <div key={file.id} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex gap-2">
                    <Input value={file.path} onChange={(event) => onUpdateFile(file.id, { path: event.target.value })} placeholder="README.md" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveFile(file.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    value={file.content}
                    onChange={(event) => onUpdateFile(file.id, { content: event.target.value })}
                    placeholder="# Hello template"
                  />
                </div>
              ))}
              {files.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add files to pre-populate content for new projects.</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tokens</p>
                <p className="text-xs text-muted-foreground">Reference tokens with Mustache syntax (e.g. {'{{clientName}}'}).</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={onAddToken}>
                Add token
              </Button>
            </div>
            <div className="space-y-2">
              {tokens.map((token) => (
                <div key={token.id} className="grid gap-2 md:grid-cols-3">
                  <Input value={token.key} onChange={(event) => onUpdateToken(token.id, { key: event.target.value })} placeholder="clientName" />
                  <Input value={token.label} onChange={(event) => onUpdateToken(token.id, { label: event.target.value })} placeholder="Label" />
                  <div className="flex gap-2">
                    <Input
                      value={token.defaultValue}
                      onChange={(event) => onUpdateToken(token.id, { defaultValue: event.target.value })}
                      placeholder="Default value"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveToken(token.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {tokens.length === 0 ? <p className="text-xs text-muted-foreground">Tokens help personalize templates during apply.</p> : null}
            </div>
          </section>
        </div>
      )}
      <DialogFooter className="mt-4">
        <Button type="button" onClick={onSave} disabled={builderSaving || builderLoading}>
          {builderSaving ? 'Saving...' : 'Save template'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

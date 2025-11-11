import { Loader2 } from 'lucide-react';

import type { TemplateSummary } from '@/types/desktop';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

interface WorkspaceTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateSummary[];
  loading: boolean;
  draft: string[];
  onToggleTemplate: (templateId: string, checked: boolean) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}

export const WorkspaceTemplatesDialog = ({
  open,
  onOpenChange,
  templates,
  loading,
  draft,
  onToggleTemplate,
  onSave,
  saving,
  error
}: WorkspaceTemplatesDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Workspace templates</DialogTitle>
        <DialogDescription>Select global templates offered when creating new projects in this workspace.</DialogDescription>
      </DialogHeader>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates available yet. Capture or create one first.</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {templates.map((tpl) => {
            const checked = draft.includes(tpl.id);
            return (
              <label key={tpl.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked} onChange={(event) => onToggleTemplate(tpl.id, event.target.checked)} />
                <span>{tpl.name}</span>
              </label>
            );
          })}
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" onClick={onSave} disabled={saving || templates.length === 0}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

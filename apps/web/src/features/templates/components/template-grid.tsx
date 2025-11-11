import { FileArchive, Loader2, PenSquare, Trash2 } from 'lucide-react';

import type { TemplateSummary } from '@/types/desktop';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TemplateGridProps {
  templates: Array<TemplateSummary & { createdDate: string }>;
  loading: boolean;
  onEdit: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export const TemplateGrid = ({ templates, loading, onEdit, onDelete }: TemplateGridProps) => {
  if (loading && templates.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading templates...
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <div key={template.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{template.name}</p>
              <p className="text-xs text-muted-foreground">{template.createdDate}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(template.id)}>
                <PenSquare className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDelete(template.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <p className="line-clamp-3 text-xs text-muted-foreground">{template.description || 'No description.'}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-1">
              <FileArchive className="size-3" />
              {template.fileCount ?? 0} files
            </Badge>
            <Badge variant="outline">{template.folderCount ?? 0} folders</Badge>
          </div>
        </div>
      ))}
      {templates.length === 0 && !loading ? (
        <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No templates yet. Capture an existing folder or create one from scratch to get started.
        </div>
      ) : null}
    </div>
  );
};

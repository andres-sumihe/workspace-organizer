import {
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import type { ChecklistTemplateSummary, ProjectChecklistItem } from '@workspace/shared';
import type { UpdateProjectChecklistItemRequest } from '@workspace/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { checklistTemplatesApi, projectChecklistsApi } from '@/features/checklists/api/checklist-templates';
import {
  useActivateLocalChecklistTemplate,
  useActivateTeamChecklistTemplate,
  useCreateLocalProjectChecklistItem,
  useCreateTeamProjectChecklistItem,
  useDeleteLocalProjectChecklistItem,
  useDeleteTeamProjectChecklistItem,
  useGenerateLocalProjectChecklist,
  useGenerateTeamProjectChecklist,
  useLocalChecklistTemplates,
  useLocalProjectChecklist,
  useTeamChecklistTemplates,
  useTeamProjectChecklist,
  useUpdateLocalProjectChecklistItem,
  useUpdateTeamProjectChecklistItem,
  useUploadLocalChecklistTemplate,
  useUploadTeamChecklistTemplate,
} from '@/features/checklists/hooks/use-checklist-templates';


interface ChecklistTemplatePanelProps {
  mode: 'local' | 'team';
  projectId: string;
  teamId?: string;
  projectTitle: string;
}

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const groupItemsBySection = (items: ProjectChecklistItem[]) => {
  const grouped = new Map<string, ProjectChecklistItem[]>();
  for (const item of items) {
    const sectionItems = grouped.get(item.sectionId) ?? [];
    sectionItems.push(item);
    grouped.set(item.sectionId, sectionItems);
  }
  return grouped;
};

interface ItemGroup {
  key: string;
  title: string | null;
  items: ProjectChecklistItem[];
}

interface RowDraft {
  title: string;
  plannedDate: string;
  plannedTime: string;
  location: string;
  pic: string;
}

type WorksheetField = 'plannedDate' | 'plannedTime' | 'location' | 'pic';

const emptyRowDraft: RowDraft = {
  title: '',
  plannedDate: '',
  plannedTime: '',
  location: '',
  pic: '',
};

const draftKeyFor = (sectionId: string, groupTitle: string | null) => `${sectionId}:${groupTitle ?? ''}`;

const groupItemsByWorksheetGroup = (items: ProjectChecklistItem[]): ItemGroup[] => {
  const groups: ItemGroup[] = [];
  const groupsByKey = new Map<string, ItemGroup>();

  for (const item of items) {
    const title = item.groupTitle?.trim() || null;
    const key = title ?? '__ungrouped__';
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, title, items: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  if (!groupsByKey.has('__ungrouped__')) {
    groups.unshift({ key: '__ungrouped__', title: null, items: [] });
  }

  return groups;
};

const mergeDraftGroups = (groups: ItemGroup[], draftTitles: string[]): ItemGroup[] => {
  const existing = new Set(groups.map((group) => group.title?.trim().toLocaleLowerCase()).filter(Boolean));
  const draftGroups = draftTitles.flatMap((title) => {
    const normalized = title.trim();
    if (!normalized || existing.has(normalized.toLocaleLowerCase())) return [];
    existing.add(normalized.toLocaleLowerCase());
    return [{ key: `draft:${normalized}`, title: normalized, items: [] }];
  });
  return [...groups, ...draftGroups];
};

const getWorksheetFieldValue = (item: ProjectChecklistItem, field: WorksheetField): string => {
  switch (field) {
    case 'plannedDate':
      return item.plannedDate ?? '';
    case 'plannedTime':
      return item.plannedTime ?? '';
    case 'location':
      return item.location ?? '';
    case 'pic':
      return item.pic ?? '';
  }
};

const buildWorksheetFieldPayload = (field: WorksheetField, value: string | null): UpdateProjectChecklistItemRequest => {
  switch (field) {
    case 'plannedDate':
      return { plannedDate: value };
    case 'plannedTime':
      return { plannedTime: value };
    case 'location':
      return { location: value };
    case 'pic':
      return { pic: value };
  }
};

const updateDraftField = (draft: RowDraft, field: keyof RowDraft, value: string): RowDraft => {
  switch (field) {
    case 'title':
      return { ...draft, title: value };
    case 'plannedDate':
      return { ...draft, plannedDate: value };
    case 'plannedTime':
      return { ...draft, plannedTime: value };
    case 'location':
      return { ...draft, location: value };
    case 'pic':
      return { ...draft, pic: value };
  }
};

export function ChecklistTemplatePanel({ mode, projectId, teamId, projectTitle }: ChecklistTemplatePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);
  const [exportingChecklist, setExportingChecklist] = useState(false);
  const [rowDrafts, setRowDrafts] = useState(() => new Map<string, RowDraft>());
  const [subheaderDrafts, setSubheaderDrafts] = useState(() => new Map<string, string>());
  const [emptyGroupsBySection, setEmptyGroupsBySection] = useState(() => new Map<string, string[]>());

  const localTemplates = useLocalChecklistTemplates();
  const teamTemplates = useTeamChecklistTemplates(mode === 'team' ? teamId ?? null : null);
  const localChecklist = useLocalProjectChecklist(projectId);
  const teamChecklist = useTeamProjectChecklist(mode === 'team' ? teamId ?? null : null, projectId);
  const uploadLocal = useUploadLocalChecklistTemplate();
  const uploadTeam = useUploadTeamChecklistTemplate(teamId ?? '');
  const activateLocal = useActivateLocalChecklistTemplate();
  const activateTeam = useActivateTeamChecklistTemplate(teamId ?? '');
  const generateLocal = useGenerateLocalProjectChecklist(projectId);
  const generateTeam = useGenerateTeamProjectChecklist(teamId ?? '', projectId);
  const updateLocalItem = useUpdateLocalProjectChecklistItem(projectId);
  const updateTeamItem = useUpdateTeamProjectChecklistItem(teamId ?? '', projectId);
  const createLocalItem = useCreateLocalProjectChecklistItem(projectId);
  const createTeamItem = useCreateTeamProjectChecklistItem(teamId ?? '', projectId);
  const deleteLocalItem = useDeleteLocalProjectChecklistItem(projectId);
  const deleteTeamItem = useDeleteTeamProjectChecklistItem(teamId ?? '', projectId);

  const templatesQuery = mode === 'team' ? teamTemplates : localTemplates;
  const checklistQuery = mode === 'team' ? teamChecklist : localChecklist;
  const uploadMutation = mode === 'team' ? uploadTeam : uploadLocal;
  const activateMutation = mode === 'team' ? activateTeam : activateLocal;
  const generateMutation = mode === 'team' ? generateTeam : generateLocal;
  const updateMutation = mode === 'team' ? updateTeamItem : updateLocalItem;
  const createMutation = mode === 'team' ? createTeamItem : createLocalItem;
  const deleteMutation = mode === 'team' ? deleteTeamItem : deleteLocalItem;

  const templates = templatesQuery.data?.items ?? [];
  const activeTemplate = templates.find((template) => template.isActive);
  const checklist = checklistQuery.data?.checklist ?? null;
  const itemsBySection = groupItemsBySection(checklist?.items ?? []);
  const isBusy = uploadMutation.isPending || activateMutation.isPending || generateMutation.isPending || updateMutation.isPending || createMutation.isPending || deleteMutation.isPending;

  const updateRowDraft = (key: string, field: keyof RowDraft, value: string) => {
    setRowDrafts((current) => {
      const next = new Map(current);
      next.set(key, updateDraftField(next.get(key) ?? emptyRowDraft, field, value));
      return next;
    });
  };

  const resetRowDraft = (key: string) => {
    setRowDrafts((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const updateSubheaderDraft = (sectionId: string, value: string) => {
    setSubheaderDrafts((current) => {
      const next = new Map(current);
      next.set(sectionId, value);
      return next;
    });
  };

  const resetSubheaderDraft = (sectionId: string) => {
    setSubheaderDrafts((current) => {
      const next = new Map(current);
      next.delete(sectionId);
      return next;
    });
  };

  const removeEmptyGroup = (sectionId: string, title: string) => {
    setEmptyGroupsBySection((current) => {
      const next = new Map(current);
      const titles = (next.get(sectionId) ?? []).filter((item) => item !== title);
      if (titles.length > 0) next.set(sectionId, titles);
      else next.delete(sectionId);
      return next;
    });
    resetRowDraft(draftKeyFor(sectionId, title));
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setVersionLabel('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Choose an XLSX template first');
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        file,
        name,
        description,
        versionLabel,
        activate: true,
      });
      toast.success('Checklist template stored privately');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload checklist template');
    }
  };

  const handleActivate = async (template: ChecklistTemplateSummary) => {
    const versionId = template.activeVersion?.id;
    if (!versionId) return;

    try {
      await activateMutation.mutateAsync({ templateId: template.id, versionId });
      toast.success('Checklist template activated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to activate checklist template');
    }
  };

  const handleDownloadTemplate = async (template: ChecklistTemplateSummary) => {
    const version = template.activeVersion;
    if (!version) return;

    try {
      setDownloadingVersionId(version.id);
      const result = mode === 'team' && teamId
        ? await checklistTemplatesApi.downloadTeam(teamId, template.id, version.id)
        : await checklistTemplatesApi.downloadLocal(template.id, version.id);
      downloadBlob(result.blob, result.filename ?? version.originalFilename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download checklist template');
    } finally {
      setDownloadingVersionId(null);
    }
  };

  const handleGenerate = async (overwrite: boolean) => {
    if (!activeTemplate?.activeVersion) {
      toast.error('Upload an active checklist template first');
      return;
    }

    try {
      await generateMutation.mutateAsync({ overwrite });
      toast.success(overwrite ? 'Checklist regenerated' : 'Checklist generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate checklist');
    }
  };

  const handleUpdateItem = async (itemId: string, payload: UpdateProjectChecklistItemRequest) => {
    try {
      await updateMutation.mutateAsync({ itemId, payload });
      toast.success('Checklist item updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update checklist item');
    }
  };

  const handleUpdateTitle = (item: ProjectChecklistItem, value: string) => {
    const title = value.trim();
    if (!title || title === item.title) return;
    void handleUpdateItem(item.id, { title });
  };

  const handleUpdateWorksheetField = (item: ProjectChecklistItem, field: WorksheetField, value: string) => {
    const nextValue = value.trim();
    const currentValue = getWorksheetFieldValue(item, field);
    if (nextValue === currentValue) return;
    void handleUpdateItem(item.id, buildWorksheetFieldPayload(field, nextValue || null));
  };

  const handleAddSubheader = (sectionId: string, groups: ItemGroup[]) => {
    const title = (subheaderDrafts.get(sectionId) ?? '').trim();
    if (!title) {
      toast.error('Sub header name is required');
      return;
    }

    const existing = new Set(groups.map((group) => group.title?.trim().toLocaleLowerCase()).filter(Boolean));
    if (existing.has(title.toLocaleLowerCase())) {
      toast.error('Sub header already exists in this section');
      return;
    }

    setEmptyGroupsBySection((current) => {
      const next = new Map(current);
      next.set(sectionId, [...(next.get(sectionId) ?? []), title]);
      return next;
    });
    resetSubheaderDraft(sectionId);
  };

  const handleUpdateSubheader = async (sectionId: string, group: ItemGroup, value: string) => {
    const title = value.trim();
    if (!group.title) return;

    if (!title) {
      await handleRemoveSubheader(sectionId, group);
      return;
    }

    if (title === group.title) return;

    if (group.items.length === 0) {
      setEmptyGroupsBySection((current) => {
        const next = new Map(current);
        next.set(sectionId, (next.get(sectionId) ?? []).map((item) => item === group.title ? title : item));
        return next;
      });
      return;
    }

    try {
      await Promise.all(group.items.map((item) => updateMutation.mutateAsync({ itemId: item.id, payload: { groupTitle: title } })));
      toast.success('Sub header updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update sub header');
    }
  };

  const handleRemoveSubheader = async (sectionId: string, group: ItemGroup) => {
    if (!group.title) return;

    if (group.items.length === 0) {
      removeEmptyGroup(sectionId, group.title);
      return;
    }

    try {
      await Promise.all(group.items.map((item) => updateMutation.mutateAsync({ itemId: item.id, payload: { groupTitle: null } })));
      removeEmptyGroup(sectionId, group.title);
      toast.success('Sub header removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove sub header');
    }
  };

  const handleDeleteItem = async (item: ProjectChecklistItem) => {
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success('Checklist row removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove checklist row');
    }
  };

  const handleCreateItem = async (sectionId: string, groupTitle: string | null) => {
    const key = draftKeyFor(sectionId, groupTitle);
    const draft = rowDrafts.get(key) ?? emptyRowDraft;
    const hasValue = Object.values(draft).some((value) => value.trim().length > 0);
    if (!hasValue) {
      toast.error('Fill at least one row field');
      return;
    }

    try {
      await createMutation.mutateAsync({
        sectionId,
        groupTitle,
        title: draft.title.trim(),
        plannedDate: draft.plannedDate.trim() || null,
        plannedTime: draft.plannedTime.trim() || null,
        location: draft.location.trim() || null,
        pic: draft.pic.trim() || null,
      });
      resetRowDraft(key);
      toast.success('Checklist row added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add checklist row');
    }
  };

  const handleExport = async () => {
    if (!checklist) return;

    try {
      setExportingChecklist(true);
      const result = mode === 'team' && teamId
        ? await projectChecklistsApi.exportTeam(teamId, projectId)
        : await projectChecklistsApi.exportLocal(projectId);
      downloadBlob(result.blob, result.filename ?? `${projectTitle}-checklist.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export checklist');
    } finally {
      setExportingChecklist(false);
    }
  };

  return (
    <div className="flex w-full max-w-none flex-col gap-5">
      <div className="relative overflow-hidden rounded-lg border bg-card">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-500 via-sky-500 to-amber-400" />
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Checklist</h3>
                  <p className="text-sm text-muted-foreground">{projectTitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  {mode === 'team' ? 'Shared DB' : 'Local DB'}
                </Badge>
                {checklist && <Badge variant="secondary">{checklist.items.length} rows</Badge>}
              </div>
            </div>

            {templatesQuery.isLoading || checklistQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading checklist
              </div>
            ) : activeTemplate?.activeVersion ? (
              <div className="rounded-md border bg-background p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium">{activeTemplate.name}</span>
                      <Badge variant="secondary">Active Template</Badge>
                    </div>
                    <p className="break-all text-sm text-muted-foreground">
                      {activeTemplate.activeVersion.originalFilename} - {formatBytes(activeTemplate.activeVersion.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleDownloadTemplate(activeTemplate)}
                      disabled={downloadingVersionId === activeTemplate.activeVersion.id}
                    >
                      {downloadingVersionId === activeTemplate.activeVersion.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Template
                    </Button>
                    {checklist ? (
                      <>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleGenerate(true)} disabled={isBusy}>
                          <RefreshCw className="h-4 w-4" />
                          Regenerate
                        </Button>
                        <Button size="sm" className="gap-2" onClick={handleExport} disabled={exportingChecklist}>
                          {exportingChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                          Export
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="gap-2" onClick={() => handleGenerate(false)} disabled={isBusy}>
                        {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                        Generate
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>Checklist template is not configured.</AlertDescription>
              </Alert>
            )}

            {checklist ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {checklist.sections.map((section) => {
                    const sectionItems = itemsBySection.get(section.id) ?? [];
                    const baseGroups = groupItemsByWorksheetGroup(sectionItems);
                    const groups = mergeDraftGroups(baseGroups, emptyGroupsBySection.get(section.id) ?? []);
                    const subheaderDraft = subheaderDrafts.get(section.id) ?? '';
                    return (
                      <div key={section.id} className="overflow-hidden rounded-md border bg-background">
                        <div className="border-b bg-sky-100 px-4 py-3 text-sky-950 dark:bg-sky-950/40 dark:text-sky-50">
                          <div className="font-semibold">{section.title}</div>
                          <div className="text-xs opacity-75">{sectionItems.length} rows</div>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={subheaderDraft}
                              placeholder="Sub header, e.g. DBA"
                              disabled={isBusy}
                              className="h-8 bg-background/80 text-foreground placeholder:text-muted-foreground"
                              onChange={(event) => updateSubheaderDraft(section.id, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') handleAddSubheader(section.id, groups);
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="gap-2 sm:w-auto"
                              disabled={isBusy}
                              onClick={() => handleAddSubheader(section.id, groups)}
                            >
                              <Plus className="h-4 w-4" />
                              Sub header
                            </Button>
                          </div>
                        </div>
                        <div className="divide-y">
                          {groups.map((group) => {
                            const draftKey = draftKeyFor(section.id, group.title);
                            const draft = rowDrafts.get(draftKey) ?? emptyRowDraft;
                            return (
                              <div key={group.key} className="overflow-x-auto">
                                {group.title && (
                                  <div className="flex items-center gap-2 border-b bg-amber-200 px-4 py-2 text-amber-950 dark:bg-amber-400/80 dark:text-amber-950">
                                    <Input
                                      defaultValue={group.title}
                                      disabled={isBusy}
                                      className="h-8 border-amber-500/40 bg-white/70 text-sm font-semibold text-amber-950 shadow-none"
                                      onBlur={(event) => void handleUpdateSubheader(section.id, group, event.currentTarget.value)}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 text-amber-950 hover:bg-amber-300/70 hover:text-amber-950"
                                      disabled={isBusy}
                                      onClick={() => void handleRemoveSubheader(section.id, group)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Remove sub header</span>
                                    </Button>
                                  </div>
                                )}
                                <div className="min-w-225">
                                  <div className="grid grid-cols-[56px_minmax(360px,1fr)_150px_120px_minmax(170px,0.55fr)_minmax(160px,0.55fr)_48px] border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                                    <span>No</span>
                                    <span>Aktivitas</span>
                                    <span>Tanggal</span>
                                    <span>Jam</span>
                                    <span>Lokasi</span>
                                    <span>PIC</span>
                                    <span />
                                  </div>
                                  {group.items.map((item, index) => (
                                    <div key={`${item.id}-${item.updatedAt}`} className="grid grid-cols-[56px_minmax(360px,1fr)_150px_120px_minmax(170px,0.55fr)_minmax(160px,0.55fr)_48px] items-start gap-2 border-b px-3 py-2 last:border-b-0">
                                      <div className="flex h-9 items-center text-sm text-muted-foreground">{index + 1}</div>
                                      <Textarea
                                        defaultValue={item.title}
                                        placeholder="Aktivitas"
                                        rows={2}
                                        disabled={isBusy}
                                        className="min-h-9 resize-y leading-snug"
                                        onBlur={(event) => handleUpdateTitle(item, event.currentTarget.value)}
                                      />
                                      <DatePicker
                                        value={item.plannedDate ?? ''}
                                        placeholder="Tanggal"
                                        disabled={isBusy}
                                        onChange={(value) => handleUpdateWorksheetField(item, 'plannedDate', value)}
                                      />
                                      <Input
                                        type="time"
                                        defaultValue={item.plannedTime ?? ''}
                                        placeholder="Jam"
                                        disabled={isBusy}
                                        onBlur={(event) => handleUpdateWorksheetField(item, 'plannedTime', event.currentTarget.value)}
                                      />
                                      <Input
                                        defaultValue={item.location ?? ''}
                                        placeholder="Lokasi"
                                        disabled={isBusy}
                                        onBlur={(event) => handleUpdateWorksheetField(item, 'location', event.currentTarget.value)}
                                      />
                                      <Input
                                        defaultValue={item.pic ?? ''}
                                        placeholder="PIC"
                                        disabled={isBusy}
                                        onBlur={(event) => handleUpdateWorksheetField(item, 'pic', event.currentTarget.value)}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                        disabled={isBusy}
                                        onClick={() => void handleDeleteItem(item)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Remove row</span>
                                      </Button>
                                    </div>
                                  ))}
                                  <div className="grid grid-cols-[56px_minmax(360px,1fr)_150px_120px_minmax(170px,0.55fr)_minmax(160px,0.55fr)_48px] items-start gap-2 bg-muted/20 px-3 py-3">
                                    <div className="flex h-9 items-center text-xs text-muted-foreground">New</div>
                                    <Textarea
                                      value={draft.title}
                                      placeholder="Aktivitas"
                                      rows={2}
                                      disabled={isBusy}
                                      className="min-h-9 resize-y leading-snug"
                                      onChange={(event) => updateRowDraft(draftKey, 'title', event.target.value)}
                                    />
                                    <DatePicker
                                      value={draft.plannedDate}
                                      placeholder="Tanggal"
                                      disabled={isBusy}
                                      onChange={(value) => updateRowDraft(draftKey, 'plannedDate', value)}
                                    />
                                    <Input
                                      type="time"
                                      value={draft.plannedTime}
                                      placeholder="Jam"
                                      disabled={isBusy}
                                      onChange={(event) => updateRowDraft(draftKey, 'plannedTime', event.target.value)}
                                    />
                                    <Input
                                      value={draft.location}
                                      placeholder="Lokasi"
                                      disabled={isBusy}
                                      onChange={(event) => updateRowDraft(draftKey, 'location', event.target.value)}
                                    />
                                    <Input
                                      value={draft.pic}
                                      placeholder="PIC"
                                      disabled={isBusy}
                                      onChange={(event) => updateRowDraft(draftKey, 'pic', event.target.value)}
                                    />
                                    <div />
                                  </div>
                                  <div className="flex justify-end border-t bg-muted/20 px-3 pb-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="gap-2"
                                      disabled={isBusy}
                                      onClick={() => void handleCreateItem(section.id, group.title)}
                                    >
                                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                      Row
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTemplate?.activeVersion ? (
              <div className="rounded-md border border-dashed bg-background p-8 text-center">
                <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="mt-3 font-medium">No checklist generated yet</div>
                <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                  Generate a project checklist from the active private template.
                </p>
                <Button className="mt-4 gap-2" onClick={() => handleGenerate(false)} disabled={isBusy}>
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  Generate Checklist
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-t bg-muted/30 p-6 xl:border-l xl:border-t-0">
            <Card className="border-dashed bg-background/80 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Upload Template</CardTitle>
                <CardDescription>Stores the workbook in private runtime storage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor={`checklist-template-name-${mode}`}>Name</Label>
                  <Input
                    id={`checklist-template-name-${mode}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Implementation checklist"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`checklist-template-version-${mode}`}>Version Label</Label>
                  <Input
                    id={`checklist-template-version-${mode}`}
                    value={versionLabel}
                    onChange={(event) => setVersionLabel(event.target.value)}
                    placeholder="2026.05"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`checklist-template-description-${mode}`}>Description</Label>
                  <Input
                    id={`checklist-template-description-${mode}`}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Private template source"
                  />
                </div>
                <Separator />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <Button
                  variant="outline"
                  className="h-20 w-full flex-col gap-2 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  <span className="max-w-full truncate text-sm">{file ? file.name : 'Choose XLSX template'}</span>
                </Button>
                <Button className="w-full gap-2" onClick={handleUpload} disabled={!file || isBusy}>
                  {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Store Template
                </Button>
              </CardContent>
            </Card>

            {templates.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">Template Versions</div>
                <div className="grid gap-2">
                  {templates.map((template) => (
                    <div key={template.id} className="rounded-md border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{template.name}</div>
                          {template.activeVersion && (
                            <div className="truncate text-xs text-muted-foreground">{template.activeVersion.versionLabel}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          disabled={template.isActive || !template.activeVersion || isBusy}
                          onClick={() => handleActivate(template)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Activate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
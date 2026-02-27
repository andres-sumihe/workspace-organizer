import { useState, useMemo, useEffect } from "react";
import {
  Clock,
  RotateCcw,
  Save,
  Eye,
  Loader2,
  ArrowLeft,
  Columns2,
  FileText,
  GitCompareArrows,
  User,
  Users,
} from "lucide-react";
import { diffLines, diffWords } from "diff";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown as TiptapMarkdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import LinkExtension from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table/table";
import { TableRow } from "@tiptap/extension-table/row";
import { TableCell } from "@tiptap/extension-table/cell";
import { TableHeader } from "@tiptap/extension-table/header";
import {
  MarkdownSuperscript,
  MarkdownSubscript,
  MarkdownHighlight,
  MarkdownInlineMath,
  MarkdownBlockMath,
} from "@/features/notes/components/markdown-extensions";
import { Admonition } from "@/features/notes/components/admonition-extension";
import "katex/dist/katex.min.css";
import { common, createLowlight } from "lowlight";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  useTeamNoteRevisions,
  useTeamNoteRevisionDetail,
  useCreateNoteSnapshot,
  useRestoreNoteRevision,
} from "@/features/team-projects/hooks/use-team-notes";

import type { TeamNoteRevisionSummary } from "@workspace/shared";

const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Shared TipTap extensions for read-only rendering
// ---------------------------------------------------------------------------
const viewerExtensions = [
  StarterKit.configure({ codeBlock: false }),
  TiptapMarkdown.configure({ html: false, linkify: true }),
  Image.configure({ inline: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  LinkExtension.configure({ openOnClick: false, autolink: true }),
  MarkdownHighlight,
  UnderlineExtension,
  CodeBlockLowlight.configure({ lowlight }),
  Table,
  TableRow,
  TableCell,
  TableHeader,
  MarkdownSuperscript,
  MarkdownSubscript,
  MarkdownInlineMath.configure({ katexOptions: { throwOnError: false } }),
  MarkdownBlockMath.configure({ katexOptions: { throwOnError: false } }),
  Admonition,
];

// ---------------------------------------------------------------------------
// Trigger badge labels
// ---------------------------------------------------------------------------
const triggerLabel: Record<string, string> = {
  auto: "Auto",
  disconnect: "Session End",
  session_end: "Session End",
  manual: "Manual Save",
  restore: "Before Restore",
};

const triggerVariant: Record<string, "default" | "secondary" | "outline"> = {
  auto: "secondary",
  disconnect: "secondary",
  session_end: "secondary",
  manual: "default",
  restore: "outline",
};

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------
function relativeTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(d / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Read-only TipTap renderer — renders markdown as rich formatted content
// ---------------------------------------------------------------------------
function RichContentViewer({
  content,
  label,
}: {
  content: string;
  label: string;
}) {
  const editor = useEditor(
    {
      extensions: viewerExtensions,
      content,
      editable: false,
      editorProps: {
        attributes: {
          class: "tiptap-rich-text outline-none p-4",
        },
      },
    },
    [content],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/40 border-b shrink-0">
        {label}
      </div>
      <ScrollArea className="flex-1">
        <EditorContent editor={editor} />
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified diff — GitHub-style with character-level inline highlighting
// ---------------------------------------------------------------------------
/** Normalize trailing newlines so diffLines doesn't flag unchanged lines */
function normalizeMd(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "") + "\n";
}

/** A single rendered diff line */
interface DiffLine {
  type: "added" | "removed" | "context";
  oldNum: number | null;
  newNum: number | null;
  /** Pre-rendered fragments (plain string for context, JSX spans for inline diffs) */
  fragments: React.ReactNode;
}

/**
 * Pair removed and added lines from an adjacent change group and produce
 * character-level inline highlights using `diffWords`.
 */
function buildInlineHighlightedLines(
  removedLines: string[],
  addedLines: string[],
  oldStart: number,
  newStart: number,
): DiffLine[] {
  const result: DiffLine[] = [];
  const pairCount = Math.min(removedLines.length, addedLines.length);

  for (let i = 0; i < pairCount; i++) {
    const wordDiff = diffWords(removedLines[i], addedLines[i]);

    // Build fragments for the removed line (highlight deleted words)
    const removedFragments: React.ReactNode[] = [];
    const addedFragments: React.ReactNode[] = [];
    wordDiff.forEach((part, idx) => {
      if (part.removed) {
        removedFragments.push(
          <span key={idx} className="bg-red-500/30 rounded-sm">
            {part.value}
          </span>,
        );
      } else if (part.added) {
        addedFragments.push(
          <span key={idx} className="bg-green-500/30 rounded-sm">
            {part.value}
          </span>,
        );
      } else {
        removedFragments.push(<span key={`r${idx}`}>{part.value}</span>);
        addedFragments.push(<span key={`a${idx}`}>{part.value}</span>);
      }
    });

    result.push({
      type: "removed",
      oldNum: oldStart + i,
      newNum: null,
      fragments: removedFragments.length ? removedFragments : " ",
    });
    result.push({
      type: "added",
      oldNum: null,
      newNum: newStart + i,
      fragments: addedFragments.length ? addedFragments : " ",
    });
  }

  // Remaining unmatched removed lines
  for (let i = pairCount; i < removedLines.length; i++) {
    result.push({
      type: "removed",
      oldNum: oldStart + i,
      newNum: null,
      fragments: removedLines[i] || " ",
    });
  }

  // Remaining unmatched added lines
  for (let i = pairCount; i < addedLines.length; i++) {
    result.push({
      type: "added",
      oldNum: null,
      newNum: newStart + i,
      fragments: addedLines[i] || " ",
    });
  }

  return result;
}

function UnifiedDiffView({
  oldText,
  newText,
  oldLabel,
  newLabel,
  editors,
}: {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
  editors?: string[];
}) {
  const normalizedOld = useMemo(() => normalizeMd(oldText), [oldText]);
  const normalizedNew = useMemo(() => normalizeMd(newText), [newText]);
  const lineChanges = useMemo(
    () => diffLines(normalizedOld, normalizedNew),
    [normalizedOld, normalizedNew],
  );

  /** Build DiffLine[] with character-level inline highlights */
  const { lines, added, removed } = useMemo(() => {
    const result: DiffLine[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;
    let addedCount = 0;
    let removedCount = 0;

    // Walk through lineChanges; when we encounter a removed block immediately
    // followed by an added block we pair them for inline diffing.
    let i = 0;
    while (i < lineChanges.length) {
      const change = lineChanges[i];

      if (!change.added && !change.removed) {
        // Context lines — unchanged
        const ctxLines = change.value.replace(/\n$/, "").split("\n");
        for (const text of ctxLines) {
          result.push({
            type: "context",
            oldNum: oldLineNum++,
            newNum: newLineNum++,
            fragments: text || " ",
          });
        }
        i++;
        continue;
      }

      // Collect adjacent removed then added
      let removedText = "";
      let addedText = "";
      while (i < lineChanges.length && lineChanges[i].removed) {
        removedText += lineChanges[i].value;
        i++;
      }
      while (i < lineChanges.length && lineChanges[i].added) {
        addedText += lineChanges[i].value;
        i++;
      }

      const removedLines = removedText
        ? removedText.replace(/\n$/, "").split("\n")
        : [];
      const addedLines = addedText
        ? addedText.replace(/\n$/, "").split("\n")
        : [];

      removedCount += removedLines.length;
      addedCount += addedLines.length;

      if (removedLines.length > 0 && addedLines.length > 0) {
        // Pair them for inline character-level highlights
        const highlighted = buildInlineHighlightedLines(
          removedLines,
          addedLines,
          oldLineNum,
          newLineNum,
        );
        result.push(...highlighted);
      } else {
        // Pure removal or pure addition — no inline diff needed
        for (const text of removedLines) {
          result.push({
            type: "removed",
            oldNum: oldLineNum,
            newNum: null,
            fragments: text || " ",
          });
          oldLineNum++;
        }
        for (const text of addedLines) {
          result.push({
            type: "added",
            oldNum: null,
            newNum: newLineNum,
            fragments: text || " ",
          });
          newLineNum++;
        }
      }

      oldLineNum += removedLines.length;
      newLineNum += addedLines.length;
    }

    return { lines: result, added: addedCount, removed: removedCount };
  }, [lineChanges]);

  if (normalizedOld === normalizedNew) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GitCompareArrows className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm font-medium">No changes detected</p>
        <p className="text-xs mt-1">These two versions are identical</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs border-b bg-muted/20 shrink-0">
        {oldLabel && newLabel && (
          <span className="text-muted-foreground">
            {oldLabel} → {newLabel}
          </span>
        )}
        {editors && editors.length > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            {editors.length === 1 ? (
              <User className="h-3 w-3" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            {editors.join(", ")}
          </span>
        )}
        <span className="text-muted-foreground font-medium">
          {lines.length} lines
        </span>
        {added > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{added} added
          </span>
        )}
        {removed > 0 && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            &minus;{removed} removed
          </span>
        )}
      </div>

      {/* Diff lines */}
      <ScrollArea className="flex-1">
        <div className="font-mono text-[13px] leading-[1.6]">
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === "added"
                  ? "flex bg-green-500/10 border-l-2 border-green-500"
                  : line.type === "removed"
                    ? "flex bg-red-500/10 border-l-2 border-red-500"
                    : "flex border-l-2 border-transparent"
              }
            >
              {/* Old line number */}
              <span className="w-10 shrink-0 text-right pr-2 select-none text-muted-foreground/50 text-xs leading-[1.6] font-mono">
                {line.oldNum ?? ""}
              </span>
              {/* New line number */}
              <span className="w-10 shrink-0 text-right pr-2 select-none text-muted-foreground/50 text-xs leading-[1.6] font-mono">
                {line.newNum ?? ""}
              </span>
              {/* Sign */}
              <span
                className={`w-5 shrink-0 text-center select-none font-medium ${
                  line.type === "added"
                    ? "text-green-600 dark:text-green-400"
                    : line.type === "removed"
                      ? "text-red-600 dark:text-red-400"
                      : "text-transparent"
                }`}
              >
                {line.type === "added"
                  ? "+"
                  : line.type === "removed"
                    ? "−"
                    : " "}
              </span>
              {/* Content with inline character highlights */}
              <span
                className={`flex-1 whitespace-pre-wrap break-all pr-4 ${
                  line.type === "removed"
                    ? "text-red-700 dark:text-red-300"
                    : line.type === "added"
                      ? "text-green-700 dark:text-green-300"
                      : "text-foreground/80"
                }`}
              >
                {line.fragments}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface NoteHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  projectId: string;
  noteId: string;
  /** Current note content (markdown) for diff comparison */
  currentContent: string;
}

export function NoteHistoryPanel({
  open,
  onOpenChange,
  teamId,
  projectId,
  noteId,
  currentContent,
}: NoteHistoryPanelProps) {
  const [diffRevisionId, setDiffRevisionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<
    "side-by-side" | "diff" | "preview"
  >("side-by-side");
  /** Which content to compare against: previous revision or live editor */
  const [compareBase, setCompareBase] = useState<"previous" | "current">("previous");

  const { data: historyData, isLoading: loadingList } = useTeamNoteRevisions(
    teamId,
    projectId,
    open ? noteId : null,
  );

  const { data: detailData, isLoading: loadingDetail } =
    useTeamNoteRevisionDetail(teamId, projectId, noteId, diffRevisionId);

  const snapshotMutation = useCreateNoteSnapshot(teamId, projectId);
  const restoreMutation = useRestoreNoteRevision(teamId, projectId);

  const revisions = historyData?.items ?? [];

  // Derive the previous revision id from the timeline list
  const previousRevisionId = useMemo(() => {
    if (!diffRevisionId || !revisions.length) return null;
    const idx = revisions.findIndex((r) => r.id === diffRevisionId);
    // revisions are ordered DESC, so previous = idx + 1
    if (idx >= 0 && idx + 1 < revisions.length) return revisions[idx + 1].id;
    return null; // first revision — no previous
  }, [diffRevisionId, revisions]);

  const { data: previousDetailData, isLoading: loadingPrevious } =
    useTeamNoteRevisionDetail(teamId, projectId, noteId, compareBase === "previous" ? previousRevisionId : null);

  const handleRestore = (revisionId: string) => {
    restoreMutation.mutate(
      { noteId, revisionId },
      { onSuccess: () => setDiffRevisionId(null) },
    );
  };

  const selectedRevision = detailData?.revision;
  const previousRevision = previousDetailData?.revision ?? null;

  // The "old" side of the diff depends on the comparison mode
  const diffOldContent = compareBase === "previous"
    ? (previousRevision?.content ?? '')
    : (selectedRevision?.content ?? '');
  const diffNewContent = compareBase === "previous"
    ? (selectedRevision?.content ?? '')
    : currentContent;
  const diffOldLabel = compareBase === "previous"
    ? (previousRevision ? `v${previousRevision.revisionNumber}` : 'Empty')
    : (selectedRevision ? `v${selectedRevision.revisionNumber}` : '');
  const diffNewLabel = compareBase === "previous"
    ? (selectedRevision ? `v${selectedRevision.revisionNumber}` : '')
    : 'Current';

  const isLoadingComparison = loadingDetail || (compareBase === "previous" && loadingPrevious);

  // Reset view mode and compare base when opening a new revision
  useEffect(() => {
    if (diffRevisionId) {
      setViewMode("side-by-side");
      setCompareBase("previous");
    }
  }, [diffRevisionId]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-105 sm:w-120 flex flex-col p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b">
            <div className="flex items-center justify-between pr-8">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Version History
              </SheetTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={snapshotMutation.isPending}
                onClick={() => snapshotMutation.mutate(noteId)}
              >
                {snapshotMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save Version
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {loadingList ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading history…
              </div>
            ) : revisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p>No history yet</p>
                <p className="text-xs mt-1">
                  Versions are saved periodically as you edit
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {revisions.map((rev) => (
                  <RevisionItem
                    key={rev.id}
                    revision={rev}
                    isActive={diffRevisionId === rev.id}
                    onPreview={() => setDiffRevisionId(rev.id)}
                    onRestore={() => handleRestore(rev.id)}
                    isRestoring={restoreMutation.isPending}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Comparison Dialog — near-fullscreen for comfortable viewing */}
      <Dialog
        open={!!diffRevisionId}
        onOpenChange={(v) => !v && setDiffRevisionId(null)}
      >
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDiffRevisionId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-base">
                  {selectedRevision
                    ? `Version ${selectedRevision.revisionNumber}`
                    : "Loading…"}
                </DialogTitle>
                {selectedRevision && (
                  <>
                    <Badge
                      variant={
                        triggerVariant[selectedRevision.snapshotTrigger] ??
                        "secondary"
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {triggerLabel[selectedRevision.snapshotTrigger] ??
                        selectedRevision.snapshotTrigger}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedRevision.createdAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {selectedRevision.editors.length > 1
                        ? <Users className="h-3 w-3" />
                        : <User className="h-3 w-3" />}
                      {selectedRevision.editors.length > 0
                        ? selectedRevision.editors.join(', ')
                        : selectedRevision.savedByEmail}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <Tabs
                  value={viewMode}
                  onValueChange={(v) =>
                    setViewMode(v as "side-by-side" | "diff" | "preview")
                  }
                >
                  <TabsList className="h-8">
                    <TabsTrigger
                      value="side-by-side"
                      className="text-xs px-2 h-6 gap-1"
                    >
                      <Columns2 className="h-3 w-3" />
                      Compare
                    </TabsTrigger>
                    <TabsTrigger
                      value="diff"
                      className="text-xs px-2 h-6 gap-1"
                    >
                      <GitCompareArrows className="h-3 w-3" />
                      Diff
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      className="text-xs px-2 h-6 gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Compare base toggle */}
                <Tabs
                  value={compareBase}
                  onValueChange={(v) => setCompareBase(v as "previous" | "current")}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="previous" className="text-xs px-2 h-6">
                      vs Previous
                    </TabsTrigger>
                    <TabsTrigger value="current" className="text-xs px-2 h-6">
                      vs Current
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {selectedRevision && (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={restoreMutation.isPending}
                    onClick={() => handleRestore(selectedRevision.id)}
                  >
                    {restoreMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Restore
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Content area */}
          <div className="flex-1 min-h-0">
            {isLoadingComparison ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading revision…
              </div>
            ) : selectedRevision ? (
              <>
                {/* Side-by-side: two rich TipTap readers */}
                {viewMode === "side-by-side" && (
                  <div className="flex h-full divide-x">
                    <div className="flex-1 min-w-0">
                      <RichContentViewer
                        content={diffOldContent}
                        label={diffOldLabel}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <RichContentViewer
                        content={diffNewContent}
                        label={diffNewLabel}
                      />
                    </div>
                  </div>
                )}

                {/* Unified diff — GitHub-style line view */}
                {viewMode === "diff" && (
                  <UnifiedDiffView
                    oldText={diffOldContent}
                    newText={diffNewContent}
                    oldLabel={diffOldLabel}
                    newLabel={diffNewLabel}
                    editors={selectedRevision.editors}
                  />
                )}

                {/* Full rich preview of the selected revision */}
                {viewMode === "preview" && (
                  <RichContentViewer
                    content={selectedRevision.content || ""}
                    label={`v${selectedRevision.revisionNumber} — Full preview`}
                  />
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Individual revision item
// ---------------------------------------------------------------------------
function RevisionItem({
  revision,
  isActive,
  onPreview,
  onRestore,
  isRestoring,
}: {
  revision: TeamNoteRevisionSummary;
  isActive: boolean;
  onPreview: () => void;
  onRestore: () => void;
  isRestoring: boolean;
}) {
  const trigger = revision.snapshotTrigger;

  return (
    <div
      className={`px-4 py-3 transition-colors cursor-pointer ${isActive ? "bg-accent/50" : "hover:bg-muted/40"}`}
      onClick={onPreview}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              v{revision.revisionNumber}
            </span>
            <Badge
              variant={triggerVariant[trigger] ?? "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              {triggerLabel[trigger] ?? trigger}
            </Badge>
          </div>
          {revision.title && (
            <p className="text-xs text-muted-foreground truncate mb-0.5">
              {revision.title}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {relativeTime(revision.createdAt)} · by {revision.savedByEmail}
          </p>
          {revision.editors.length > 1 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Editors: {revision.editors.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View changes</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isRestoring}
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restore this version</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

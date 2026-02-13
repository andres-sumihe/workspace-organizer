import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { File, Folder } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tiptap JSON node shape (subset we care about)
// ---------------------------------------------------------------------------

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Detection helper
// ---------------------------------------------------------------------------

function isTiptapJson(content: string): boolean {
  if (!content.startsWith('{"type":"doc"')) return false;
  try {
    const parsed = JSON.parse(content);
    return parsed?.type === "doc";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Plain text extraction (works for both JSON and text content)
// ---------------------------------------------------------------------------

function walkText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    return `/${(node.attrs?.label as string) ?? (node.attrs?.id as string) ?? ""}`;
  }
  if (!node.content) return "";
  const parts = node.content.map(walkText);
  if (node.type === "doc") return parts.join("\n");
  return parts.join("");
}

/**
 * Extract plain text from a content string that may be Tiptap JSON or plain text.
 * Useful for empty checks and text-based operations (e.g. hashtag parsing).
 */
export function extractPlainText(content: string): string {
  if (!content) return "";
  if (!isTiptapJson(content)) return content;
  try {
    return walkText(JSON.parse(content) as TiptapNode);
  } catch {
    return content;
  }
}

// ---------------------------------------------------------------------------
// Tiptap JSON → React renderer
// ---------------------------------------------------------------------------

function MentionChip({
  node,
  navigate,
}: {
  node: TiptapNode;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const projectId = node.attrs?.projectId as string | undefined;
  const label =
    (node.attrs?.label as string) ?? (node.attrs?.id as string) ?? "";
  const mentionType = node.attrs?.mentionType as string | undefined;

  const navigateToFile = () => {
    if (!projectId) return;
    const path = node.attrs?.path as string | undefined;
    if (path) {
      navigate(
        `/projects/${projectId}?tab=files&highlight=${encodeURIComponent(path)}`,
      );
    } else {
      navigate(`/projects/${projectId}?tab=files`);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigateToFile();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      navigateToFile();
    }
  };

  const icon =
    mentionType === "folder" ? (
      <Folder className="h-3 w-3 shrink-0" />
    ) : (
      <File className="h-3 w-3 shrink-0" />
    );

  return (
    <span
      role={projectId ? "link" : undefined}
      tabIndex={projectId ? 0 : undefined}
      className={cn(
        "inline-flex items-center gap-0.5 rounded bg-accent px-1 py-0.5 text-xs font-medium text-accent-foreground transition-colors",
        projectId && "cursor-pointer hover:bg-accent/80",
      )}
      onClick={projectId ? handleClick : undefined}
      onKeyDown={projectId ? handleKeyDown : undefined}
    >
      {icon}
      /{label}
    </span>
  );
}

function NodeRenderer({
  node,
  navigate,
}: {
  node: TiptapNode;
  navigate: ReturnType<typeof useNavigate>;
}): ReactNode {
  if (node.type === "text") return <>{node.text}</>;
  if (node.type === "mention")
    return <MentionChip node={node} navigate={navigate} />;

  if (node.type === "paragraph") {
    return (
      <p className="m-0">
        {node.content?.map((child, i) => (
          <NodeRenderer key={i} node={child} navigate={navigate} />
        ))}
      </p>
    );
  }

  // doc / unknown — just render children
  return (
    <>
      {node.content?.map((child, i) => (
        <NodeRenderer key={i} node={child} navigate={navigate} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface MentionContentViewProps {
  /** Saved content — may be a Tiptap JSON string or plain text. */
  content: string;
  className?: string;
}

/**
 * Renders saved content that may contain file/folder mentions as clickable chips.
 *
 * - If `content` is a serialised Tiptap JSON doc, mention nodes render as
 *   clickable chips that navigate to the owning project's File Manager tab.
 * - Otherwise the content is rendered as plain text.
 */
export function MentionContentView({
  content,
  className,
}: MentionContentViewProps) {
  const navigate = useNavigate();

  if (!content) return null;

  if (isTiptapJson(content)) {
    try {
      const doc = JSON.parse(content) as TiptapNode;
      return (
        <div className={cn("text-sm", className)}>
          <NodeRenderer node={doc} navigate={navigate} />
        </div>
      );
    } catch {
      /* fall through to plain text */
    }
  }

  return (
    <p className={cn("text-sm whitespace-pre-wrap", className)}>
      {content}
    </p>
  );
}

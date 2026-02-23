import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { File, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import { useImagePreviewDialog } from "@/components/ui/image-preview";

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
  onImageClick,
}: {
  node: TiptapNode;
  navigate: ReturnType<typeof useNavigate>;
  onImageClick?: (src: string) => void;
}): ReactNode {
  if (node.type === "text") {
    let content: ReactNode = <>{node.text}</>;
    const marks = (node as TiptapNode & { marks?: { type: string }[] }).marks;
    if (marks) {
      for (const mark of marks) {
        if (mark.type === "bold") content = <strong>{content}</strong>;
        else if (mark.type === "italic") content = <em>{content}</em>;
        else if (mark.type === "strike") content = <s>{content}</s>;
        else if (mark.type === "code") content = <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{content}</code>;
      }
    }
    return content;
  }
  if (node.type === "mention")
    return <MentionChip node={node} navigate={navigate} />;

  if (node.type === "image") {
    const src = node.attrs?.src as string | undefined;
    const alt = (node.attrs?.alt as string) || "uploaded image";
    if (!src) return null;
    return (
      <img
        src={src}
        alt={alt}
        className="rounded-md max-w-full h-auto my-1 cursor-pointer hover:opacity-85 transition-opacity"
        onClick={onImageClick ? () => onImageClick(src) : undefined}
      />
    );
  }

  if (node.type === "paragraph") {
    return (
      <p className="m-0">
        {node.content?.map((child, i) => (
          <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
        ))}
      </p>
    );
  }

  if (node.type === "heading") {
    const level = (node.attrs?.level as number) ?? 1;
    const children = node.content?.map((child, i) => (
      <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
    ));
    if (level === 1) return <h1 className="text-lg font-bold my-1">{children}</h1>;
    if (level === 2) return <h2 className="text-base font-bold my-1">{children}</h2>;
    return <h3 className="text-sm font-bold my-1">{children}</h3>;
  }

  if (node.type === "blockquote") {
    return (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-1 text-muted-foreground italic">
        {node.content?.map((child, i) => (
          <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
        ))}
      </blockquote>
    );
  }

  if (node.type === "codeBlock") {
    const text = node.content?.map((child) => child.text ?? "").join("") ?? "";
    return (
      <pre className="rounded bg-muted p-2 my-1 text-xs font-mono overflow-x-auto">
        <code>{text}</code>
      </pre>
    );
  }

  if (node.type === "bulletList") {
    return (
      <ul className="list-disc pl-5 my-1">
        {node.content?.map((child, i) => (
          <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
        ))}
      </ul>
    );
  }

  if (node.type === "orderedList") {
    return (
      <ol className="list-decimal pl-5 my-1">
        {node.content?.map((child, i) => (
          <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
        ))}
      </ol>
    );
  }

  if (node.type === "listItem") {
    return (
      <li>
        {node.content?.map((child, i) => (
          <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
        ))}
      </li>
    );
  }

  if (node.type === "hardBreak") {
    return <br />;
  }

  if (node.type === "horizontalRule") {
    return <hr className="my-2 border-border" />;
  }

  // doc / unknown — just render children
  return (
    <>
      {node.content?.map((child, i) => (
        <NodeRenderer key={i} node={child} navigate={navigate} onImageClick={onImageClick} />
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
  const { preview, dialog } = useImagePreviewDialog();

  if (!content) return null;

  if (isTiptapJson(content)) {
    try {
      const doc = JSON.parse(content) as TiptapNode;
      return (
        <div className={cn("text-sm", className)}>
          <NodeRenderer node={doc} navigate={navigate} onImageClick={preview} />
          {dialog}
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

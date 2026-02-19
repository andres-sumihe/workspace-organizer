import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

import { EditorContent, useEditor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";

import {
  MentionSuggestionList,
  type MentionSuggestionItem,
  type MentionSuggestionListRef,
} from "./mention-suggestion-list";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionValue {
  /** Plain text representation (mentions rendered as triggerChar + label) */
  text: string;
  /** Extracted mention items from the content */
  mentions: MentionSuggestionItem[];
  /** Tiptap JSON content for persistence / restoration */
  json: Record<string, unknown>;
  /** Tiptap HTML content */
  html: string;
}

export interface MentionInputProps {
  /** Current plain-text value (for controlled usage). Setting this resets the
   *  editor content only when the reference changes AND the editor text no
   *  longer matches (avoids cursor-jump on every keystroke). */
  value?: string;
  /** Fires on every content change */
  onChange?: (value: MentionValue) => void;
  /** Input placeholder */
  placeholder?: string;
  /** Character that triggers the mention dropdown. @default "/" */
  triggerChar?: string;
  /** Static list or async function returning mention suggestions.
   *  The function receives the search query (text after triggerChar). */
  items:
    | MentionSuggestionItem[]
    | ((query: string) => MentionSuggestionItem[] | Promise<MentionSuggestionItem[]>);
  /** When true renders as a multi-line textarea style. @default false */
  multiline?: boolean;
  /** CSS min-height applied in multi-line mode. @default "80px" */
  minHeight?: string;
  /** Additional className merged onto the outer wrapper */
  className?: string;
  /** Disable editing */
  disabled?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  /** Optional label rendered *inside* the editor chrome (before the editable area) */
  startAdornment?: ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract plain text from tiptap JSON, replacing mention nodes with triggerChar+label */
function extractText(json: Record<string, unknown>, triggerChar: string): string {
  const walk = (node: Record<string, unknown>): string => {
    if (node.type === "text") return (node.text as string) ?? "";
    if (node.type === "mention") {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      return `${triggerChar}${(attrs?.label as string) ?? (attrs?.id as string) ?? ""}`;
    }
    const content = node.content as Record<string, unknown>[] | undefined;
    if (!content) return "";
    return content.map(walk).join("");
  };

  const doc = json as { content?: Record<string, unknown>[] };
  if (!doc.content) return "";
  return doc.content
    .map(walk)
    .join("\n")
    .replace(/\n$/, "");
}

/** Extract all mentions from tiptap JSON */
function extractMentions(json: Record<string, unknown>): MentionSuggestionItem[] {
  const mentions: MentionSuggestionItem[] = [];

  const walk = (node: Record<string, unknown>) => {
    if (node.type === "mention") {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      if (attrs) {
        mentions.push({
          id: (attrs.id as string) ?? "",
          label: (attrs.label as string) ?? "",
          type: (attrs.type as string) ?? undefined,
          path: (attrs.path as string) ?? undefined,
          projectId: (attrs.projectId as string) ?? undefined,
          projectName: (attrs.projectName as string) ?? undefined,
        });
      }
    }
    const content = node.content as Record<string, unknown>[] | undefined;
    content?.forEach(walk);
  };

  walk(json);
  return mentions;
}

// ---------------------------------------------------------------------------
// Extended Mention node — stores projectId, path, type as HTML data-attributes
// ---------------------------------------------------------------------------

const MentionWithProject = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      projectId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-project-id"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.projectId ? { "data-project-id": attrs.projectId } : {},
      },
      projectName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-project-name"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.projectName ? { "data-project-name": attrs.projectName } : {},
      },
      path: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-path"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.path ? { "data-path": attrs.path } : {},
      },
      mentionType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-mention-type"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.mentionType ? { "data-mention-type": attrs.mentionType } : {},
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Dropdown positioning helper
// ---------------------------------------------------------------------------

const DROPDOWN_MAX_HEIGHT = 240; // matches max-h-60 (15rem = 240px)
const DROPDOWN_GAP = 4;

/**
 * Position the suggestion dropdown relative to the caret.
 *
 * When inside a dialog with CSS `transform` the browser treats
 * `position: fixed` as relative to the transform ancestor — NOT the
 * viewport.  We detect that ancestor (the DialogContent element) and
 * offset our coordinates accordingly.
 *
 * `transformAncestor` is the nearest ancestor with a CSS transform
 * (i.e. DialogContent).  When null we fall back to true viewport-fixed.
 */
function positionDropdown(
  container: HTMLElement,
  rect: DOMRect,
  transformAncestor: HTMLElement | null,
) {
  const spaceBelow = window.innerHeight - rect.bottom;
  const actualHeight = container.offsetHeight || DROPDOWN_MAX_HEIGHT;
  const viewportLeft = Math.max(4, Math.min(rect.left, window.innerWidth - 280));

  // Position below if enough space, or if more space below than above
  const viewportTop =
    spaceBelow >= actualHeight + DROPDOWN_GAP || spaceBelow >= rect.top
      ? rect.bottom + DROPDOWN_GAP
      : rect.top - actualHeight - DROPDOWN_GAP;

  container.style.position = "fixed";

  if (transformAncestor) {
    const aRect = transformAncestor.getBoundingClientRect();
    container.style.top = `${viewportTop - aRect.top}px`;
    container.style.left = `${viewportLeft - aRect.left}px`;
  } else {
    container.style.top = `${viewportTop}px`;
    container.style.left = `${viewportLeft}px`;
  }
}

// ---------------------------------------------------------------------------
// Find the nearest ancestor with a CSS transform (containing block for fixed)
// ---------------------------------------------------------------------------

function findTransformAncestor(el: Element): HTMLElement | null {
  let current = el.parentElement;
  while (current) {
    const transform = getComputedStyle(current).transform;
    if (transform && transform !== "none") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Collect scrollable ancestors for repositioning on scroll
// ---------------------------------------------------------------------------

function getScrollableAncestors(el: Element): Element[] {
  const result: Element[] = [];
  let current = el.parentElement;
  while (current) {
    const style = getComputedStyle(current);
    if (/(auto|scroll|overlay)/.test(style.overflow + style.overflowY + style.overflowX)) {
      result.push(current);
    }
    current = current.parentElement;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Suggestion renderer (imperative – required by tiptap)
// ---------------------------------------------------------------------------

interface SuggestionRendererInstance {
  reactRoot: ReturnType<typeof createRoot> | null;
  ref: MentionSuggestionListRef | null;
  container: HTMLElement | null;
  /** Nearest ancestor with CSS transform (DialogContent), or null */
  transformAncestor: HTMLElement | null;
  cleanupAutoUpdate: (() => void) | null;
  cleanupClickOutside: (() => void) | null;
}

/** Tear down the suggestion dropdown completely */
function destroyInstance(instance: SuggestionRendererInstance) {
  instance.cleanupAutoUpdate?.();
  instance.cleanupAutoUpdate = null;
  instance.cleanupClickOutside?.();
  instance.cleanupClickOutside = null;
  instance.reactRoot?.unmount();
  instance.container?.remove();
  instance.reactRoot = null;
  instance.container = null;
  instance.transformAncestor = null;
  instance.ref = null;
}

function createSuggestionRenderer(
  itemsSource:
    | MentionSuggestionItem[]
    | ((query: string) => MentionSuggestionItem[] | Promise<MentionSuggestionItem[]>),
) {
  return {
    items: async ({ query }: { query: string }) => {
      if (typeof itemsSource === "function") {
        return itemsSource(query);
      }
      const q = query.toLowerCase();
      return itemsSource.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.path ?? "").toLowerCase().includes(q),
      );
    },

    render: () => {
      const instance: SuggestionRendererInstance = {
        reactRoot: null,
        ref: null,
        container: null,
        transformAncestor: null,
        cleanupAutoUpdate: null,
        cleanupClickOutside: null,
      };

      /** Set up scroll + resize listeners that reposition the dropdown */
      function startAutoUpdate(
        editorEl: Element,
        getClientRect: (() => DOMRect | null) | undefined,
      ) {
        stopAutoUpdate();
        if (!getClientRect || !instance.container) return;

        const reposition = () => {
          const rect = getClientRect();
          if (rect && instance.container) {
            positionDropdown(instance.container, rect, instance.transformAncestor);
          }
        };

        // Listen to scroll on every scrollable ancestor (including modal panes)
        const ancestors = getScrollableAncestors(editorEl);
        const opts: AddEventListenerOptions = { passive: true };
        for (const ancestor of ancestors) {
          ancestor.addEventListener("scroll", reposition, opts);
        }
        window.addEventListener("scroll", reposition, opts);
        window.addEventListener("resize", reposition, opts);

        instance.cleanupAutoUpdate = () => {
          for (const ancestor of ancestors) {
            ancestor.removeEventListener("scroll", reposition);
          }
          window.removeEventListener("scroll", reposition);
          window.removeEventListener("resize", reposition);
        };
      }

      function stopAutoUpdate() {
        instance.cleanupAutoUpdate?.();
        instance.cleanupAutoUpdate = null;
      }

      return {
        onStart: (props: SuggestionProps<MentionSuggestionItem>) => {
          instance.container = document.createElement("div");
          instance.container.style.zIndex = "9999";

          // Append to DOM BEFORE rendering so offsetHeight is measurable
          const editorDom = props.editor.view.dom;
          const dialogEl =
            editorDom.closest("[data-radix-dialog-content]") ??
            editorDom.closest("[role='dialog']");

          if (dialogEl instanceof HTMLElement) {
            dialogEl.appendChild(instance.container);
            instance.transformAncestor = dialogEl;
          } else {
            document.body.appendChild(instance.container);
            instance.transformAncestor = findTransformAncestor(editorDom);
          }

          // Render synchronously so offsetHeight is accurate for positioning
          instance.reactRoot = createRoot(instance.container);
          flushSync(() => {
            instance.reactRoot!.render(
              <MentionSuggestionList
                ref={(r) => {
                  instance.ref = r;
                }}
                items={props.items}
                command={props.command}
              />,
            );
          });

          const rect = props.clientRect?.();
          if (rect && instance.container) {
            positionDropdown(instance.container, rect, instance.transformAncestor);
          }

          // Track scroll/resize to keep dropdown anchored
          if (props.editor) {
            startAutoUpdate(props.editor.view.dom, props.clientRect ?? undefined);
          }

          // Click-outside listener: dismiss when clicking outside
          // editor + dropdown (mimics VS Code behavior).
          // We tear down the renderer directly (same as the Escape handler)
          // instead of using the suggestion plugin's exit mechanism, because
          // tiptap's exit meta only lasts for one transaction — any subsequent
          // transaction (blur, focus change) would re-discover the trigger
          // text and reopen the suggestion.
          const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (editorDom.contains(target)) return;
            if (instance.container?.contains(target)) return;
            destroyInstance(instance);
          };
          // Delay registration so the current mousedown (if any) finishes
          setTimeout(() => {
            document.addEventListener("mousedown", onDocMouseDown, true);
          }, 0);
          instance.cleanupClickOutside = () => {
            document.removeEventListener("mousedown", onDocMouseDown, true);
          };
        },

        onUpdate: (props: SuggestionProps<MentionSuggestionItem>) => {
          if (!instance.reactRoot) return;
          flushSync(() => {
            instance.reactRoot!.render(
              <MentionSuggestionList
                ref={(r) => {
                  instance.ref = r;
                }}
                items={props.items}
                command={props.command}
              />,
            );
          });

          const rect = props.clientRect?.();
          if (rect && instance.container) {
            positionDropdown(instance.container, rect, instance.transformAncestor);
          }

          // Refresh listeners (editor DOM might have changed)
          if (props.editor) {
            startAutoUpdate(props.editor.view.dom, props.clientRect ?? undefined);
          }
        },

        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            destroyInstance(instance);
            return true;
          }
          return instance.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          // Delay unmount slightly so React can finish rendering
          const { cleanupAutoUpdate, cleanupClickOutside, reactRoot, container } = instance;
          cleanupAutoUpdate?.();
          cleanupClickOutside?.();
          instance.cleanupAutoUpdate = null;
          instance.cleanupClickOutside = null;
          instance.ref = null;
          setTimeout(() => {
            reactRoot?.unmount();
            container?.remove();
          }, 0);
          instance.reactRoot = null;
          instance.container = null;
          instance.transformAncestor = null;
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// MentionInput component
// ---------------------------------------------------------------------------

export function MentionInput({
  value,
  onChange,
  placeholder,
  triggerChar = "/",
  items,
  multiline = false,
  minHeight = "80px",
  className,
  disabled = false,
  onBlur,
  onFocus,
  startAdornment,
}: MentionInputProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const triggerCharRef = useRef(triggerChar);
  triggerCharRef.current = triggerChar;

  // Stable suggestion config (must not recreate on every render)
  const suggestionConfig = useRef(
    createSuggestionRenderer(
      // Delegate to ref so latest items are always used
      (query: string) => {
        const src = itemsRef.current;
        if (typeof src === "function") return src(query);
        const q = query.toLowerCase();
        return src.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.path ?? "").toLowerCase().includes(q),
        );
      },
    ),
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need for a simple input
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
        // In single-line mode, hitting Enter should not create new blocks
        ...(multiline ? {} : { hardBreak: false }),
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      MentionWithProject.configure({
        HTMLAttributes: {
          class:
            "inline-flex items-center gap-0.5 rounded bg-accent px-1 py-0.5 text-xs font-medium text-accent-foreground align-baseline cursor-pointer hover:bg-accent/80 transition-colors",
        },
        suggestion: {
          char: triggerChar,
          ...suggestionConfig.current,
        },
        renderText: ({ node }) =>
          `${triggerCharRef.current}${node.attrs.label ?? node.attrs.id}`,
      }),
    ],
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "outline-none w-full [&_p]:m-0",
          multiline
            ? "min-h-[60px]"
            : "whitespace-nowrap overflow-x-auto",
        ),
        // Prevent Enter in single-line mode
        ...(!multiline
          ? {
              "data-singleline": "true",
            }
          : {}),
      },
      handleKeyDown: multiline
        ? undefined
        : (_view, event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              return true;
            }
            return false;
          },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as Record<string, unknown>;
      const text = extractText(json, triggerCharRef.current);
      const mentions = extractMentions(json);
      const html = ed.getHTML();
      onChangeRef.current?.({ text, mentions, json, html });
    },
    onBlur: () => onBlur?.(),
    onFocus: () => onFocus?.(),
  });

  // Sync external value into the editor (controlled mode).
  // Supports both plain text and serialised Tiptap JSON strings.
  useEffect(() => {
    if (!editor || value === undefined) return;

    // Handle Tiptap JSON strings (produced by JSON.stringify(json))
    if (value.startsWith('{"type":"doc"')) {
      try {
        const parsed = JSON.parse(value);
        // Only update if the editor content actually differs
        const currentJson = JSON.stringify(editor.getJSON());
        if (currentJson === value) return;
        editor.commands.setContent(parsed, { emitUpdate: false });
        return;
      } catch {
        /* not valid JSON — fall through to plain text handling */
      }
    }

    const currentText = extractText(
      editor.getJSON() as Record<string, unknown>,
      triggerCharRef.current,
    );
    // Only update if the value actually differs from what the editor has
    if (currentText !== value) {
      if (value === "") {
        editor.commands.clearContent();
      } else {
        editor.commands.setContent(`<p>${value}</p>`, { emitUpdate: false });
      }
    }
  }, [editor, value]);

  // Sync disabled state
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const handleWrapperClick = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  return (
    // Outer wrapper matches shadcn Input/Textarea styling
    <div
      onClick={handleWrapperClick}
      className={cn(
        "flex w-full rounded-md border border-input bg-transparent text-base shadow-sm transition-colors md:text-sm",
        "placeholder:text-muted-foreground",
        "focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        multiline ? "items-start px-3 py-2" : "items-center px-3 py-1 h-9",
        className,
      )}
      style={multiline ? { minHeight } : undefined}
    >
      {startAdornment}
      <EditorContent editor={editor} className="flex-1 [&_.tiptap]:outline-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MentionTextarea — convenience alias for multiline mode
// ---------------------------------------------------------------------------

export type MentionTextareaProps = Omit<MentionInputProps, "multiline">;

export function MentionTextarea(props: MentionTextareaProps) {
  return <MentionInput {...props} multiline />;
}

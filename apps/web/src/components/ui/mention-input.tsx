import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
  ImagePlus,
  CodeSquare,
  Loader2,
} from "lucide-react";

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
  /** CSS max-height applied in multi-line mode — editor scrolls beyond this. */
  maxHeight?: string;
  /** Enable rich text toolbar and formatting (heading, blockquote, code block, lists, image). @default false */
  richText?: boolean;
  /** Custom image handler. Receives a File and must return the image URL
   *  (e.g. a data: base64 URL for shared/team contexts, or a server-uploaded
   *  URL for local/personal contexts). When omitted, images are uploaded to
   *  the local server via /api/v1/uploads/images. */
  imageHandler?: (file: File) => Promise<string>;
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
// Image upload helper
// ---------------------------------------------------------------------------

const API_URL = (import.meta as { env?: Record<string, unknown> }).env?.VITE_API_URL ?? '';

async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('auth_access_token');
  const res = await fetch(`${API_URL}/api/v1/uploads/images`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error('Image upload failed');
  }

  const json = (await res.json()) as { data: { url: string } };
  return json.data.url;
}

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.type);
}

// ---------------------------------------------------------------------------
// RichTextToolbar — formatting buttons for the editor
// ---------------------------------------------------------------------------

interface RichTextToolbarProps {
  editor: Editor | null;
  onImageUpload?: () => void;
  isUploading?: boolean;
}

function RichTextToolbar({ editor, onImageUpload, isUploading }: RichTextToolbarProps) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center h-7 w-7 rounded-sm transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      active && "bg-accent text-accent-foreground",
    );

  return (
    <div className="flex items-center gap-0.5 border-t border-border pt-1.5 mt-1.5 flex-wrap">
      <button type="button" title="Bold" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Italic" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Strikethrough" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <button type="button" title="Inline Code" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Code Block" className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <CodeSquare className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Blockquote" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <button type="button" title="Bullet List" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Ordered List" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <button type="button" title="Upload Image" className={btn(false)} onClick={onImageUpload} disabled={isUploading}>
        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
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
  maxHeight,
  richText = false,
  className,
  disabled = false,
  onBlur,
  onFocus,
  startAdornment,
  imageHandler,
}: MentionInputProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const imageHandlerRef = useRef(imageHandler);
  imageHandlerRef.current = imageHandler;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const triggerCharRef = useRef(triggerChar);
  triggerCharRef.current = triggerChar;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const isUploadingRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // Image upload handler shared by toolbar, paste, and drop
  const handleImageFiles = useCallback(async (files: File[], editorInstance: Editor) => {
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) return false;

    isUploadingRef.current = true;
    setIsUploading(true);
    try {
      const handler = imageHandlerRef.current ?? uploadImageFile;
      for (const file of imageFiles) {
        const url = await handler(file);
        editorInstance.chain().focus().setImage({ src: url }).run();
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
    return true;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: richText ? { levels: [1, 2, 3] } : false,
        blockquote: richText ? {} : false,
        codeBlock: richText ? {} : false,
        bulletList: richText ? {} : false,
        orderedList: richText ? {} : false,
        horizontalRule: false,
        // In single-line mode, hitting Enter should not create new blocks
        ...(multiline ? {} : { hardBreak: false }),
      }),
      ...(richText
        ? [
            Image.configure({
              inline: false,
              allowBase64: !!imageHandler,
              HTMLAttributes: {
                class: 'rounded-md max-w-full h-auto my-1',
              },
            }),
          ]
        : []),
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
          richText && "tiptap-rich-text",
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
      // Intercept paste events to handle images
      handlePaste: richText
        ? (_view, event) => {
            const clipboardItems = event.clipboardData?.items;
            if (!clipboardItems) return false;
            const files: File[] = [];
            for (const item of Array.from(clipboardItems)) {
              if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) files.push(file);
              }
            }
            if (files.length === 0) return false;
            const ed = editorRef.current;
            if (!ed) return false;
            event.preventDefault();
            handleImageFiles(files, ed);
            return true;
          }
        : undefined,
      // Intercept drop events to handle images
      handleDrop: richText
        ? (_view, event) => {
            const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return false;
            const ed = editorRef.current;
            if (!ed) return false;
            event.preventDefault();
            handleImageFiles(files, ed);
            return true;
          }
        : undefined,
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

  // Keep editorRef in sync so paste/drop handlers can access the instance
  editorRef.current = editor;

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

  const handleToolbarImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0 && editor) {
        await handleImageFiles(files, editor);
      }
      // Reset the input so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [editor, handleImageFiles],
  );

  return (
    // Outer wrapper matches shadcn Input/Textarea styling
    <div
      onClick={handleWrapperClick}
      className={cn(
        "flex flex-col w-full rounded-md border border-input bg-transparent text-base shadow-sm transition-colors md:text-sm",
        "placeholder:text-muted-foreground",
        "focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        multiline ? "px-3 py-2" : "items-center px-3 py-1 h-9",
        className,
      )}
      style={multiline ? { minHeight } : undefined}
    >
      <div className="flex items-start flex-1 min-w-0">
        {startAdornment}
        <div
          className="flex-1 [&_.tiptap]:outline-none overflow-y-auto"
          style={multiline && maxHeight ? { maxHeight } : undefined}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
      {richText && multiline && (
        <>
          <RichTextToolbar
            editor={editor}
            onImageUpload={handleToolbarImageUpload}
            isUploading={isUploading}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </>
      )}
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

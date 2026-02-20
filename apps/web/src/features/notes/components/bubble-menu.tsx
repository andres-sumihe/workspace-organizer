import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Code,
  Highlighter,
  Link,
  Unlink,
  Superscript,
  Subscript,
  Check,
  X,
} from 'lucide-react';

interface NoteBubbleMenuProps {
  editor: Editor;
}

export function NoteBubbleMenu({ editor }: NoteBubbleMenuProps) {
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  // When entering link-edit mode, populate with existing URL if any
  const enterLinkMode = useCallback(() => {
    const attrs = editor.getAttributes('link');
    setLinkUrl((attrs.href as string) ?? '');
    setLinkMode(true);
  }, [editor]);

  // Focus the input when link mode activates
  useEffect(() => {
    if (linkMode) {
      requestAnimationFrame(() => linkInputRef.current?.focus());
    }
  }, [linkMode]);

  const applyLink = useCallback(() => {
    const url = linkUrl.trim();
    if (url) {
      const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkMode(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkMode(false);
    setLinkUrl('');
  }, [editor]);

  const cancelLinkMode = useCallback(() => {
    setLinkMode(false);
    setLinkUrl('');
    editor.commands.focus();
  }, [editor]);

  return (
    <TiptapBubbleMenu
      editor={editor}
      shouldShow={({ editor: e }) => {
        if (e.isActive('image')) return false;
        const { from, to } = e.state.selection;
        if (from === to) return false;
        return true;
      }}
      options={{
        placement: 'top',
        offset: 8,
      }}
      className="note-bubble-menu flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md z-50"
    >
      {linkMode ? (
        /* ── Inline link input ── */
        <div className="flex items-center gap-1">
          <input
            ref={linkInputRef}
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelLinkMode();
              }
            }}
            placeholder="Enter URL..."
            className="h-7 w-48 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <ToolbarButton active={false} onClick={applyLink} title="Apply link">
            <Check className="h-3.5 w-3.5" />
          </ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton active={false} onClick={removeLink} title="Remove link">
              <Unlink className="h-3.5 w-3.5" />
            </ToolbarButton>
          )}
          <ToolbarButton active={false} onClick={cancelLinkMode} title="Cancel">
            <X className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      ) : (
        /* ── Normal formatting toolbar ── */
        <>
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleMark('bold').run()}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleMark('italic').run()}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleMark('underline').run()}
            title="Underline"
          >
            <Underline className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleMark('strike').run()}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <ToolbarButton
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleMark('code').run()}
            title="Inline code"
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            active={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleMark('highlight').run()}
            title="Highlight"
          >
            <Highlighter className="h-3.5 w-3.5" />
          </ToolbarButton>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <ToolbarButton
            active={editor.isActive('superscript')}
            onClick={() => editor.commands.toggleSuperscript()}
            title="Superscript"
          >
            <Superscript className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            active={editor.isActive('subscript')}
            onClick={() => editor.commands.toggleSubscript()}
            title="Subscript"
          >
            <Subscript className="h-3.5 w-3.5" />
          </ToolbarButton>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <ToolbarButton
            active={editor.isActive('link')}
            onClick={editor.isActive('link') ? removeLink : enterLinkMode}
            title={editor.isActive('link') ? 'Remove link' : 'Add link'}
          >
            {editor.isActive('link') ? (
              <Unlink className="h-3.5 w-3.5" />
            ) : (
              <Link className="h-3.5 w-3.5" />
            )}
          </ToolbarButton>
        </>
      )}
    </TiptapBubbleMenu>
  );
}

// ── Small toggle button ──────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

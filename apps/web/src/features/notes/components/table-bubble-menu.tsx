import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns3,
  Rows3,
  Trash2,
} from "lucide-react";

interface TableContextMenuProps {
  editor: Editor;
}

interface MenuPosition {
  x: number;
  y: number;
}

export function TableContextMenu({ editor }: TableContextMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPosition(null), []);

  // Listen for contextmenu on the editor DOM
  useEffect(() => {
    const editorElement = editor.view.dom;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("table")) {
        e.preventDefault();

        // Clamp to viewport so the menu doesn't overflow
        const menuW = 200;
        const menuH = 300;
        const x = Math.min(e.clientX, window.innerWidth - menuW);
        const y = Math.min(e.clientY, window.innerHeight - menuH);

        setPosition({ x, y });
      }
    };

    editorElement.addEventListener("contextmenu", handleContextMenu);
    return () =>
      editorElement.removeEventListener("contextmenu", handleContextMenu);
  }, [editor]);

  // Close on click outside, Escape, or scroll
  useEffect(() => {
    if (!position) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    const handleScroll = () => close();

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [position, close]);

  if (!position) return null;

  const runAction = (action: () => void) => {
    action();
    close();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ top: position.y, left: position.x }}
    >
      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().addColumnBefore().run())
        }
      >
        <ArrowLeftToLine className="h-4 w-4 mr-2" />
        Insert column before
      </MenuItem>
      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().addColumnAfter().run())
        }
      >
        <ArrowRightToLine className="h-4 w-4 mr-2" />
        Insert column after
      </MenuItem>
      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().deleteColumn().run())
        }
        destructive
      >
        <Columns3 className="h-4 w-4 mr-2" />
        Delete column
      </MenuItem>

      <div className="my-1 h-px bg-border" />

      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().addRowBefore().run())
        }
      >
        <ArrowUpToLine className="h-4 w-4 mr-2" />
        Insert row above
      </MenuItem>
      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().addRowAfter().run())
        }
      >
        <ArrowDownToLine className="h-4 w-4 mr-2" />
        Insert row below
      </MenuItem>
      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().deleteRow().run())
        }
        destructive
      >
        <Rows3 className="h-4 w-4 mr-2" />
        Delete row
      </MenuItem>

      <div className="my-1 h-px bg-border" />

      <MenuItem
        onClick={() =>
          runAction(() => editor.chain().focus().deleteTable().run())
        }
        destructive
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete table
      </MenuItem>
    </div>,
    document.body
  );
}

function MenuItem({
  onClick,
  destructive,
  children,
}: {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
          : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      }`}
    >
      {children}
    </button>
  );
}

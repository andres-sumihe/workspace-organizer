import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { Pencil, Trash2 } from "lucide-react";
import type { MathMode } from "./math-input-dialog";

interface MathContextMenuProps {
  editor: Editor;
  onEdit: (latex: string, mode: MathMode, pos: number) => void;
}

interface MenuState {
  x: number;
  y: number;
  pos: number;
  latex: string;
  mode: MathMode;
}

export function MathContextMenu({ editor, onEdit }: MathContextMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const editorElement = editor.view.dom;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if right-clicked on a math node (rendered by KaTeX inside the node view)
      const mathEl =
        target.closest('[data-type="inline-math"]') ??
        target.closest('[data-type="block-math"]') ??
        target.closest(".tiptap-mathematics-render");

      if (!mathEl) return;

      e.preventDefault();
      e.stopPropagation();

      // Find the ProseMirror position for this math node
      const domPos = editor.view.posAtDOM(mathEl, 0);
      const resolvedPos = editor.state.doc.resolve(domPos);
      // Walk up to find the actual math node position
      let nodePos = domPos;
      let node = editor.state.doc.nodeAt(domPos);

      if (!node || (node.type.name !== "inlineMath" && node.type.name !== "blockMath")) {
        // Try the parent's position
        nodePos = resolvedPos.before();
        node = editor.state.doc.nodeAt(nodePos);
      }

      if (!node || (node.type.name !== "inlineMath" && node.type.name !== "blockMath")) {
        return;
      }

      const mode: MathMode = node.type.name === "inlineMath" ? "inline" : "block";
      const latex = (node.attrs as { latex?: string }).latex ?? "";

      const menuW = 180;
      const menuH = 100;
      const x = Math.min(e.clientX, window.innerWidth - menuW);
      const y = Math.min(e.clientY, window.innerHeight - menuH);

      setMenu({ x, y, pos: nodePos, latex, mode });
    };

    editorElement.addEventListener("contextmenu", handleContextMenu);
    return () =>
      editorElement.removeEventListener("contextmenu", handleContextMenu);
  }, [editor]);

  // Close on click outside / Escape / scroll
  useEffect(() => {
    if (!menu) return;

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
  }, [menu, close]);

  if (!menu) return null;

  const handleEdit = () => {
    onEdit(menu.latex, menu.mode, menu.pos);
    close();
  };

  const handleDelete = () => {
    const node = editor.state.doc.nodeAt(menu.pos);
    if (node) {
      editor.chain().focus().deleteRange({
        from: menu.pos,
        to: menu.pos + node.nodeSize,
      }).run();
    }
    close();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ top: menu.y, left: menu.x }}
    >
      <button
        type="button"
        onClick={handleEdit}
        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit formula
      </button>
      <div className="my-1 h-px bg-border" />
      <button
        type="button"
        onClick={handleDelete}
        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </button>
    </div>,
    document.body
  );
}

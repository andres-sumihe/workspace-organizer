import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  Info,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  ADMONITION_TYPES,
  type AdmonitionType,
} from "./admonition-extension";

// ---------------------------------------------------------------------------
// Metadata per type
// ---------------------------------------------------------------------------

const ADMONITION_META: Record<
  AdmonitionType,
  { label: string; icon: typeof Info }
> = {
  note: { label: "Note", icon: BookOpen },
  warning: { label: "Warning", icon: AlertTriangle },
  tip: { label: "Tip", icon: Lightbulb },
  info: { label: "Info", icon: Info },
  danger: { label: "Danger", icon: ShieldAlert },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdmonitionContextMenuProps {
  editor: Editor;
}

export function AdmonitionContextMenu({ editor }: AdmonitionContextMenuProps) {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    nodePos: number;
    currentType: AdmonitionType;
  } | null>(null);

  const close = useCallback(() => setMenu(null), []);

  // Listen for right-click on admonition elements
  useEffect(() => {
    const dom = editor.view.dom;

    function handleContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const admonitionEl = target.closest("div[data-admonition]");
      if (!admonitionEl) return;

      event.preventDefault();

      // Resolve ProseMirror position
      const pos = editor.view.posAtDOM(admonitionEl, 0);
      if (pos < 0) return;

      const $pos = editor.state.doc.resolve(pos);
      let admonitionPos = -1;
      let admonitionType: AdmonitionType = "note";

      for (let d = $pos.depth; d >= 0; d--) {
        const node = $pos.node(d);
        if (node.type.name === "admonition") {
          admonitionPos = $pos.before(d);
          admonitionType = (node.attrs.type as AdmonitionType) || "note";
          break;
        }
      }

      if (admonitionPos < 0) return;

      setMenu({
        x: event.clientX,
        y: event.clientY,
        nodePos: admonitionPos,
        currentType: admonitionType,
      });
    }

    dom.addEventListener("contextmenu", handleContextMenu);
    return () => dom.removeEventListener("contextmenu", handleContextMenu);
  }, [editor]);

  // Close on click / other context menu
  useEffect(() => {
    if (!menu) return;
    const handleClick = () => close();
    document.addEventListener("click", handleClick);
    document.addEventListener("contextmenu", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleClick);
    };
  }, [menu, close]);

  // Close on scroll
  useEffect(() => {
    if (!menu) return;
    const handleScroll = () => close();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [menu, close]);

  if (!menu) return null;

  const changeType = (type: AdmonitionType) => {
    const node = editor.state.doc.nodeAt(menu.nodePos);
    if (node && node.type.name === "admonition") {
      const tr = editor.state.tr.setNodeMarkup(menu.nodePos, undefined, {
        ...node.attrs,
        type,
      });
      editor.view.dispatch(tr);
    }
    close();
  };

  const remove = () => {
    // Place cursor inside the admonition then lift content out
    editor
      .chain()
      .focus()
      .setTextSelection(menu.nodePos + 1)
      .lift("admonition")
      .run();
    close();
  };

  return createPortal(
    <div
      className="fixed z-50 rounded-lg border bg-popover p-1 shadow-md w-44"
      style={{ left: menu.x, top: menu.y }}
    >
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Container Type
      </p>
      {ADMONITION_TYPES.map((type) => {
        const meta = ADMONITION_META[type];
        const Icon = meta.icon;
        return (
          <button
            key={type}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              type === menu.currentType
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
            onClick={() => changeType(type)}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{meta.label}</span>
          </button>
        );
      })}
      <div className="my-1 border-t" />
      <button
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent/50 transition-colors"
        onClick={remove}
      >
        <Trash2 className="h-4 w-4 shrink-0" />
        <span>Remove container</span>
      </button>
    </div>,
    document.body,
  );
}

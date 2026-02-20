/**
 * Custom drag handle — patched fork of tiptap-extension-global-drag-handle@0.1.18
 *
 * Fixes:
 * - Blockquote children resolve to the whole blockquote for drag operations
 *   (original only goes one depth level up, breaking multi-paragraph blockquotes)
 */

import { Extension } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  NodeSelection,
  TextSelection,
} from "@tiptap/pm/state";
import { Slice, Fragment } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DragHandleOptions {
  dragHandleWidth: number;
  scrollTreshold: number;
  excludedTags: string[];
  customNodes: string[];
  dragHandleSelector?: string;
}

interface PluginOptions extends DragHandleOptions {
  pluginKey: string;
}

// ---------------------------------------------------------------------------
// Clipboard serialization
// ---------------------------------------------------------------------------

function serializeForClipboard(
  view: EditorView,
  slice: Slice
): { dom: HTMLElement; text: string } {
  if (typeof view.serializeForClipboard === "function") {
    return view.serializeForClipboard(slice);
  }
  throw new Error("serializeForClipboard not available on EditorView");
}

// ---------------------------------------------------------------------------
// DOM / position helpers
// ---------------------------------------------------------------------------

function absoluteRect(node: Element) {
  const data = node.getBoundingClientRect();
  const modal = node.closest('[role="dialog"]');
  if (modal && window.getComputedStyle(modal).transform !== "none") {
    const modalRect = modal.getBoundingClientRect();
    return {
      top: data.top - modalRect.top,
      left: data.left - modalRect.left,
      width: data.width,
    };
  }
  return { top: data.top, left: data.left, width: data.width };
}

function nodeDOMAtCoords(
  coords: { x: number; y: number },
  options: DragHandleOptions
): Element | undefined {
  const selectors = [
    "li",
    "p:not(:first-child)",
    "pre",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    ...options.customNodes.map((n) => `[data-type=${n}]`),
  ].join(", ");

  const found = document
    .elementsFromPoint(coords.x, coords.y)
    .find(
      (elem) =>
        elem.parentElement?.matches?.(".ProseMirror") || elem.matches(selectors)
    );

  if (!found) return found;

  // FIX: when a child of a blockquote is found, resolve to the blockquote
  // so the entire block is treated as one draggable unit
  const bqParent = found.closest("blockquote");
  if (bqParent && bqParent !== found) {
    return bqParent;
  }

  return found;
}

function nodePosAtDOM(
  node: Element,
  view: EditorView,
  options: DragHandleOptions
): number | undefined {
  // For wrapper nodes (blockquote, pre, etc.), use posAtDOM to get
  // the position of the node itself rather than drilling into children
  const isWrapper = node.matches("blockquote, pre");
  if (isWrapper) {
    const pos = view.posAtDOM(node, 0);
    if (pos >= 0) return pos;
  }

  const rect = node.getBoundingClientRect();
  return view.posAtCoords({
    left: rect.left + 50 + options.dragHandleWidth,
    top: rect.top + 1,
  })?.inside;
}

function calcNodePos(pos: number, view: EditorView): number {
  const $pos = view.state.doc.resolve(pos);
  // Walk up to find blockquote at any depth and resolve to its start
  for (let d = $pos.depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (node.type.name === "blockquote" || node.type.name === "codeBlock") {
      return $pos.before(d);
    }
  }
  if ($pos.depth > 1) {
    return $pos.before($pos.depth);
  }
  return pos;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

function DragHandlePlugin(options: PluginOptions) {
  let listType = "";

  function handleDragStart(event: DragEvent, view: EditorView) {
    view.focus();
    if (!event.dataTransfer) return;

    const node = nodeDOMAtCoords(
      { x: event.clientX + 50 + options.dragHandleWidth, y: event.clientY },
      options
    );
    if (!(node instanceof Element)) return;

    let draggedNodePos = nodePosAtDOM(node, view, options);
    if (draggedNodePos == null || draggedNodePos < 0) return;
    draggedNodePos = calcNodePos(draggedNodePos, view);

    const { from, to } = view.state.selection;
    const diff = from - to;
    const fromSelectionPos = calcNodePos(from, view);

    let differentNodeSelected = false;
    const nodePos = view.state.doc.resolve(fromSelectionPos);

    if (nodePos.node().type.name === "doc") {
      differentNodeSelected = true;
    } else {
      const ns = NodeSelection.create(view.state.doc, nodePos.before());
      differentNodeSelected = !(
        draggedNodePos + 1 >= ns.$from.pos && draggedNodePos <= ns.$to.pos
      );
    }

    let selection = view.state.selection;

    if (
      !differentNodeSelected &&
      diff !== 0 &&
      !(view.state.selection instanceof NodeSelection)
    ) {
      const endSel = NodeSelection.create(view.state.doc, to - 1);
      selection = TextSelection.create(
        view.state.doc,
        draggedNodePos,
        endSel.$to.pos
      );
    } else {
      selection = NodeSelection.create(view.state.doc, draggedNodePos);
      if (
        selection instanceof NodeSelection &&
        (selection.node.type.isInline ||
          selection.node.type.name === "tableRow")
      ) {
        const $pos = view.state.doc.resolve(selection.from);
        selection = NodeSelection.create(view.state.doc, $pos.before());
      }
    }

    view.dispatch(view.state.tr.setSelection(selection));

    if (
      view.state.selection instanceof NodeSelection &&
      view.state.selection.node.type.name === "listItem"
    ) {
      listType = node.parentElement?.tagName ?? "";
    }

    const slice = view.state.selection.content();
    const { dom, text } = serializeForClipboard(view, slice);

    event.dataTransfer.clearData();
    event.dataTransfer.setData("text/html", dom.innerHTML);
    event.dataTransfer.setData("text/plain", text);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setDragImage(node, 0, 0);

    view.dragging = { slice, move: event.ctrlKey };
  }

  // Drag handle element management

  let dragHandleElement: HTMLElement | null = null;

  function hideDragHandle() {
    dragHandleElement?.classList.add("hide");
  }

  function showDragHandle() {
    dragHandleElement?.classList.remove("hide");
  }

  function hideHandleOnEditorOut(event: MouseEvent) {
    if (event.target instanceof Element) {
      const related = event.relatedTarget as Element | null;
      if (
        related?.classList.contains("tiptap") ||
        related?.classList.contains("drag-handle")
      )
        return;
    }
    hideDragHandle();
  }

  return new Plugin({
    key: new PluginKey(options.pluginKey),
    view: (view) => {
      const existing = options.dragHandleSelector
        ? (document.querySelector(options.dragHandleSelector) as HTMLElement | null)
        : null;

      dragHandleElement = existing ?? document.createElement("div");
      dragHandleElement.draggable = true;
      dragHandleElement.dataset.dragHandle = "";
      dragHandleElement.classList.add("drag-handle");

      function onDragStart(e: Event) {
        handleDragStart(e as DragEvent, view);
      }

      dragHandleElement.addEventListener("dragstart", onDragStart);

      function onDrag(e: Event) {
        hideDragHandle();
        const de = e as DragEvent;
        const scrollY = window.scrollY;
        if (de.clientY < options.scrollTreshold) {
          window.scrollTo({ top: scrollY - 30, behavior: "smooth" });
        } else if (window.innerHeight - de.clientY < options.scrollTreshold) {
          window.scrollTo({ top: scrollY + 30, behavior: "smooth" });
        }
      }

      dragHandleElement.addEventListener("drag", onDrag);

      hideDragHandle();

      if (!existing) {
        view.dom.parentElement?.appendChild(dragHandleElement);
      }
      view.dom.parentElement?.addEventListener(
        "mouseout",
        hideHandleOnEditorOut as EventListener
      );

      return {
        destroy: () => {
          if (!existing) dragHandleElement?.remove?.();
          dragHandleElement?.removeEventListener("drag", onDrag);
          dragHandleElement?.removeEventListener("dragstart", onDragStart);
          dragHandleElement = null;
          view.dom.parentElement?.removeEventListener(
            "mouseout",
            hideHandleOnEditorOut as EventListener
          );
        },
      };
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) return;

          const node = nodeDOMAtCoords(
            {
              x: event.clientX + 50 + options.dragHandleWidth,
              y: event.clientY,
            },
            options
          );

          const notDragging = node?.closest(".not-draggable");
          const excludedList = options.excludedTags
            .concat(["ol", "ul"])
            .join(", ");

          if (
            !(node instanceof Element) ||
            node.matches(excludedList) ||
            notDragging
          ) {
            hideDragHandle();
            return;
          }

          const compStyle = window.getComputedStyle(node);
          const lineHeight =
            parseInt(compStyle.lineHeight, 10) ||
            parseInt(compStyle.fontSize) * 1.2;
          const paddingTop = parseInt(compStyle.paddingTop, 10);

          const rect = absoluteRect(node);
          rect.top += (lineHeight - 24) / 2;
          rect.top += paddingTop;

          if (node.matches("ul:not([data-type=taskList]) li, ol li")) {
            rect.left -= options.dragHandleWidth;
          }

          rect.width = options.dragHandleWidth;

          if (!dragHandleElement) return;

          // Hide drag handle when text is selected (avoids overlap with bubble menu)
          const { from, to } = view.state.selection;
          if (from !== to) {
            hideDragHandle();
            return;
          }

          dragHandleElement.style.left = `${rect.left - rect.width}px`;
          dragHandleElement.style.top = `${rect.top}px`;
          showDragHandle();
        },
        keydown: () => {
          hideDragHandle();
        },
        wheel: () => {
          hideDragHandle();
        },
        dragstart: (view) => {
          view.dom.classList.add("dragging");
        },
        drop: (view, event) => {
          view.dom.classList.remove("dragging");
          hideDragHandle();

          let droppedNode = null;
          const dropPos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });

          if (!dropPos) return;

          if (view.state.selection instanceof NodeSelection) {
            droppedNode = view.state.selection.node;
          }

          if (!droppedNode) return;

          const resolvedPos = view.state.doc.resolve(dropPos.pos);
          const isDroppedInsideList =
            resolvedPos.parent.type.name === "listItem";

          if (
            view.state.selection instanceof NodeSelection &&
            view.state.selection.node.type.name === "listItem" &&
            !isDroppedInsideList &&
            listType === "OL"
          ) {
            const newList =
              view.state.schema.nodes.orderedList?.createAndFill(
                null,
                droppedNode
              );
            if (newList) {
              const slice = new Slice(Fragment.from(newList), 0, 0);
              view.dragging = { slice, move: event.ctrlKey };
            }
          }
        },
        dragend: (view) => {
          view.dom.classList.remove("dragging");
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const CustomGlobalDragHandle = Extension.create({
  name: "globalDragHandle",

  addOptions() {
    return {
      dragHandleWidth: 20,
      scrollTreshold: 100,
      excludedTags: [] as string[],
      customNodes: [] as string[],
      dragHandleSelector: undefined as string | undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      DragHandlePlugin({
        pluginKey: "globalDragHandle",
        dragHandleWidth: this.options.dragHandleWidth,
        scrollTreshold: this.options.scrollTreshold,
        dragHandleSelector: this.options.dragHandleSelector,
        excludedTags: this.options.excludedTags,
        customNodes: this.options.customNodes,
      }),
    ];
  },
});

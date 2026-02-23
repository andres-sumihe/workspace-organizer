/**
 * Tiptap Admonition Node — custom container blocks
 *
 * Supports :::type ... ::: syntax (note, warning, tip, info, danger).
 * Integrates with tiptap-markdown via a custom markdown-it block rule.
 */
import { Node, mergeAttributes } from "@tiptap/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ADMONITION_TYPES = [
  "note",
  "warning",
  "tip",
  "info",
  "danger",
] as const;
export type AdmonitionType = (typeof ADMONITION_TYPES)[number];

// ---------------------------------------------------------------------------
// Custom markdown-it plugin for :::type ... ::: blocks
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function markdownItAdmonitionPlugin(md: any) {
  md.block.ruler.before(
    "fence",
    "admonition",
    (state: any, startLine: number, endLine: number, silent: boolean) => {
      const pos = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];

      // Must start with :::
      if (pos + 3 > max) return false;
      if (
        state.src.charCodeAt(pos) !== 0x3a ||
        state.src.charCodeAt(pos + 1) !== 0x3a ||
        state.src.charCodeAt(pos + 2) !== 0x3a
      )
        return false;

      // Extract type name after :::
      const typeStr = state.src.slice(pos + 3, max).trim();
      if (!typeStr) return false; // bare ::: is a closing fence

      if (silent) return true;

      // Find the closing :::
      let nextLine = startLine + 1;
      let found = false;
      while (nextLine < endLine) {
        const np = state.bMarks[nextLine] + state.tShift[nextLine];
        const nm = state.eMarks[nextLine];
        if (
          nm - np >= 3 &&
          state.src.charCodeAt(np) === 0x3a &&
          state.src.charCodeAt(np + 1) === 0x3a &&
          state.src.charCodeAt(np + 2) === 0x3a &&
          state.src.slice(np + 3, nm).trim() === ""
        ) {
          found = true;
          break;
        }
        nextLine++;
      }

      if (!found) return false;

      // Emit opening token
      const openToken = state.push("admonition_open", "div", 1);
      openToken.block = true;
      openToken.map = [startLine, nextLine + 1];
      openToken.attrSet("data-admonition", "");
      openToken.attrSet("data-type", typeStr);

      // Parse inner content as markdown blocks
      const oldParent = state.parentType;
      const oldLineMax = state.lineMax;
      state.parentType = "admonition";
      state.lineMax = nextLine;
      state.md.block.tokenize(state, startLine + 1, nextLine);
      state.parentType = oldParent;
      state.lineMax = oldLineMax;

      // Emit closing token
      const closeToken = state.push("admonition_close", "div", -1);
      closeToken.block = true;

      state.line = nextLine + 1;
      return true;
    },
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Guard against duplicate registration
function useOnceAdmonition(md: { use: (plugin: unknown) => void }) {
  const mdObj = md as unknown as Record<string, boolean>;
  if (!mdObj.__admonition) {
    markdownItAdmonitionPlugin(md);
    mdObj.__admonition = true;
  }
}

// ---------------------------------------------------------------------------
// Command type declarations
// ---------------------------------------------------------------------------

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    admonition: {
      setAdmonition: (attrs?: { type?: AdmonitionType }) => ReturnType;
      toggleAdmonition: (attrs?: { type?: AdmonitionType }) => ReturnType;
      unsetAdmonition: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Node extension
// ---------------------------------------------------------------------------

export const Admonition = Node.create({
  name: "admonition",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      type: {
        default: "note" as AdmonitionType,
        parseHTML: (element) =>
          (element.getAttribute("data-type") as AdmonitionType) || "note",
        renderHTML: (attributes) => ({
          "data-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-admonition]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-admonition": "" }, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setAdmonition:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleAdmonition:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
      unsetAdmonition:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Exit admonition on Enter in an empty last paragraph (needs ≥2 children)
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from, empty } = selection;
        if (!empty) return false;

        const parent = $from.parent;
        if (parent.type.name !== "paragraph" || parent.textContent.length > 0)
          return false;

        let admonitionDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "admonition") {
            admonitionDepth = d;
            break;
          }
        }
        if (admonitionDepth < 0) return false;

        const admonitionNode = $from.node(admonitionDepth);
        if (admonitionNode.childCount < 2) return false;

        const indexInAdmonition = $from.index(admonitionDepth);
        if (indexInAdmonition !== admonitionNode.childCount - 1) return false;

        return editor.commands.lift("admonition");
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          state.write(":::" + (node.attrs.type || "note") + "\n");
          state.renderContent(node);
          state.ensureNewLine();
          state.write(":::");
          state.closeBlock(node);
        },
        parse: {
          setup(md: { use: (plugin: unknown) => void }) {
            useOnceAdmonition(md);
          },
        },
      },
    };
  },
});

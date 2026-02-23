import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DOMParser as PMDOMParser, Slice } from "@tiptap/pm/model";

/**
 * Heuristic: does the plain-text clipboard look like Markdown?
 * Requires at least 2 distinct indicators to avoid false positives.
 */
function looksLikeMarkdown(text: string): boolean {
  let score = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) score++; // headings
    if (/^\s*[-*+]\s/.test(line)) score++; // unordered list
    if (/^\s*\d+\.\s/.test(line)) score++; // ordered list
    if (/^\s*>\s/.test(line)) score++; // blockquote
    if (/^```/.test(line)) score++; // code fence
    if (/^\|.+\|/.test(line)) score++; // table row
    if (/^-{3,}$/.test(line.trim())) score++; // hr
    if (/\[.+\]\(.+\)/.test(line)) score++; // link
    if (/\*\*[^*]+\*\*/.test(line)) score++; // bold
    if (/- \[[ x]\]/.test(line)) score++; // task list
    if (/\$[^$\s][^$]*\$/.test(line)) score += 2; // inline math $...$
    if (/^\$\$\s*$/.test(line.trim())) score += 2; // block math delimiter $$
    if (/^:::\w+/.test(line.trim())) score += 2; // admonition container
    if (score >= 2) return true; // early exit
  }
  return false;
}

/**
 * Intercepts paste events where the clipboard carries both HTML and plain text.
 * When the plain text looks like Markdown, it parses through tiptap-markdown's
 * parser to produce a proper ProseMirror slice instead of letting ProseMirror
 * interpret the HTML (which editors like VS Code wrap in <pre>/<code>).
 *
 * IMPORTANT: We must use raw ProseMirror transactions (not editor.commands)
 * because tiptap-markdown overrides insertContent / insertContentAt to
 * re-parse content through markdown-it — which would double-parse and mangle
 * our already-rendered HTML.
 */
export const PasteMarkdown = Extension.create({
  name: "pasteMarkdown",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("pasteMarkdown"),
        props: {
          handlePaste(view, event) {
            // Skip when pasting files (images are handled elsewhere)
            if (event.clipboardData?.files?.length) return false;

            const text = event.clipboardData?.getData("text/plain");
            const html = event.clipboardData?.getData("text/html");

            // Only intercept when BOTH html AND text are present.
            // If there's no html, the clipboardTextParser from
            // tiptap-markdown will handle it normally.
            if (!text || !html || !looksLikeMarkdown(text)) return false;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parser = (editor.storage as any).markdown?.parser;
            if (!parser) return false;

            event.preventDefault();

            // Parse markdown → HTML via tiptap-markdown's MarkdownParser
            const renderedHtml = parser.parse(text) as string;

            // Build a full ProseMirror document from the parsed HTML.
            // Using parse() (not parseSlice()) ensures block-level nodes
            // like tables are created correctly with proper nesting.
            const wrapper = document.createElement("div");
            wrapper.innerHTML = renderedHtml;

            const pmParser = PMDOMParser.fromSchema(editor.schema);
            const doc = pmParser.parse(wrapper);

            // Extract the doc's content as a flat Slice (openStart=0, openEnd=0)
            // so block nodes like tables are inserted at the top level.
            const slice = new Slice(doc.content, 0, 0);

            const tr = view.state.tr.replaceSelection(slice);
            view.dispatch(tr.scrollIntoView());

            return true;
          },
        },
      }),
    ];
  },
});

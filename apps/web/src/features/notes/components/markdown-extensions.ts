/**
 * Tiptap extensions enhanced with markdown-it plugin integration
 * for tiptap-markdown round-trip support.
 *
 * Adds markdown-it plugins so that:
 *   ~text~   → subscript
 *   ^text^   → superscript
 *   ==text== → highlight / mark
 *   $...$    → inline math (KaTeX)
 *   $$...$$ → block math (KaTeX)
 *
 * Each extension adds `storage.markdown` with serialize + parse specs
 * that tiptap-markdown's getMarkdownSpec() auto-discovers.
 */
import SuperscriptExtension from '@tiptap/extension-superscript';
import SubscriptExtension from '@tiptap/extension-subscript';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { InlineMath, BlockMath } from '@tiptap/extension-mathematics';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — no type declarations
import markdownItSub from 'markdown-it-sub';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — no type declarations
import markdownItSup from 'markdown-it-sup';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — no type declarations
import markdownItMark from 'markdown-it-mark';

// Guard against duplicate plugin registration when parse() is called
// multiple times on the same markdown-it instance.
const loadedPlugins = new WeakSet<object>();

function useOnce(
  md: { use: (plugin: unknown) => void },
  plugin: unknown,
  key: string,
) {
  const tag = `__${key}`;
  const mdObj = md as unknown as Record<string, boolean>;
  if (!mdObj[tag]) {
    md.use(plugin);
    mdObj[tag] = true;
    loadedPlugins.add(md);
  }
}

// ── Superscript with ^text^ markdown round-trip ──────────────────────────────

export const MarkdownSuperscript = SuperscriptExtension.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '^', close: '^', expelEnclosingWhitespace: true },
        parse: {
          setup(md: { use: (plugin: unknown) => void }) {
            useOnce(md, markdownItSup, 'sup');
          },
        },
      },
    };
  },
});

// ── Subscript with ~text~ markdown round-trip ────────────────────────────────

export const MarkdownSubscript = SubscriptExtension.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '~', close: '~', expelEnclosingWhitespace: true },
        parse: {
          setup(md: { use: (plugin: unknown) => void }) {
            useOnce(md, markdownItSub, 'sub');
          },
        },
      },
    };
  },
});

// ── Highlight with ==text== markdown round-trip ──────────────────────────────

export const MarkdownHighlight = Highlight.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '==', close: '==', expelEnclosingWhitespace: true },
        parse: {
          setup(md: { use: (plugin: unknown) => void }) {
            useOnce(md, markdownItMark, 'mark');
          },
        },
      },
    };
  },
});

// ── Math: custom markdown-it plugin for $...$ and $$...$$ ────────────────────

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function markdownItMathPlugin(md: any) {
  // --- Block rule: $$\n...\n$$ ---
  md.block.ruler.before(
    'fence',
    'math_block',
    (state: any, startLine: number, endLine: number, silent: boolean) => {
      const pos = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];
      if (pos + 2 > max) return false;
      if (state.src[pos] !== '$' || state.src[pos + 1] !== '$') return false;
      if (state.src.slice(pos + 2, max).trim()) return false;

      let nextLine = startLine;
      let found = false;
      while (++nextLine < endLine) {
        const np = state.bMarks[nextLine] + state.tShift[nextLine];
        const nm = state.eMarks[nextLine];
        if (
          state.src[np] === '$' &&
          state.src[np + 1] === '$' &&
          state.src.slice(np + 2, nm).trim() === ''
        ) {
          found = true;
          break;
        }
      }

      if (!found) return false;
      if (silent) return true;

      const content = state
        .getLines(startLine + 1, nextLine, state.tShift[startLine], false)
        .trim();
      const token = state.push('math_block', '', 0);
      token.content = content;
      token.block = true;
      token.map = [startLine, nextLine + 1];
      state.line = nextLine + 1;
      return true;
    },
  );

  // --- Inline rule: $...$ ---
  md.inline.ruler.after(
    'escape',
    'math_inline',
    (state: any, silent: boolean) => {
      if (state.src[state.pos] !== '$') return false;
      if (state.src[state.pos + 1] === '$') return false;

      const start = state.pos + 1;
      if (start >= state.posMax) return false;
      const firstChar = state.src[start];
      if (firstChar === ' ' || firstChar === '\t' || firstChar === '\n')
        return false;

      let end = start;
      while (end < state.posMax) {
        if (state.src[end] === '\\') {
          end += 2;
          continue;
        }
        if (state.src[end] === '$') break;
        end++;
      }
      if (end >= state.posMax) return false;
      if (state.src[end - 1] === ' ' || state.src[end - 1] === '\t')
        return false;

      const content = state.src.slice(start, end);
      if (!content) return false;

      if (!silent) {
        const token = state.push('math_inline', '', 0);
        token.content = content;
      }
      state.pos = end + 1;
      return true;
    },
  );

  // --- Render rules: output HTML matching InlineMath/BlockMath parseDOM ---
  md.renderer.rules.math_inline = (tokens: any[], idx: number) =>
    `<span data-type="inline-math" data-latex="${escapeAttr(tokens[idx].content)}"></span>`;

  md.renderer.rules.math_block = (tokens: any[], idx: number) =>
    `<div data-type="block-math" data-latex="${escapeAttr(tokens[idx].content)}"></div>`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── InlineMath with $...$ markdown round-trip ────────────────────────────────

export const MarkdownInlineMath = InlineMath.extend({
  // Input rules disabled — math is inserted via dialog UI
  addInputRules() {
    return [];
  },
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          state.write('$' + node.attrs.latex + '$');
        },
        parse: {
          setup(md: { use: (plugin: unknown) => void }) {
            useOnce(md, markdownItMathPlugin, 'math');
          },
        },
      },
    };
  },
});

// ── BlockMath with $$...$$ markdown round-trip ───────────────────────────────

export const MarkdownBlockMath = BlockMath.extend({
  addInputRules() {
    return [];
  },
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          state.write('$$\n' + node.attrs.latex + '\n$$');
          state.closeBlock(node);
        },
        parse: {
          setup(md: { use: (plugin: unknown) => void }) {
            useOnce(md, markdownItMathPlugin, 'math');
          },
        },
      },
    };
  },
});

// ── Block Image with proper markdown round-trip ──────────────────────────────
// The default prosemirror-markdown image serializer uses state.write() without
// state.closeBlock(), which works for inline images. When Image is configured
// with inline:false (block node), the missing closeBlock causes the next block
// (e.g. --- or ### heading) to be serialized without a blank-line separator.
// Without that separator, markdown-it re-parses --- as a setext H2 marker
// instead of a thematic break, and headings may also be misinterpreted.

export const MarkdownBlockImage = Image.extend({
  addStorage() {
    return {
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          state.write(
            '![' +
              state.esc(node.attrs.alt || '') +
              '](' +
              node.attrs.src.replace(/[()]/g, '\\$&') +
              (node.attrs.title
                ? ' "' + node.attrs.title.replace(/"/g, '\\"') + '"'
                : '') +
              ')',
          );
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});

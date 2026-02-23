import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  ImageIcon,
  Minus,
  Table2,
  Superscript,
  Subscript,
  Sigma,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  command: (props: { editor: SuggestionProps['editor']; range: SuggestionProps['range'] }) => void;
}

interface CommandGroup {
  title: string;
  items: CommandItem[];
}

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CommandCallbacks {
  onImageUpload?: () => void;
  onMathInsert?: (mode: 'inline' | 'block') => void;
}

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

function getCommandGroups(callbacks?: CommandCallbacks): CommandGroup[] {
  return [
    {
      title: 'Headings',
      items: [
        {
          title: 'Heading 1',
          description: 'Large section heading',
          icon: Heading1,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
          },
        },
        {
          title: 'Heading 2',
          description: 'Medium section heading',
          icon: Heading2,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
          },
        },
        {
          title: 'Heading 3',
          description: 'Small section heading',
          icon: Heading3,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
          },
        },
      ],
    },
    {
      title: 'Lists',
      items: [
        {
          title: 'Bullet List',
          description: 'Unordered list with bullets',
          icon: List,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
          },
        },
        {
          title: 'Numbered List',
          description: 'Ordered list with numbers',
          icon: ListOrdered,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
          },
        },
        {
          title: 'Task List',
          description: 'Checklist with checkboxes',
          icon: ListChecks,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
          },
        },
      ],
    },
    {
      title: 'Blocks',
      items: [
        {
          title: 'Blockquote',
          description: 'Quoted text block',
          icon: Quote,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setBlockquote().run();
          },
        },
        {
          title: 'Code Block',
          description: 'Syntax-highlighted code',
          icon: Code2,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setCodeBlock().run();
          },
        },
        {
          title: 'Image',
          description: 'Upload an image',
          icon: ImageIcon,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            callbacks?.onImageUpload?.();
          },
        },
        {
          title: 'Divider',
          description: 'Horizontal rule',
          icon: Minus,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
          },
        },
        {
          title: 'Table',
          description: 'Insert a table',
          icon: Table2,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          },
        },
      ],
    },
    {
      title: 'Inline',
      items: [
        {
          title: 'Superscript',
          description: 'Superscript text',
          icon: Superscript,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleSuperscript().run();
          },
        },
        {
          title: 'Subscript',
          description: 'Subscript text',
          icon: Subscript,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleSubscript().run();
          },
        },
      ],
    },
    {
      title: 'Containers',
      items: [
        {
          title: 'Note',
          description: 'Note container block',
          icon: BookOpen,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setAdmonition({ type: 'note' }).run();
          },
        },
        {
          title: 'Warning',
          description: 'Warning container block',
          icon: AlertTriangle,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setAdmonition({ type: 'warning' }).run();
          },
        },
        {
          title: 'Tip',
          description: 'Tip container block',
          icon: Lightbulb,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setAdmonition({ type: 'tip' }).run();
          },
        },
      ],
    },
    {
      title: 'Math',
      items: [
        {
          title: 'Inline Math',
          description: 'Inline equation ($...$)',
          icon: Sigma,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            callbacks?.onMathInsert?.('inline');
          },
        },
        {
          title: 'Block Math',
          description: 'Block equation ($$...$$)',
          icon: Sigma,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            callbacks?.onMathInsert?.('block');
          },
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// CommandList component (rendered inside tippy popup)
// ---------------------------------------------------------------------------

const CommandList = forwardRef<CommandListRef, SuggestionProps & CommandCallbacks>(
  ({ editor, range, query, onImageUpload, onMathInsert }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const groups = getCommandGroups({ onImageUpload, onMathInsert });

    // Flatten + filter by query
    const filteredGroups = groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.title.toLowerCase().includes(query.toLowerCase())
        ),
      }))
      .filter((group) => group.items.length > 0);

    const allItems = filteredGroups.flatMap((g) => g.items);

    const selectItem = useCallback(
      (index: number) => {
        const item = allItems[index];
        if (item) {
          item.command({ editor, range });
        }
      },
      [allItems, editor, range]
    );

    // Reset selection when query changes
    useEffect(() => {
      setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view on arrow key navigation
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const selected = container.querySelector<HTMLElement>('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + allItems.length - 1) % allItems.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % allItems.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (allItems.length === 0) {
      return (
        <div className="slash-command-menu rounded-lg border bg-popover p-2 shadow-md">
          <p className="px-2 py-1 text-xs text-muted-foreground">No results</p>
        </div>
      );
    }

    let globalIndex = 0;

    return (
      <div ref={containerRef} className="slash-command-menu rounded-lg border bg-popover p-1 shadow-md w-56 max-h-72 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div key={group.title}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => {
              const idx = globalIndex++;
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  data-selected={idx === selectedIndex ? 'true' : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    idx === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => selectItem(idx)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);

CommandList.displayName = 'CommandList';

// ---------------------------------------------------------------------------
// Suggestion options factory — creates the tippy popup
// ---------------------------------------------------------------------------

export function createSlashCommandSuggestion(
  callbacks?: CommandCallbacks
): Omit<SuggestionOptions, 'editor'> {
  return {
    char: '/',
    startOfLine: false,
    items: ({ query }) => {
      // We handle filtering inside CommandList; return query as token
      return [query];
    },
    render: () => {
      let component: ReactRenderer<CommandListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(CommandList, {
            props: { ...props, ...callbacks },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate: (props: SuggestionProps) => {
          component?.updateProps({ ...props, ...callbacks });
          if (props.clientRect && popup?.[0]) {
            popup[0].setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          }
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// SlashCommands extension
// ---------------------------------------------------------------------------

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
      } as Omit<SuggestionOptions, 'editor'>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor: this.editor as any,
        ...this.options.suggestion,
      }),
    ];
  },
});

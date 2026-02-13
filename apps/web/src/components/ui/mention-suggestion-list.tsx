import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";

import { cn } from "@/lib/utils";
import { File, Folder } from "lucide-react";

export interface MentionSuggestionItem {
  id: string;
  label: string;
  type?: "file" | "folder" | string;
  path?: string;
  icon?: React.ReactNode;
  /** Project ID owning this file/folder — used for navigation */
  projectId?: string;
  /** Display name of the owning project */
  projectName?: string;
}

export interface MentionSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionSuggestionListProps {
  items: MentionSuggestionItem[];
  command: (item: MentionSuggestionItem) => void;
}

export const MentionSuggestionList = forwardRef<
  MentionSuggestionListRef,
  MentionSuggestionListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef(command);
  commandRef.current = command;

  useEffect(() => setSelectedIndex(0), [items]);

  // Native mousedown listener to prevent editor blur when clicking suggestions.
  // Must be native (not React synthetic) because the component is rendered in a
  // separate createRoot outside the main React tree.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("mousedown", handler);
    return () => el.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (item: MentionSuggestionItem) => {
      commandRef.current(item);
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) handleSelect(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-popover p-2 shadow-md">
        <p className="text-xs text-muted-foreground">No results found</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="z-50 max-h-60 min-w-55 overflow-y-auto overscroll-contain rounded-md border border-border bg-popover py-1 shadow-md"
    >
      {items.map((item, index) => {
        const icon =
          item.icon ??
          (item.type === "folder" ? (
            <Folder className="h-3.5 w-3.5 text-info" />
          ) : (
            <File className="h-3.5 w-3.5 text-muted-foreground" />
          ));

        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-popover-foreground hover:bg-accent/50"
            )}
            onClick={() => handleSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {icon}
            <span className="truncate">{item.label}</span>
            {item.projectName ? (
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {item.projectName}
              </span>
            ) : item.path ? (
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {item.path}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

MentionSuggestionList.displayName = "MentionSuggestionList";

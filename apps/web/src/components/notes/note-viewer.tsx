import {
  ExternalLink,
  FileText,
  Pencil,
  Pin,
  Search,
  Trash2,
  MonitorSmartphone
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import type { Note } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import { ContentSearchBar, type ContentSearchBarRef } from '@/components/ui/content-search-bar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { markdownComponents, remarkPlugins, rehypePlugins } from './markdown-config';

// Debounce hook for search optimization
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

interface NoteViewerProps {
  note: Note | null;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onPopout?: () => void;
  /** True if the note is currently being edited in a PiP window */
  isPipEditing?: boolean;
  /** True if the note is currently open in a PiP window (viewing or editing) */
  isPipOpen?: boolean;
}

export function NoteViewer({ note, onEdit, onDelete, onPopout, isPipEditing, isPipOpen }: NoteViewerProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const searchBarRef = useRef<ContentSearchBarRef>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Debounce search query for performance (150ms delay)
  const debouncedQuery = useDebouncedValue(searchQuery, 150);

  // Handle Ctrl+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchBarRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Highlight matches in content (uses debounced query for performance)
  useEffect(() => {
    if (!contentRef.current) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const content = contentRef.current;
    
    // Clear existing highlights
    const marks = content.querySelectorAll('mark[data-search-highlight]');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    if (!debouncedQuery.trim()) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`(${debouncedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags);
    let totalMatches = 0;

    textNodes.forEach(textNode => {
      const text = textNode.textContent || '';
      const testText = caseSensitive ? text : text.toLowerCase();
      const testQuery = caseSensitive ? debouncedQuery : debouncedQuery.toLowerCase();
      
      if (testText.includes(testQuery)) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        text.replace(regex, (match, _p1, offset) => {
          if (offset > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
          }
          const mark = document.createElement('mark');
          mark.setAttribute('data-search-highlight', 'true');
          mark.setAttribute('data-match-index', String(totalMatches));
          // Use CSS classes for consistent selection-like appearance
          mark.className = 'bg-blue-200/50 dark:bg-blue-500/30 text-inherit';
          mark.textContent = match;
          fragment.appendChild(mark);
          totalMatches++;
          lastIndex = offset + match.length;
          return match;
        });
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode?.replaceChild(fragment, textNode);
      }
    });

    setMatchCount(totalMatches);
    setCurrentMatch(prev => (totalMatches > 0 && prev >= totalMatches) ? 0 : prev);
  }, [debouncedQuery, caseSensitive, note?.content]);

  // Scroll to current match
  useEffect(() => {
    if (!contentRef.current || matchCount === 0) return;
    
    const marks = contentRef.current.querySelectorAll('mark[data-search-highlight]');
    marks.forEach((mark, idx) => {
      const element = mark as HTMLElement;
      if (idx === currentMatch) {
        element.className = 'bg-blue-300/70 dark:bg-blue-400/50 text-inherit';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        element.className = 'bg-blue-200/50 dark:bg-blue-500/30 text-inherit';
      }
    });
  }, [currentMatch, matchCount]);

  const goToNextMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatch(prev => (prev + 1) % matchCount);
  }, [matchCount]);

  const goToPrevMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatch(prev => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setCaseSensitive(false);
  }, []);

  // Reset search when note changes
  useEffect(() => {
    setSearchQuery('');
    setShowSearch(false);
    setCurrentMatch(0);
    setMatchCount(0);
    setCaseSensitive(false);
  }, [note?.id]);

  if (!note) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Select a note to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {note.isPinned && <Pin className="h-4 w-4 text-primary" />}
          <h2 className="text-[14px] font-semibold">{note.title}</h2>
          {isPipOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <MonitorSmartphone className="h-4 w-4 text-blue-500" />
              </TooltipTrigger>
              <TooltipContent>
                {isPipEditing ? 'Being edited in another window' : 'Open in another window'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => searchBarRef.current?.focus(), 0);
            }}
            title="Search (Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </Button>
          {onPopout && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onPopout} 
              title={isPipOpen ? 'Focus existing window' : 'Open in new window'}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onEdit} 
                  title="Edit"
                  disabled={isPipOpen}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            {isPipOpen && (
              <TooltipContent>
                {isPipEditing 
                  ? 'Note is being edited in another window' 
                  : 'Note is open in another window. Close it first to edit here.'}
              </TooltipContent>
            )}
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(note.id)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      
      <div className="relative flex-1 overflow-hidden">
        {/* Floating search bar - same style as File Manager */}
        {showSearch && (
          <ContentSearchBar
            ref={searchBarRef}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            caseSensitive={caseSensitive}
            onCaseSensitiveChange={setCaseSensitive}
            onNext={goToNextMatch}
            onPrevious={goToPrevMatch}
            onClose={closeSearch}
            currentMatch={currentMatch}
            totalMatches={matchCount}
            placeholder="Find"
          />
        )}
        
        <ScrollArea className="h-full">
          <div ref={contentRef} className="p-6 prose prose-slate dark:prose-invert max-w-none">
            <Markdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents}
            >
              {note.content || '*No content*'}
            </Markdown>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

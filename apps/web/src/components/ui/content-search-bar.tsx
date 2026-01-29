import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { Button } from '@/components/ui/button';

export interface ContentSearchBarProps {
  /** Current search query */
  query: string;
  /** Called when query changes */
  onQueryChange: (query: string) => void;
  /** Whether search is case sensitive */
  caseSensitive: boolean;
  /** Called when case sensitivity toggles */
  onCaseSensitiveChange: (caseSensitive: boolean) => void;
  /** Called when user navigates to next match */
  onNext: () => void;
  /** Called when user navigates to previous match */
  onPrevious: () => void;
  /** Called when search bar is closed */
  onClose: () => void;
  /** Current match index (0-based) */
  currentMatch: number;
  /** Total number of matches */
  totalMatches: number;
  /** Placeholder text */
  placeholder?: string;
}

export interface ContentSearchBarRef {
  focus: () => void;
}

export const ContentSearchBar = forwardRef<ContentSearchBarRef, ContentSearchBarProps>(
  ({ 
    query, 
    onQueryChange, 
    caseSensitive, 
    onCaseSensitiveChange,
    onNext, 
    onPrevious, 
    onClose, 
    currentMatch, 
    totalMatches, 
    placeholder = 'Find' 
  }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus()
    }));

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.shiftKey ? onPrevious() : onNext();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }, [onNext, onPrevious, onClose]);

    const toggleCaseSensitive = useCallback(() => {
      onCaseSensitiveChange(!caseSensitive);
    }, [caseSensitive, onCaseSensitiveChange]);

    return (
      <div className="absolute top-2 right-2 z-10 bg-background border border-border rounded-md shadow-lg p-2 flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-48 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={handleKeyDown}
        />
        <span className="text-xs text-muted-foreground px-1 whitespace-nowrap w-16 mr-4 ">
          {totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : 'No results'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onPrevious}
          disabled={totalMatches === 0}
        >
          <ChevronUp className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onNext}
          disabled={totalMatches === 0}
        >
          <ChevronDown className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${caseSensitive ? 'bg-primary/20 hover:bg-primary/30' : ''}`}
          onClick={toggleCaseSensitive}
          title="Match Case"
        >
          <span className={`text-xs font-semibold ${caseSensitive ? 'text-primary' : 'text-muted-foreground'}`}>Aa</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }
);

ContentSearchBar.displayName = 'ContentSearchBar';

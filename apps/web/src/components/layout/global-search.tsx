import {
  BookOpen,
  Briefcase,
  Code2,
  FileText,
  FolderGit2,
  Loader2,
  Search,
  StickyNote,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { SearchResultItem, SearchResultType } from '@workspace/shared';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGlobalSearch } from '@/features/search/hooks/use-global-search';

interface ResultGroupConfig {
  type: SearchResultType;
  label: string;
  icon: LucideIcon;
}

const RESULT_GROUPS: ResultGroupConfig[] = [
  { type: 'workspace', label: 'Workspaces', icon: FolderGit2 },
  { type: 'personal-project', label: 'Projects', icon: Briefcase },
  { type: 'note', label: 'Notes', icon: StickyNote },
  { type: 'journal', label: 'Journal', icon: BookOpen },
  { type: 'script', label: 'Scripts', icon: Code2 },
  { type: 'team-project', label: 'Team Projects', icon: Users },
];

const getResultSummary = (item: SearchResultItem) => {
  if (item.preview && item.subtitle) {
    return `${item.subtitle} - ${item.preview}`;
  }

  return item.preview ?? item.subtitle;
};

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data, debouncedQuery, isFetching, isError } = useGlobalSearch(query);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const groupedResults = useMemo(() => {
    const items = data?.items ?? [];
    return RESULT_GROUPS.map((config) => ({
      config,
      items: items.filter((item) => item.type === config.type),
    })).filter((group) => group.items.length > 0);
  }, [data?.items]);

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false);
    navigate(item.url);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden h-9 w-72 justify-start gap-2 px-3 text-sm font-normal text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="truncate">Search anything...</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="sr-only">Search</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[18%] max-h-[76vh] translate-y-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Search workspace data.</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="rounded-lg">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search workspaces, projects, notes..."
            />
            <CommandList className="max-h-[58vh] p-2">
              {isFetching ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Searching...</span>
                </div>
              ) : null}

              {isError ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-destructive">
                  <FileText className="size-4" />
                  <span>Search unavailable</span>
                </div>
              ) : null}

              {!isFetching && !isError && debouncedQuery.length >= 2 && groupedResults.length === 0 ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : null}

              {!isFetching && !isError
                    ? groupedResults.map(({ config, items }) => {
                    const GroupIcon = config.icon;

                    return (
                      <CommandGroup key={config.type} heading={config.label}>
                        {items.map((item) => {
                          const summary = getResultSummary(item);

                          return (
                            <CommandItem
                              key={`${item.type}:${item.id}`}
                              value={`${item.type}:${item.id}:${item.title}`}
                              onSelect={() => handleSelect(item)}
                              className="items-start gap-3 rounded-md px-3 py-2"
                            >
                              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                <GroupIcon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                                {summary ? (
                                  <p className="line-clamp-1 text-xs text-muted-foreground">{summary}</p>
                                ) : null}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    );
                  })
                : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};
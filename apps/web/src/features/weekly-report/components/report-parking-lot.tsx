import { useCallback, useState } from 'react';
import { Loader2, ParkingSquare, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCreateWorkLog } from '@/features/journal/hooks/use-work-logs';
import { formatDate } from '@/features/journal/utils/journal-parser';

// ============================================================================
// Props
// ============================================================================

interface ReportParkingLotProps {
  /** Default date for newly created items, e.g. "2025-01-20" */
  date?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Parking Lot — quick-add area that lives below the report.
 * Allows users to jot down new tasks during meetings without leaving the report.
 * New items are created as "todo" work logs for the given date.
 */
export function ReportParkingLot({ date }: ReportParkingLotProps) {
  const [content, setContent] = useState('');
  const createWorkLog = useCreateWorkLog();

  const today = date ?? formatDate(new Date());

  const handleAdd = useCallback(() => {
    const text = content.trim();
    if (!text) return;

    createWorkLog.mutate(
      { date: today, content: text, status: 'todo' },
      { onSuccess: () => setContent('') },
    );
  }, [content, createWorkLog, today]);

  return (
    <Card>
      <CardHeader className="px-4 py-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ParkingSquare className="h-4 w-4 text-muted-foreground" />
          Parking Lot
          <span className="text-xs font-normal text-muted-foreground">
            — Quick capture for new items
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <Input
            placeholder="Add a quick task…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 h-9 text-sm"
            disabled={createWorkLog.isPending}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 gap-1.5"
            disabled={!content.trim() || createWorkLog.isPending}
          >
            {createWorkLog.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

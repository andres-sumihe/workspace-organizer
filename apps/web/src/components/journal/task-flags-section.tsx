import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  Ban,
  Clock,
  Flag,
  HelpCircle,
  MessageSquare,
  Plus,
  X
} from 'lucide-react';

import type { TaskUpdateFlag } from '@workspace/shared';

interface FlagConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const FLAG_CONFIG: Record<TaskUpdateFlag, FlagConfig> = {
  blocked: {
    label: 'Blocked',
    icon: Ban,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  },
  needs_confirmation: {
    label: 'Needs Confirmation',
    icon: HelpCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30'
  },
  on_hold: {
    label: 'On Hold',
    icon: Clock,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 dark:bg-slate-800'
  },
  waiting_feedback: {
    label: 'Waiting Feedback',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  }
};

const ALL_FLAGS: TaskUpdateFlag[] = [
  'blocked',
  'needs_confirmation',
  'urgent',
  'on_hold',
  'waiting_feedback'
];

interface TaskFlagsSectionProps {
  flags: TaskUpdateFlag[];
  onFlagsChange: (flags: TaskUpdateFlag[]) => void;
  readOnly?: boolean;
}

export function TaskFlagsSection({
  flags,
  onFlagsChange,
  readOnly = false
}: TaskFlagsSectionProps) {
  const availableFlags = ALL_FLAGS.filter((f) => !flags.includes(f));

  const handleAddFlag = (flag: TaskUpdateFlag) => {
    onFlagsChange([...flags, flag]);
  };

  const handleRemoveFlag = (flag: TaskUpdateFlag) => {
    onFlagsChange(flags.filter((f) => f !== flag));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
        <Flag className="h-3 w-3" />
        Flags
      </Label>

      <div className="flex flex-wrap gap-2 items-center">
        {flags.length === 0 && !readOnly && (
          <span className="text-xs text-muted-foreground">No flags set</span>
        )}

        {flags.map((flag) => {
          const config = FLAG_CONFIG[flag];
          const Icon = config.icon;
          return (
            <Badge
              key={flag}
              variant="secondary"
              className={`${config.bgColor} ${config.color} gap-1 pr-1`}
            >
              <Icon className="h-3 w-3" />
              {config.label}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => handleRemoveFlag(flag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          );
        })}

        {!readOnly && availableFlags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add Flag
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableFlags.map((flag) => {
                const config = FLAG_CONFIG[flag];
                const Icon = config.icon;
                return (
                  <DropdownMenuItem
                    key={flag}
                    onClick={() => handleAddFlag(flag)}
                    className={`gap-2 ${config.color}`}
                  >
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export { FLAG_CONFIG };

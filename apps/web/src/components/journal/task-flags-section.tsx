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
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

const FLAG_CONFIG: Record<TaskUpdateFlag, FlagConfig> = {
  blocked: {
    label: 'Blocked',
    icon: Ban,
    variant: 'destructive'
  },
  needs_confirmation: {
    label: 'Needs Confirmation',
    icon: HelpCircle,
    variant: 'warning'
  },
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    variant: 'destructive'
  },
  on_hold: {
    label: 'On Hold',
    icon: Clock,
    variant: 'secondary'
  },
  waiting_feedback: {
    label: 'Waiting Feedback',
    icon: MessageSquare,
    variant: 'default'
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
              variant={config.variant}
              className="gap-1 pr-1"
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
                    className="gap-2"
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

import { format, parse, isValid } from 'date-fns';
import { CalendarIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string; // YYYY-MM-DD format
  onChange?: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [month, setMonth] = React.useState<Date | undefined>(
    value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date()
  );

  // Sync input value with prop value
  React.useEffect(() => {
    if (value) {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(date)) {
        setInputValue(format(date, 'dd MMM yyyy'));
        setMonth(date);
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const date = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(date) ? date : undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, 'yyyy-MM-dd');
      onChange?.(formatted);
      setInputValue(format(date, 'dd MMM yyyy'));
      setMonth(date);
      setOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse common date formats
    const formats = ['dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];

    for (const formatStr of formats) {
      const parsedDate = parse(newValue, formatStr, new Date());
      if (isValid(parsedDate)) {
        const formatted = format(parsedDate, 'yyyy-MM-dd');
        onChange?.(formatted);
        setMonth(parsedDate);
        return;
      }
    }

    // If input is cleared
    if (newValue === '') {
      onChange?.('');
    }
  };

  const handleClear = () => {
    onChange?.('');
    setInputValue('');
  };

  return (
    <div className={cn('relative flex gap-2', className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-background pr-16"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="absolute top-1/2 right-8 size-6 -translate-y-1/2"
            disabled={disabled}
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="end" sideOffset={10}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
          onClick={handleClear}
        >
          <XIcon className="size-3.5" />
          <span className="sr-only">Clear date</span>
        </Button>
      )}
    </div>
  );
}

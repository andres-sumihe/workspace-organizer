"use client"

import { format, parse, isValid } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: string // YYYY-MM-DD format
  onChange?: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date | undefined>(
    value ? parse(value, "yyyy-MM-dd", new Date()) : new Date()
  )

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const date = parse(value, "yyyy-MM-dd", new Date())
    return isValid(date) ? date : undefined
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, "yyyy-MM-dd")
      onChange?.(formatted)
      setMonth(date)
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.("")
  }

  const displayValue = selectedDate
    ? format(selectedDate, "dd MMM yyyy")
    : placeholder

  return (
    <div className={cn("relative flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-4" />
            {displayValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
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
          size="icon"
          className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
          onClick={handleClear}
        >
          <XIcon className="size-3.5" />
          <span className="sr-only">Clear date</span>
        </Button>
      )}
    </div>
  )
}

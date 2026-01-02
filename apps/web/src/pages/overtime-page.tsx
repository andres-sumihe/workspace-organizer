import { Calculator, Clock, Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { toolsApi, type OvertimeEntry } from '@/api/tools';
import { AppPage, AppPageContent, AppPageTabs } from '@/components/layout/app-page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type DayType = 'workday' | 'holiday_weekend';

interface CalculatorState {
  startTime: string;
  endTime: string;
  dayType: DayType;
  date: string;
  note: string;
}

interface FilterState {
  month: string; // '01' - '12' or 'all'
  year: string;  // '2024', '2025', etc. or 'all'
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatTime = (timeString: string): string => {
  if (!timeString) return '-';
  return timeString;
};

/**
 * Calculate hours difference between two times in HH:MM format.
 * Handles overnight cases where end time is less than start time.
 */
const calculateHoursFromTime = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  let startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  // Handle overnight case (e.g., 22:00 to 02:00)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }

  const diffMinutes = endMinutes - startMinutes;
  return diffMinutes / 60;
};

/**
 * Check if start time is valid for overtime (17:30+ or before 06:00)
 */
const isValidOvertimeStartTime = (startTime: string): boolean => {
  if (!startTime) return false;
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute;
  
  // Valid: 17:30 (1050 min) to 23:59 (1439 min) OR 00:00 (0 min) to 05:59 (359 min)
  const eveningStart = 17 * 60 + 30; // 17:30 = 1050 minutes
  const morningEnd = 6 * 60 - 1; // 05:59 = 359 minutes
  
  return totalMinutes >= eveningStart || totalMinutes <= morningEnd;
};

const calculateOvertimePay = (baseSalary: number, hours: number, dayType: DayType): number => {
  if (baseSalary <= 0 || hours <= 0) return 0;
  const baseHourly = baseSalary / 173;

  if (dayType === 'workday') {
    const h1 = Math.min(hours, 1);
    const h2 = Math.max(hours - 1, 0);
    return Math.round(baseHourly * (1.5 * h1 + 2 * h2) * 100) / 100;
  } else {
    const h1 = Math.min(hours, 7);
    const h2 = Math.min(Math.max(hours - 7, 0), 1);
    const h3 = Math.max(hours - 8, 0);
    return Math.round(baseHourly * (2 * h1 + 3 * h2 + 4 * h3) * 100) / 100;
  }
};

const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getCurrentYear = (): number => new Date().getFullYear();
const getCurrentMonth = (): number => new Date().getMonth() + 1;

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const getYearOptions = (): string[] => {
  const currentYear = getCurrentYear();
  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(String(y));
  }
  return years;
};

export const OvertimePage = () => {
  // Calculator state
  const [calc, setCalc] = useState<CalculatorState>({
    startTime: '17:30',
    endTime: '19:30',
    dayType: 'workday',
    date: getTodayDate(),
    note: ''
  });
  
  // Settings state
  const [savedBaseSalary, setSavedBaseSalary] = useState<number | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // Entries state
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  
  // Filter state - default to current month/year
  const [filter, setFilter] = useState<FilterState>({
    month: String(getCurrentMonth()).padStart(2, '0'),
    year: String(getCurrentYear())
  });
  
  // Visibility state for salary (shared between calculator and tracker)
  const [showSalary, setShowSalary] = useState(false);
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<OvertimeEntry | null>(null);

  // Load settings and entries
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settings, entriesResponse] = await Promise.all([
          toolsApi.getGeneralSettings(),
          toolsApi.listOvertimeEntries()
        ]);
        
        setSavedBaseSalary(settings.baseSalary);
        setEntries(entriesResponse.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setSettingsLoading(false);
        setEntriesLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate preview
  const preview = useMemo(() => {
    const salary = savedBaseSalary || 0;
    const hours = calculateHoursFromTime(calc.startTime, calc.endTime);
    
    if (salary <= 0 || hours <= 0) {
      return { baseHourly: 0, payAmount: 0, totalHours: 0 };
    }

    return {
      baseHourly: Math.round((salary / 173) * 100) / 100,
      payAmount: calculateOvertimePay(salary, hours, calc.dayType),
      totalHours: hours
    };
  }, [savedBaseSalary, calc.startTime, calc.endTime, calc.dayType]);

  // Filter entries by month/year
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const entryDate = new Date(entry.date + 'T00:00:00');
      const entryMonth = String(entryDate.getMonth() + 1).padStart(2, '0');
      const entryYear = String(entryDate.getFullYear());
      
      const monthMatch = filter.month === 'all' || entryMonth === filter.month;
      const yearMatch = filter.year === 'all' || entryYear === filter.year;
      
      return monthMatch && yearMatch;
    });
  }, [entries, filter]);

  // Refresh entries
  const refreshEntries = useCallback(async () => {
    try {
      const response = await toolsApi.listOvertimeEntries();
      setEntries(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh entries');
    }
  }, []);

  // Validation helpers
  const startTimeValid = isValidOvertimeStartTime(calc.startTime);
  const durationValid = preview.totalHours > 1;

  // Save entry
  const handleSaveEntry = async () => {
    if (!savedBaseSalary || savedBaseSalary <= 0) {
      setError('Please configure your base salary in Settings → Tools first');
      return;
    }
    if (!calc.date) {
      setError('Please select a date');
      return;
    }
    if (!calc.startTime || !calc.endTime) {
      setError('Please enter start and end times');
      return;
    }
    if (!startTimeValid) {
      setError('Overtime start time must be 5:30 PM or later, or before 6:00 AM');
      return;
    }
    if (!durationValid) {
      setError('Overtime duration must be more than 1 hour');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await toolsApi.createOvertimeEntry({
        date: calc.date,
        dayType: calc.dayType,
        startTime: calc.startTime,
        endTime: calc.endTime,
        note: calc.note || undefined
      });

      setSuccessMessage('Overtime entry saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Reset form (keep default times)
      setCalc(prev => ({
        ...prev,
        startTime: '17:30',
        endTime: '19:30',
        date: getTodayDate(),
        note: ''
      }));

      // Refresh entries
      await refreshEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      await toolsApi.deleteOvertimeEntry(entryToDelete.id);
      setSuccessMessage('Entry deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      await refreshEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setEntryToDelete(null);
    }
  };

  // Calculate totals for filtered entries
  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => ({
        hours: acc.hours + entry.totalHours,
        pay: acc.pay + entry.payAmount
      }),
      { hours: 0, pay: 0 }
    );
  }, [filteredEntries]);

  // Get filter label for display
  const filterLabel = useMemo(() => {
    if (filter.month === 'all' && filter.year === 'all') return 'All Time';
    if (filter.month === 'all') return `Year ${filter.year}`;
    if (filter.year === 'all') return MONTHS.find(m => m.value === filter.month)?.label || '';
    const monthName = MONTHS.find(m => m.value === filter.month)?.label || '';
    return `${monthName} ${filter.year}`;
  }, [filter]);

  if (settingsLoading) {
    return (
      <AppPage title="Overtime" description="Calculate and track overtime hours">
        <AppPageContent className="flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </AppPageContent>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="Overtime"
      description="Calculate and track overtime hours"
      actions={
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Overtime Calculator</span>
        </div>
      }
    >
      <Tabs defaultValue="calculator" className="flex-1 flex flex-col">
        <AppPageTabs
          tabs={
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="calculator">Calculator</TabsTrigger>
              <TabsTrigger value="tracker">
                Tracker
                {filteredEntries.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredEntries.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          }
        >
          {/* Calculator Tab */}
          <TabsContent value="calculator" className="flex-1 m-0 overflow-auto p-6">
            <div className="max-w-2xl space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert variant="success">
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}

              {savedBaseSalary === null && (
                <Alert variant="warning">
                  <AlertDescription>
                    No base salary configured. Set it in{' '}
                    <strong>Settings → Tools → General</strong> before recording overtime.
                  </AlertDescription>
                </Alert>
              )}

              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Overtime Calculator</h2>
                    <p className="text-sm text-muted-foreground">
                      Calculate overtime pay based on Indonesian labor law multipliers.
                    </p>
                  </div>

                  {/* Base Salary Display (Read-only) */}
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">Base Salary (Monthly)</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowSalary(!showSalary)}
                            title={showSalary ? 'Hide salary' : 'Show salary'}
                          >
                            {showSalary ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-2xl font-bold">
                          {savedBaseSalary ? (
                            showSalary ? formatCurrency(savedBaseSalary) : 'Rp ••••••••'
                          ) : (
                            '-'
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Hourly rate: {savedBaseSalary ? (
                            showSalary ? formatCurrency(savedBaseSalary / 173) : 'Rp ••••••'
                          ) : (
                            '-'
                          )} (salary ÷ 173)
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = '/settings'}
                      >
                        Change in Settings
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={calc.date}
                        onChange={(e) => setCalc({ ...calc, date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dayType">Day Type</Label>
                      <Select
                        value={calc.dayType}
                        onValueChange={(value: DayType) => setCalc({ ...calc, dayType: value })}
                      >
                        <SelectTrigger id="dayType">
                          <SelectValue placeholder="Select day type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="workday">Work Day</SelectItem>
                          <SelectItem value="holiday_weekend">Holiday / Weekend</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {calc.dayType === 'workday'
                          ? '1st hour: 1.5×, 2nd+ hours: 2×'
                          : '1-7h: 2×, 8th: 3×, 9th+: 4×'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={calc.startTime}
                        onChange={(e) => setCalc({ ...calc, startTime: e.target.value })}
                        className={!startTimeValid && calc.startTime ? 'border-destructive' : ''}
                      />
                      {!startTimeValid && calc.startTime && (
                        <p className="text-xs text-destructive">
                          Must be 5:30 PM or later, or before 6:00 AM
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={calc.endTime}
                        onChange={(e) => setCalc({ ...calc, endTime: e.target.value })}
                        className={!durationValid && preview.totalHours > 0 ? 'border-destructive' : ''}
                      />
                      <p className={`text-xs ${!durationValid && preview.totalHours > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Duration: {preview.totalHours > 0 ? `${preview.totalHours.toFixed(1)} hours` : '-'}
                        {calc.startTime && calc.endTime && calc.endTime < calc.startTime && (
                          <span className="text-amber-500"> (overnight)</span>
                        )}
                        {!durationValid && preview.totalHours > 0 && (
                          <span> - Must be more than 1 hour</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Note (optional)</Label>
                    <Textarea
                      id="note"
                      value={calc.note}
                      onChange={(e) => setCalc({ ...calc, note: e.target.value })}
                      placeholder="e.g., Project deployment, urgent fix..."
                      rows={2}
                    />
                  </div>

                  {/* Result Preview */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Estimated Pay</p>
                        <p className="text-3xl font-bold text-primary">
                          {preview.payAmount > 0 ? formatCurrency(preview.payAmount) : '-'}
                        </p>
                      </div>
                      <Button
                        onClick={handleSaveEntry}
                        disabled={isSaving || !savedBaseSalary || !startTimeValid || !durationValid}
                        className="flex items-center gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Save Entry
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Formula Reference */}
              <Card className="p-6">
                <h3 className="font-semibold mb-3">Formula Reference</h3>
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="font-medium text-foreground mb-1">Work Day</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• 1st hour: 1.5× base hourly</li>
                      <li>• 2nd hour onwards: 2× base hourly</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Holiday / Weekend</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Hours 1-7: 2× base hourly</li>
                      <li>• 8th hour: 3× base hourly</li>
                      <li>• 9th hour onwards: 4× base hourly</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Base hourly rate = Monthly salary ÷ 173
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* Tracker Tab */}
          <TabsContent value="tracker" className="flex-1 m-0 overflow-auto p-6">
            <div className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert variant="success">
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}

              {/* Filter Controls */}
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="filterMonth" className="text-sm font-medium">Month:</Label>
                    <Select
                      value={filter.month}
                      onValueChange={(value) => setFilter(prev => ({ ...prev, month: value }))}
                    >
                      <SelectTrigger id="filterMonth" className="w-[140px]">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {MONTHS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="filterYear" className="text-sm font-medium">Year:</Label>
                    <Select
                      value={filter.year}
                      onValueChange={(value) => setFilter(prev => ({ ...prev, year: value }))}
                    >
                      <SelectTrigger id="filterYear" className="w-[100px]">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {getYearOptions().map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1" />

                  <Badge variant="outline" className="text-sm">
                    Showing: {filterLabel}
                  </Badge>
                </div>
              </Card>

              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-bold">{filteredEntries.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{totals.hours.toFixed(1)}h</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totals.pay)}</p>
                </Card>
              </div>

              {/* Entries Table */}
              <Card>
                {entriesLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading entries...</span>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Clock className="size-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No overtime entries for {filterLabel}</p>
                    <p className="text-sm text-muted-foreground/80">
                      Use the Calculator tab to add your first entry
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>Salary</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowSalary(!showSalary)}
                              title={showSalary ? 'Hide salary column' : 'Show salary column'}
                            >
                              {showSalary ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Pay</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {formatDate(entry.date)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={entry.dayType === 'workday' ? 'secondary' : 'warning'}
                            >
                              {entry.dayType === 'workday' ? 'Work Day' : 'Holiday'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.totalHours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {showSalary ? formatCurrency(entry.baseSalary) : '••••••'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-primary">
                            {formatCurrency(entry.payAmount)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {entry.note || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setEntryToDelete(entry)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </TabsContent>
        </AppPageTabs>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Overtime Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the overtime entry for{' '}
              <strong>{entryToDelete && formatDate(entryToDelete.date)}</strong> (
              {entryToDelete?.totalHours.toFixed(1)}h, {entryToDelete && formatCurrency(entryToDelete.payAmount)}
              ). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
};

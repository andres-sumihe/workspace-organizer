import * as chrono from 'chrono-node';

/**
 * Result of parsing a work log entry content for smart suggestions
 */
export interface ParsedContentSuggestions {
  /** Extracted hashtags (without the # prefix) */
  hashtags: string[];
  /** Suggested date for the log entry (when the task happens) */
  suggestedDate?: string; // YYYY-MM-DD format
  /** Parsed due date (deadline) from "due: <date>" pattern */
  suggestedDueDate?: string; // YYYY-MM-DD format
  /** Parsed priority from "priority: <level>" pattern */
  suggestedPriority?: 'low' | 'medium' | 'high';
  /** Parsed project name from "project: <name>" pattern */
  suggestedProject?: string;
  /** Cleaned content with autofill directives removed */
  cleanedContent: string;
}

/**
 * Parse content text to extract:
 * 1. Hashtags (e.g., #dev, #meeting, #docs)
 * 2. Date for entry (e.g., "tomorrow", "next Monday" - when task happens)
 * 3. Due date from "due: <date>" pattern (deadline)
 * 4. Priority from "priority: <level>" pattern
 * 5. Project from "project: <name>" pattern
 * 6. Clean content (removes autofill directives, keeps actual content + hashtags)
 */
export function parseContentForSuggestions(
  content: string,
  referenceDate?: Date
): ParsedContentSuggestions {
  const result: ParsedContentSuggestions = {
    hashtags: [],
    cleanedContent: content
  };

  const refDate = referenceDate ?? new Date();

  // 1. Extract hashtags using regex
  const hashtagRegex = /#([a-zA-Z][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  const seenTags = new Set<string>();

  while ((match = hashtagRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!seenTags.has(tag)) {
      seenTags.add(tag);
      result.hashtags.push(tag);
    }
  }

  // Track what to remove from content
  let cleanedContent = content;

  // 2. Extract priority from "priority: <level>" pattern and remove it
  const priorityMatch = content.match(/priority:\s*(low|medium|high)/i);
  if (priorityMatch) {
    result.suggestedPriority = priorityMatch[1].toLowerCase() as 'low' | 'medium' | 'high';
    // Remove the priority directive from content
    cleanedContent = cleanedContent.replace(/priority:\s*(low|medium|high)/gi, '');
  }

  // 3. Extract project from "project: <name>" pattern and remove it
  // Project name can contain letters, numbers, spaces, and hyphens
  const projectMatch = content.match(/project:\s*([a-zA-Z0-9][a-zA-Z0-9\s\-_]*)/i);
  if (projectMatch) {
    result.suggestedProject = projectMatch[1].trim();
    // Remove the project directive from content
    cleanedContent = cleanedContent.replace(/project:\s*[a-zA-Z0-9][a-zA-Z0-9\s\-_]*/gi, '');
  }

  // 4. Extract due date from "due: <date>" pattern and remove it
  const dueMatch = content.match(/due:\s*([^,.\n]+)/i);
  if (dueMatch) {
    const dueText = dueMatch[1].trim();
    const dueParsed = chrono.parse(dueText, refDate, { forwardDate: true });
    if (dueParsed.length > 0) {
      result.suggestedDueDate = formatDate(dueParsed[0].start.date());
      // Remove the due date directive from content
      cleanedContent = cleanedContent.replace(/due:\s*[^,.\n]+/gi, '');
    }
  }

  // 5. Parse general date for the entry (when task happens)
  // Use already cleaned content to avoid false matches
  const parsedResults = chrono.parse(cleanedContent, refDate, { forwardDate: true });
  
  // Take the first parsed date as the entry date
  if (parsedResults.length > 0) {
    result.suggestedDate = formatDate(parsedResults[0].start.date());
    
    // Remove the parsed date text AND any preceding preposition
    // Common prepositions: by, on, at, for, before, after, until, till, around
    const parsedText = parsedResults[0].text;
    const parsedIndex = parsedResults[0].index;
    
    // Check for preposition before the date (look back up to 10 chars)
    const textBefore = cleanedContent.substring(Math.max(0, parsedIndex - 10), parsedIndex);
    const prepositionMatch = textBefore.match(/\b(by|on|at|for|before|after|until|till|around)\s*$/i);
    
    if (prepositionMatch) {
      // Remove preposition + date
      const prepositionStart = parsedIndex - prepositionMatch[0].length;
      cleanedContent = 
        cleanedContent.substring(0, prepositionStart) + 
        cleanedContent.substring(parsedIndex + parsedText.length);
    } else {
      // Just remove the date
      cleanedContent = cleanedContent.replace(parsedText, '');
    }
  }

  // 5. Final cleanup: remove extra whitespace, trim
  cleanedContent = cleanedContent
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .trim();

  result.cleanedContent = cleanedContent;

  return result;
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust for Monday start (0 = Sunday in JS)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Get an array of dates for a week (Monday to Sunday)
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Format a date for display (e.g., "Mon, Jan 12")
 */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date for full display (e.g., "Monday, January 12, 2026")
 */
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Get yesterday's date string (YYYY-MM-DD)
 */
export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
export function getTodayDate(): string {
  return formatDate(new Date());
}

/**
 * Parse a YYYY-MM-DD string to a Date object
 */
export function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the week range label (e.g., "Jan 6 - Jan 12, 2026")
 */
export function getWeekRangeLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const endDay = weekEnd.getDate();
  const year = weekEnd.getFullYear();
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Format a date string or Date object to human-readable format (e.g., "13 Jan 2026")
 */
export function formatDateDisplay(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseDate(date) : date;
  
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const year = dateObj.getFullYear();
  
  return `${day} ${month} ${year}`;
}

/**
 * Format a timestamp to human-readable format with time (e.g., "13 Jan 2026, 14:30")
 */
export function formatTimestampDisplay(timestamp: string | Date): string {
  const dateObj = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const year = dateObj.getFullYear();
  const time = dateObj.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  return `${day} ${month} ${year}, ${time}`;
}

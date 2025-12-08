import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * Format Control-M time string (HHMM or HH:MM) to display format HH:MM
 * Examples: "0730" -> "07:30", "1800" -> "18:00", "07:30" -> "07:30"
 */
export const formatTime = (time: string | undefined): string => {
  if (!time) return '';

  // Already formatted with colon
  if (time.includes(':')) return time;

  // HHMM format (4 digits)
  if (/^\d{4}$/.test(time)) {
    return `${time.slice(0, 2)}:${time.slice(2)}`;
  }

  // HMM format (3 digits, e.g., "730" -> "07:30")
  if (/^\d{3}$/.test(time)) {
    return `0${time.slice(0, 1)}:${time.slice(1)}`;
  }

  // Return as-is if unknown format
  return time;
}
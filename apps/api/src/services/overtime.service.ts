import { randomUUID } from 'node:crypto';

import { settingsService } from './settings.service.js';
import { overtimeRepository, type ListOvertimeEntriesParams } from '../repositories/overtime.repository.js';

import type { OvertimeEntry, OvertimeDayType, CreateOvertimeEntryRequest } from '@workspace/shared';

/**
 * Validate that start time is valid for overtime.
 * Valid overtime start times are:
 * - 17:30 (5:30 PM) to 23:59 (11:59 PM) - evening overtime
 * - 00:00 to 05:59 (before 6 AM) - early morning/overnight
 * 
 * @param startTime - Start time in HH:MM format (24-hour)
 * @returns true if valid, false otherwise
 */
export const isValidOvertimeStartTime = (startTime: string): boolean => {
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute;
  
  // Valid: 17:30 (1050 min) to 23:59 (1439 min) OR 00:00 (0 min) to 05:59 (359 min)
  const eveningStart = 17 * 60 + 30; // 17:30 = 1050 minutes
  const morningEnd = 6 * 60 - 1; // 05:59 = 359 minutes
  
  return totalMinutes >= eveningStart || totalMinutes <= morningEnd;
};

/**
 * Calculate hours difference between two times in HH:MM format.
 * Handles overnight cases where end time is less than start time.
 * 
 * @param startTime - Start time in HH:MM format (24-hour)
 * @param endTime - End time in HH:MM format (24-hour)
 * @returns Number of hours as decimal (e.g., 1.5 for 1 hour 30 minutes)
 */
export const calculateHoursFromTime = (startTime: string, endTime: string): number => {
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
 * Calculate overtime pay for a single day.
 * 
 * Formula:
 * - baseHourly = baseSalary / 173
 * 
 * Work Day (total hours = h):
 * - First 1 hour: 1.5 × baseHourly
 * - Remaining hours: 2 × baseHourly per hour
 * - pay = baseHourly * (1.5 * min(h, 1) + 2 * max(h - 1, 0))
 * 
 * Holiday/Weekend (total hours = h):
 * - First 7 hours: 2 × baseHourly
 * - 8th hour: 3 × baseHourly
 * - 9th+ hours: 4 × baseHourly
 * - pay = baseHourly * (2 * min(h, 7) + 3 * clamp(h - 7, 0, 1) + 4 * max(h - 8, 0))
 * 
 * @param baseSalary - Monthly base salary
 * @param hours - Total overtime hours
 * @param dayType - Type of day (workday or holiday_weekend)
 * @returns Calculated pay amount rounded to 2 decimals
 */
export const calculateOvertimePay = (
  baseSalary: number,
  hours: number,
  dayType: OvertimeDayType
): number => {
  if (baseSalary <= 0 || hours <= 0) {
    return 0;
  }

  const baseHourly = baseSalary / 173;

  let pay: number;

  if (dayType === 'workday') {
    // Work Day formula
    const h1 = Math.min(hours, 1); // First hour
    const h2 = Math.max(hours - 1, 0); // Remaining hours
    pay = baseHourly * (1.5 * h1 + 2 * h2);
  } else {
    // Holiday/Weekend formula
    const h1 = Math.min(hours, 7); // First 7 hours
    const h2 = Math.min(Math.max(hours - 7, 0), 1); // 8th hour (clamped to 0-1)
    const h3 = Math.max(hours - 8, 0); // 9th+ hours
    pay = baseHourly * (2 * h1 + 3 * h2 + 4 * h3);
  }

  // Round to 2 decimal places using half-up rounding
  return Math.round(pay * 100) / 100;
};

export const overtimeService = {
  /**
   * Calculate overtime pay without saving
   */
  calculatePay: calculateOvertimePay,

  /**
   * Create a new overtime entry with calculated pay
   * @throws Error if effective salary is not configured or invalid
   * @throws Error if times are invalid
   */
  async createEntry(request: CreateOvertimeEntryRequest): Promise<OvertimeEntry> {
    // Validate time format HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(request.startTime)) {
      throw new Error('Start time must be in HH:MM format (24-hour)');
    }
    if (!timeRegex.test(request.endTime)) {
      throw new Error('End time must be in HH:MM format (24-hour)');
    }

    // Validate start time is valid overtime hours (17:30+ or before 06:00)
    if (!isValidOvertimeStartTime(request.startTime)) {
      throw new Error('Overtime start time must be 5:30 PM or later, or before 6:00 AM');
    }

    // Calculate hours from start/end times
    const totalHours = calculateHoursFromTime(request.startTime, request.endTime);
    
    // Validate minimum duration (more than 1 hour)
    if (totalHours <= 1) {
      throw new Error('Overtime duration must be more than 1 hour');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(request.date)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }

    // Validate day type
    if (request.dayType !== 'workday' && request.dayType !== 'holiday_weekend') {
      throw new Error('Day type must be "workday" or "holiday_weekend"');
    }

    // Determine effective salary
    let effectiveSalary: number;

    if (request.baseSalaryOverride !== undefined && request.baseSalaryOverride !== null) {
      // Use override if provided
      if (request.baseSalaryOverride <= 0) {
        throw new Error('Base salary override must be greater than 0');
      }
      effectiveSalary = request.baseSalaryOverride;
    } else {
      // Fetch from settings
      const settings = await settingsService.getToolsGeneralSettings();
      if (settings.baseSalary === null || settings.baseSalary <= 0) {
        throw new Error('Base salary is not configured. Please set it in Settings → Tools → General');
      }
      effectiveSalary = settings.baseSalary;
    }

    // Calculate pay
    const payAmount = calculateOvertimePay(effectiveSalary, totalHours, request.dayType);

    // Create entry
    return overtimeRepository.createEntry({
      id: randomUUID(),
      date: request.date,
      dayType: request.dayType,
      startTime: request.startTime,
      endTime: request.endTime,
      totalHours,
      payAmount,
      baseSalary: effectiveSalary,
      note: request.note
    });
  },

  /**
   * List overtime entries with optional date range filter
   */
  async listEntries(params?: ListOvertimeEntriesParams): Promise<OvertimeEntry[]> {
    return overtimeRepository.listEntries(params);
  },

  /**
   * Delete an overtime entry by ID
   * @returns true if deleted, false if not found
   */
  async deleteEntry(id: string): Promise<boolean> {
    return overtimeRepository.deleteEntry(id);
  },

  /**
   * Get overtime statistics for a date range
   */
  async getStatistics(params?: ListOvertimeEntriesParams) {
    return overtimeRepository.getStatistics(params);
  }
};

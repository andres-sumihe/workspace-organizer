import { getDb } from '../db/client.js';

import type { OvertimeEntry, OvertimeDayType } from '@workspace/shared';

interface OvertimeEntryRow {
  id: string;
  date: string;
  day_type: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  pay_amount: number;
  base_salary: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const isOvertimeEntryRow = (value: unknown): value is OvertimeEntryRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.day_type === 'string' &&
    typeof candidate.start_time === 'string' &&
    typeof candidate.end_time === 'string' &&
    typeof candidate.total_hours === 'number' &&
    typeof candidate.pay_amount === 'number' &&
    typeof candidate.base_salary === 'number' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToEntry = (row: OvertimeEntryRow): OvertimeEntry => ({
  id: row.id,
  date: row.date,
  dayType: row.day_type as OvertimeDayType,
  startTime: row.start_time,
  endTime: row.end_time,
  totalHours: row.total_hours,
  payAmount: row.pay_amount,
  baseSalary: row.base_salary,
  note: row.note ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateOvertimeEntryData {
  id: string;
  date: string;
  dayType: OvertimeDayType;
  startTime: string;
  endTime: string;
  totalHours: number;
  payAmount: number;
  baseSalary: number;
  note?: string;
}

export interface ListOvertimeEntriesParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export const overtimeRepository = {
  /**
   * Create a new overtime entry
   */
  async createEntry(data: CreateOvertimeEntryData): Promise<OvertimeEntry> {
    const db = await getDb();

    await db.run(
      `INSERT INTO overtime_entries (id, date, day_type, start_time, end_time, total_hours, pay_amount, base_salary, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.date,
        data.dayType,
        data.startTime,
        data.endTime,
        data.totalHours,
        data.payAmount,
        data.baseSalary,
        data.note ?? null
      ]
    );

    const entry = await this.getById(data.id);
    if (!entry) throw new Error(`Failed to retrieve entry after insert: ${data.id}`);
    return entry;
  },

  /**
   * Get overtime entry by ID
   */
  async getById(id: string): Promise<OvertimeEntry | null> {
    const db = await getDb();
    const row = await db.get('SELECT * FROM overtime_entries WHERE id = ?', [id]);
    if (!isOvertimeEntryRow(row)) return null;
    return mapRowToEntry(row);
  },

  /**
   * List overtime entries, optionally filtered by date range
   * Returns entries ordered newest to oldest
   */
  async listEntries(params: ListOvertimeEntriesParams = {}): Promise<OvertimeEntry[]> {
    const db = await getDb();
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    if (params.from) {
      conditions.push('date >= ?');
      queryParams.push(params.from);
    }

    if (params.to) {
      conditions.push('date <= ?');
      queryParams.push(params.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM overtime_entries ${whereClause} ORDER BY date DESC, created_at DESC`;

    const rows = await db.all(query, queryParams);
    if (!Array.isArray(rows)) return [];
    return rows.filter(isOvertimeEntryRow).map(mapRowToEntry);
  },

  /**
   * Delete an overtime entry by ID
   * Returns true if deleted, false if not found
   */
  async deleteEntry(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.run('DELETE FROM overtime_entries WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  },

  /**
   * Get total overtime statistics for a date range
   */
  async getStatistics(params: ListOvertimeEntriesParams = {}): Promise<{
    totalEntries: number;
    totalHours: number;
    totalPay: number;
  }> {
    const db = await getDb();
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    if (params.from) {
      conditions.push('date >= ?');
      queryParams.push(params.from);
    }

    if (params.to) {
      conditions.push('date <= ?');
      queryParams.push(params.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(total_hours), 0) as total_hours,
        COALESCE(SUM(pay_amount), 0) as total_pay
      FROM overtime_entries ${whereClause}
    `;

    const result = await db.get(query, queryParams);
    
    if (!result || typeof result !== 'object') {
      return { totalEntries: 0, totalHours: 0, totalPay: 0 };
    }

    const row = result as Record<string, unknown>;
    return {
      totalEntries: typeof row.total_entries === 'number' ? row.total_entries : 0,
      totalHours: typeof row.total_hours === 'number' ? row.total_hours : 0,
      totalPay: typeof row.total_pay === 'number' ? row.total_pay : 0
    };
  }
};

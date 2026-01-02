import type Database from 'better-sqlite3';

export const id = '0015-add-overtime-time-columns';

export const up = async (db: Database.Database) => {
  // Add start_time and end_time columns to overtime_entries
  db.exec(`
    ALTER TABLE overtime_entries ADD COLUMN start_time TEXT;
    ALTER TABLE overtime_entries ADD COLUMN end_time TEXT;
  `);

  // For existing entries without time, set default values based on total_hours
  // Assuming work started at 17:00 (5 PM) for existing entries
  db.exec(`
    UPDATE overtime_entries 
    SET 
      start_time = '17:00',
      end_time = printf('%02d:%02d', 
        17 + CAST(total_hours AS INTEGER), 
        CAST((total_hours - CAST(total_hours AS INTEGER)) * 60 AS INTEGER)
      )
    WHERE start_time IS NULL;
  `);
};




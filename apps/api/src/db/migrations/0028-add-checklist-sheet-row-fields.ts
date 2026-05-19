import type Database from 'better-sqlite3';

export const id = '0028-add-checklist-sheet-row-fields';

const columns: Array<{ name: string; definition: string }> = [
  { name: 'group_title', definition: 'TEXT' },
  { name: 'planned_date', definition: 'TEXT' },
  { name: 'planned_time', definition: 'TEXT' },
  { name: 'location', definition: 'TEXT' },
  { name: 'pic', definition: 'TEXT' },
];

export const up = async (db: Database.Database): Promise<void> => {
  const tableInfo = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='project_checklist_items'"
  ).get() as { name?: string } | undefined;

  if (!tableInfo) return;

  const existingColumnsRaw = db.prepare('PRAGMA table_info(project_checklist_items)').all();
  const existingColumns = Array.isArray(existingColumnsRaw)
    ? (existingColumnsRaw as Array<{ name?: string }>)
    : [];
  const hasColumn = (column: string): boolean => existingColumns.some((item) => item?.name === column);

  for (const column of columns) {
    if (!hasColumn(column.name)) {
      db.exec(`ALTER TABLE project_checklist_items ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
};
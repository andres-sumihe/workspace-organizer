import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import type { ChecklistItemDraft, ChecklistSectionDraft } from '../repositories/project-checklists.repository.js';
import type { ProjectChecklistDetail, ProjectChecklistItem, ProjectChecklistSection } from '@workspace/shared';

interface ChecklistColumns {
  no: number;
  activity: number;
  date: number;
  time: number;
  location: number;
  pic: number;
}

interface ChecklistLayout {
  worksheet: ExcelJS.Worksheet;
  columns: ChecklistColumns;
  bodyStartRowNumber: number;
  bodyEndRowNumber: number;
  sectionStyleRowNumber: number;
  groupStyleRowNumber?: number;
  itemStyleRowNumber: number;
}

interface BodyRow {
  kind: 'section' | 'group' | 'item';
  section?: ProjectChecklistSection;
  groupTitle?: string;
  item?: ProjectChecklistItem;
  sequence?: number;
}

interface CellRange {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const maxItems = 1000;
const maxTextLength = 500;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const normalizeHeader = (value: string): string => normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const limitText = (value: string): string => {
  return value.length <= maxTextLength ? value : `${value.slice(0, maxTextLength - 3)}...`;
};

const textOf = (cell: ExcelJS.Cell): string => limitText(normalizeText(cell.text));

const cellValueText = (cell: ExcelJS.Cell): string | undefined => {
  const text = textOf(cell);
  return text.length > 0 ? text : undefined;
};

const columnNameToNumber = (name: string): number => {
  return name.toUpperCase().split('').reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
};

const parseCell = (address: string): { row: number; column: number } => {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(address);
  if (!match) return { row: 0, column: 0 };
  return { column: columnNameToNumber(match[1]), row: Number.parseInt(match[2], 10) };
};

const parseRange = (range: string): CellRange => {
  const [start, end = start] = range.split(':');
  const first = parseCell(start);
  const last = parseCell(end);
  return {
    top: Math.min(first.row, last.row),
    bottom: Math.max(first.row, last.row),
    left: Math.min(first.column, last.column),
    right: Math.max(first.column, last.column),
  };
};

const mergeRanges = (worksheet: ExcelJS.Worksheet): string[] => {
  const model = worksheet.model as ExcelJS.WorksheetModel & { merges?: string[] };
  return Array.isArray(model.merges) ? [...model.merges] : [];
};

const intersectsRows = (range: CellRange, startRow: number, endRow: number): boolean => {
  return range.bottom >= startRow && range.top <= endRow;
};

const hasBorder = (cell: ExcelJS.Cell): boolean => {
  const border = cell.border;
  return Boolean(border?.top?.style || border?.right?.style || border?.bottom?.style || border?.left?.style);
};

const fillColor = (cell: ExcelJS.Cell): string | undefined => {
  const color = cell.fill?.type === 'pattern' ? cell.fill.fgColor?.argb : undefined;
  return color?.toUpperCase();
};

const rowTextInRange = (row: ExcelJS.Row, startColumn: number, endColumn: number): string | undefined => {
  for (let column = startColumn; column <= endColumn; column += 1) {
    const text = cellValueText(row.getCell(column));
    if (text) return text;
  }
  return undefined;
};

const rowHasTableShape = (row: ExcelJS.Row, columns: ChecklistColumns): boolean => {
  for (let column = columns.no; column <= columns.pic; column += 1) {
    if (hasBorder(row.getCell(column)) || cellValueText(row.getCell(column))) return true;
  }
  return false;
};

const isSectionRow = (worksheet: ExcelJS.Worksheet, row: ExcelJS.Row, columns: ChecklistColumns): boolean => {
  const sectionText = rowTextInRange(row, columns.no, columns.pic);
  if (!sectionText) return false;
  const noCell = row.getCell(columns.no);
  if (!noCell.font?.bold) return false;

  const color = fillColor(noCell);
  if (color && color !== '00000000' && color !== 'FFFFFFFF' && color !== 'FFFFFF00') return true;

  return mergeRanges(worksheet).some((rangeText) => {
    const range = parseRange(rangeText);
    return range.top === row.number && range.bottom === row.number && range.left <= columns.no && range.right >= columns.pic;
  });
};

const isGroupRow = (row: ExcelJS.Row, columns: ChecklistColumns): boolean => {
  const groupText = rowTextInRange(row, columns.no, columns.pic);
  if (!groupText) return false;
  let yellowCells = 0;
  for (let column = columns.no; column <= columns.pic; column += 1) {
    if (fillColor(row.getCell(column)) === 'FFFFFF00') yellowCells += 1;
  }
  return yellowCells >= 2;
};

const detectColumns = (row: ExcelJS.Row): ChecklistColumns | null => {
  const columns: Partial<ChecklistColumns> = {};
  row.eachCell({ includeEmpty: false }, (cell, column) => {
    const header = normalizeHeader(cell.text);
    if (header === 'no' || header === 'number') columns.no = column;
    if (header === 'aktivitas' || header === 'activity' || header === 'activities') columns.activity = column;
    if (header === 'tanggal' || header === 'date') columns.date = column;
    if (header === 'jam' || header === 'time') columns.time = column;
    if (header === 'lokasi' || header === 'location') columns.location = column;
    if (header === 'pic') columns.pic = column;
  });

  if (columns.no && columns.activity && columns.date && columns.time && columns.location && columns.pic) {
    return columns as ChecklistColumns;
  }
  return null;
};

const headerBottomRow = (worksheet: ExcelJS.Worksheet, headerRowNumber: number, columns: ChecklistColumns): number => {
  let bottom = headerRowNumber;
  for (const rangeText of mergeRanges(worksheet)) {
    const range = parseRange(rangeText);
    const touchesHeader = range.top <= headerRowNumber && range.bottom >= headerRowNumber;
    const touchesTable = range.right >= columns.no && range.left <= columns.pic;
    if (touchesHeader && touchesTable) bottom = Math.max(bottom, range.bottom);
  }
  return bottom;
};

const findLayout = (workbook: ExcelJS.Workbook): ChecklistLayout => {
  for (const worksheet of workbook.worksheets) {
    for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 80); rowNumber += 1) {
      const columns = detectColumns(worksheet.getRow(rowNumber));
      if (!columns) continue;

      const bodyStartRowNumber = headerBottomRow(worksheet, rowNumber, columns) + 1;
      let bodyEndRowNumber = bodyStartRowNumber;
      let sectionStyleRowNumber: number | undefined;
      let groupStyleRowNumber: number | undefined;
      let itemStyleRowNumber: number | undefined;

      for (let bodyRowNumber = bodyStartRowNumber; bodyRowNumber <= worksheet.rowCount; bodyRowNumber += 1) {
        const bodyRow = worksheet.getRow(bodyRowNumber);
        if (isSectionRow(worksheet, bodyRow, columns)) {
          sectionStyleRowNumber ??= bodyRowNumber;
          bodyEndRowNumber = bodyRowNumber;
          continue;
        }
        if (isGroupRow(bodyRow, columns)) {
          groupStyleRowNumber ??= bodyRowNumber;
          bodyEndRowNumber = bodyRowNumber;
          continue;
        }
        if (rowHasTableShape(bodyRow, columns)) {
          if (rowTextInRange(bodyRow, columns.no, columns.pic)) {
            itemStyleRowNumber ??= bodyRowNumber;
            bodyEndRowNumber = bodyRowNumber;
          }
        }
      }

      return {
        worksheet,
        columns,
        bodyStartRowNumber,
        bodyEndRowNumber,
        sectionStyleRowNumber: sectionStyleRowNumber ?? bodyStartRowNumber,
        groupStyleRowNumber,
        itemStyleRowNumber: itemStyleRowNumber ?? bodyStartRowNumber,
      };
    }
  }

  throw new Error('Checklist worksheet table was not found');
};

const parseItem = (row: ExcelJS.Row, columns: ChecklistColumns, groupTitle?: string): ChecklistItemDraft => ({
  groupTitle,
  title: cellValueText(row.getCell(columns.activity)) ?? '',
  plannedDate: cellValueText(row.getCell(columns.date)),
  plannedTime: cellValueText(row.getCell(columns.time)),
  location: cellValueText(row.getCell(columns.location)),
  pic: cellValueText(row.getCell(columns.pic)),
});

const compareItems = (left: ProjectChecklistItem, right: ProjectChecklistItem): number => left.sortOrder - right.sortOrder;

const buildBodyRows = (checklist: ProjectChecklistDetail): BodyRow[] => {
  const sections = [...checklist.sections].sort((left, right) => left.sortOrder - right.sortOrder);
  const rows: BodyRow[] = [];

  for (const section of sections) {
    rows.push({ kind: 'section', section });
    const sectionItems = checklist.items.filter((item) => item.sectionId === section.id).sort(compareItems);
    const groupSequence = new Map<string, number>();
    let lastGroupKey: string | undefined;
    let directSequence = 1;

    for (const item of sectionItems) {
      const groupTitle = item.groupTitle?.trim();
      const groupKey = groupTitle ?? '';
      if (groupTitle && groupKey !== lastGroupKey) rows.push({ kind: 'group', groupTitle });

      const sequence = groupTitle ? (groupSequence.get(groupKey) ?? 0) + 1 : directSequence;
      if (groupTitle) groupSequence.set(groupKey, sequence);
      else directSequence += 1;

      rows.push({ kind: 'item', item, sequence });
      lastGroupKey = groupKey;
    }
  }

  return rows;
};

const columnNumberToName = (column: number): string => {
  let value = column;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

const escapeXmlText = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const escapeXmlAttribute = (value: string): string => {
  return escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};

const unescapeXmlAttribute = (value: string): string => {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

const xmlAttribute = (xml: string, name: string): string | undefined => {
  const match = [...xml.matchAll(/\s([A-Za-z_:][\w:.-]*)="([^"]*)"/g)].find((attribute) => attribute[1] === name);
  return match ? unescapeXmlAttribute(match[2]) : undefined;
};

const removeXmlAttribute = (attributes: string, name: string): string => {
  return attributes.replace(/\s([A-Za-z_:][\w:.-]*)="[^"]*"/g, (attribute, attributeName: string) => {
    return attributeName === name ? '' : attribute;
  });
};

const setXmlAttribute = (attributes: string, name: string, value: string): string => {
  return `${removeXmlAttribute(attributes, name)} ${name}="${escapeXmlAttribute(value)}"`;
};

const formulaTextPrefixPattern = /^\s*[=+\-@]/;
const activityCharactersPerLine = 56;
const maxActivityRowHeight = 240;

const activityCellText = (value: string): string => {
  if (!formulaTextPrefixPattern.test(value) || value.startsWith("'")) return value;
  return `'${value}`;
};

const rowStartTag = (rowXml: string): string => /^<row\b[^>]*(?:\/>|>)/.exec(rowXml)?.[0] ?? '<row/>';

const templateRowHeight = (rowXml: string): number => {
  const parsed = Number.parseFloat(xmlAttribute(rowStartTag(rowXml), 'ht') ?? '15');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
};

const estimateActivityLineCount = (value: string): number => {
  return value.split(/\r\n|\n|\r/).reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / activityCharactersPerLine));
  }, 0);
};

const setRowHeight = (rowXml: string, height: number): string => {
  return rowXml.replace(/^<row\b([^>]*?)(\/>|>)/, (_match, attributes: string, close: string) => {
    const nextAttributes = setXmlAttribute(setXmlAttribute(attributes, 'ht', String(height)), 'customHeight', '1');
    return `<row${nextAttributes}${close}`;
  });
};

const applyActivityRowHeight = (rowXml: string, activity: string): string => {
  const baseHeight = templateRowHeight(rowXml);
  const lineCount = estimateActivityLineCount(activity);
  const height = Math.min(maxActivityRowHeight, Math.max(baseHeight, Math.ceil(baseHeight * lineCount)));
  return setRowHeight(rowXml, height);
};

const normalizeZipPath = (path: string): string => {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments.join('/');
};

const readZipText = async (zip: JSZip, path: string): Promise<string> => {
  const file = zip.file(path);
  if (!file) throw new Error(`Workbook part is missing: ${path}`);
  return file.async('string');
};

const worksheetPathForName = async (zip: JSZip, worksheetName: string): Promise<string> => {
  const workbookXml = await readZipText(zip, 'xl/workbook.xml');
  const workbookRelsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');
  const sheetTags = workbookXml.match(/<sheet\b[^>]*\/>/g) ?? [];
  const sheetTag = sheetTags.find((tag) => xmlAttribute(tag, 'name') === worksheetName);
  const relationshipId = sheetTag ? xmlAttribute(sheetTag, 'r:id') : undefined;
  if (!relationshipId) throw new Error(`Worksheet relationship was not found for ${worksheetName}`);

  const relationshipTags = workbookRelsXml.match(/<Relationship\b[^>]*\/>/g) ?? [];
  const relationshipTag = relationshipTags.find((tag) => xmlAttribute(tag, 'Id') === relationshipId);
  const target = relationshipTag ? xmlAttribute(relationshipTag, 'Target') : undefined;
  if (!target) throw new Error(`Worksheet target was not found for ${worksheetName}`);

  return normalizeZipPath(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
};

const updateRowNumber = (rowXml: string, rowNumber: number): string => {
  const withRowNumber = rowXml.replace(/(<row\b[^>]*\br=")\d+("[^>]*>)/, `$1${rowNumber}$2`);
  return withRowNumber.replace(/(\br=")([A-Z]+)\d+("?)/g, `$1$2${rowNumber}$3`);
};

const cellAddress = (column: number, rowNumber: number): string => `${columnNumberToName(column)}${rowNumber}`;

const buildTextNode = (value: string): string => {
  const preserveSpace = value.trim() !== value;
  const spaceAttribute = preserveSpace ? ' xml:space="preserve"' : '';
  return `<is><t${spaceAttribute}>${escapeXmlText(value)}</t></is>`;
};

const buildCellXml = (cellXml: string, address: string, value: string | number | undefined): string => {
  const startTagMatch = /^<c\b([^>]*?)(?:\/>|>)/.exec(cellXml);
  const baseAttributes = startTagMatch?.[1] ?? ` r="${address}"`;
  let attributes = setXmlAttribute(removeXmlAttribute(baseAttributes, 't'), 'r', address);

  if (value === undefined || value === '') {
    return `<c${attributes}/>`;
  }

  if (typeof value === 'number') {
    return `<c${attributes}><v>${value}</v></c>`;
  }

  attributes = setXmlAttribute(attributes, 't', 'inlineStr');
  return `<c${attributes}>${buildTextNode(value)}</c>`;
};

const cellXmlPattern = /<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g;

const replaceCell = (rowXml: string, column: number, rowNumber: number, value: string | number | undefined): string => {
  const address = cellAddress(column, rowNumber);
  const cellMatches = [...rowXml.matchAll(cellXmlPattern)];
  const existingMatch = cellMatches.find((match) => xmlAttribute(match[0], 'r') === address);
  if (existingMatch?.index !== undefined) {
    const existing = existingMatch[0];
    return `${rowXml.slice(0, existingMatch.index)}${buildCellXml(existing, address, value)}${rowXml.slice(existingMatch.index + existing.length)}`;
  }

  const insertedCell = buildCellXml(`<c r="${address}"/>`, address, value);
  const nextCell = cellMatches.find((cellMatch) => {
    const cellReference = xmlAttribute(cellMatch[0], 'r');
    const parsedCell = cellReference ? parseCell(cellReference) : null;
    return parsedCell !== null && parsedCell.column > column;
  });
  if (nextCell?.index !== undefined) {
    return `${rowXml.slice(0, nextCell.index)}${insertedCell}${rowXml.slice(nextCell.index)}`;
  }
  return rowXml.replace('</row>', `${insertedCell}</row>`);
};

const clearChecklistCells = (rowXml: string, columns: ChecklistColumns, rowNumber: number): string => {
  let nextRowXml = rowXml;
  for (let column = columns.no; column <= columns.pic; column += 1) {
    nextRowXml = replaceCell(nextRowXml, column, rowNumber, undefined);
  }
  return nextRowXml;
};

const patchBodyRowXml = (rowXml: string, rowNumber: number, columns: ChecklistColumns, bodyRow: BodyRow): string => {
  let nextRowXml = clearChecklistCells(updateRowNumber(rowXml, rowNumber), columns, rowNumber);

  if (bodyRow.kind === 'section') {
    return replaceCell(nextRowXml, columns.no, rowNumber, bodyRow.section?.title ?? '');
  }

  if (bodyRow.kind === 'group') {
    return replaceCell(nextRowXml, columns.activity, rowNumber, bodyRow.groupTitle ?? '');
  }

  const item = bodyRow.item;
  const activity = activityCellText(item?.title ?? '');
  nextRowXml = replaceCell(nextRowXml, columns.no, rowNumber, bodyRow.sequence ?? undefined);
  nextRowXml = replaceCell(nextRowXml, columns.activity, rowNumber, activity);
  nextRowXml = replaceCell(nextRowXml, columns.date, rowNumber, item?.plannedDate ?? '');
  nextRowXml = replaceCell(nextRowXml, columns.time, rowNumber, item?.plannedTime ?? '');
  nextRowXml = replaceCell(nextRowXml, columns.location, rowNumber, item?.location ?? '');
  nextRowXml = replaceCell(nextRowXml, columns.pic, rowNumber, item?.pic ?? '');
  return applyActivityRowHeight(nextRowXml, activity);
};

interface RowXmlMatch {
  rowNumber: number;
  xml: string;
  index: number;
}

const getRowXmlMatches = (sheetXml: string): RowXmlMatch[] => {
  const matches = [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)];
  return matches.map((match) => ({
    rowNumber: Number.parseInt(match[1], 10),
    xml: match[0],
    index: match.index ?? 0,
  }));
};

const assertNoDuplicateCellRefs = (sheetXml: string) => {
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)) {
    const refs = new Set<string>();
    for (const cellMatch of rowMatch[0].matchAll(cellXmlPattern)) {
      const ref = xmlAttribute(cellMatch[0], 'r');
      if (!ref) continue;
      if (refs.has(ref)) throw new Error(`Duplicate cell reference ${ref} in checklist export`);
      refs.add(ref);
    }
  }
};

const shiftRowElements = (xml: string, afterRowNumber: number, delta: number): string => {
  if (delta === 0) return xml;
  return xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g, (rowXml, rowNumberText: string) => {
    const rowNumber = Number.parseInt(rowNumberText, 10);
    return rowNumber > afterRowNumber ? updateRowNumber(rowXml, rowNumber + delta) : rowXml;
  });
};

const shiftRangeRows = (rangeText: string, afterRowNumber: number, delta: number): string => {
  if (delta === 0) return rangeText;
  return rangeText.replace(/([A-Z]+)(\d+)/g, (cellRef, columnName: string, rowNumberText: string) => {
    const rowNumber = Number.parseInt(rowNumberText, 10);
    return rowNumber > afterRowNumber ? `${columnName}${rowNumber + delta}` : cellRef;
  });
};

const updateDimension = (sheetXml: string, bodyEndRowNumber: number, delta: number): string => {
  return sheetXml.replace(/(<dimension\b[^>]*\bref=")([^"]+)("[^>]*\/?>)/, (match, prefix: string, ref: string, suffix: string) => {
    const rangeParts = ref.split(':');
    const endCell = parseCell(rangeParts[1] ?? rangeParts[0]);
    if (endCell.row <= bodyEndRowNumber || delta === 0) return match;
    return `${prefix}${rangeParts[0]}:${columnNumberToName(endCell.column)}${endCell.row + delta}${suffix}`;
  });
};

const updateMergeCells = (
  sheetXml: string,
  bodyRows: BodyRow[],
  columns: ChecklistColumns,
  bodyStartRowNumber: number,
  bodyEndRowNumber: number,
  delta: number,
): string => {
  const sectionMergeRefs = bodyRows.flatMap((bodyRow, index) => {
    if (bodyRow.kind !== 'section') return [];
    const rowNumber = bodyStartRowNumber + index;
    return [`${cellAddress(columns.no, rowNumber)}:${cellAddress(columns.pic, rowNumber)}`];
  });
  const mergeBlockPattern = /<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/;
  const mergeBlock = mergeBlockPattern.exec(sheetXml)?.[0];
  const existingRefs = mergeBlock
    ? [...mergeBlock.matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"[^>]*\/>/g)].map((match) => match[1])
    : [];
  const preservedRefs = existingRefs.flatMap((ref) => {
    const range = parseRange(ref);
    if (intersectsRows(range, bodyStartRowNumber, bodyEndRowNumber)) return [];
    return [shiftRangeRows(ref, bodyEndRowNumber, delta)];
  });
  const refs = [...preservedRefs, ...sectionMergeRefs];
  const nextBlock = refs.length > 0
    ? `<mergeCells count="${refs.length}">${refs.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';

  if (mergeBlock) return sheetXml.replace(mergeBlockPattern, nextBlock);
  if (!nextBlock) return sheetXml;
  return sheetXml.replace('</sheetData>', `</sheetData>${nextBlock}`);
};

const patchWorksheetXml = (sheetXml: string, layout: ChecklistLayout, checklist: ProjectChecklistDetail): string => {
  const bodyStartRowNumber = layout.sectionStyleRowNumber;
  const bodyEndRowNumber = layout.bodyEndRowNumber;
  const bodyRows = buildBodyRows(checklist);
  const rowMatches = getRowXmlMatches(sheetXml);
  const firstBodyRow = rowMatches.find((row) => row.rowNumber === bodyStartRowNumber);
  const lastBodyRow = rowMatches.find((row) => row.rowNumber === bodyEndRowNumber);
  if (!firstBodyRow || !lastBodyRow) throw new Error('Checklist worksheet body rows were not found');

  const rowXmlByNumber = new Map(rowMatches.map((row) => [row.rowNumber, row.xml]));
  const originalBodyRowCount = bodyEndRowNumber - bodyStartRowNumber + 1;
  const sectionTemplate = rowXmlByNumber.get(layout.sectionStyleRowNumber) ?? firstBodyRow.xml;
  const groupTemplate = rowXmlByNumber.get(layout.groupStyleRowNumber ?? layout.itemStyleRowNumber) ?? sectionTemplate;
  const itemTemplate = rowXmlByNumber.get(layout.itemStyleRowNumber) ?? groupTemplate;
  const newRowsXml = bodyRows.map((bodyRow, index) => {
    const rowNumber = bodyStartRowNumber + index;
    const originalRowXml = rowXmlByNumber.get(bodyStartRowNumber + index);
    const template = originalRowXml ?? (bodyRow.kind === 'section' ? sectionTemplate : bodyRow.kind === 'group' ? groupTemplate : itemTemplate);
    return patchBodyRowXml(template, rowNumber, layout.columns, bodyRow);
  }).join('');
  const delta = bodyRows.length - originalBodyRowCount;
  const replaceEndIndex = lastBodyRow.index + lastBodyRow.xml.length;
  const prefix = sheetXml.slice(0, firstBodyRow.index);
  const suffix = shiftRowElements(sheetXml.slice(replaceEndIndex), bodyEndRowNumber, delta);
  const patchedRowsXml = `${prefix}${newRowsXml}${suffix}`;
  const patchedDimensionXml = updateDimension(patchedRowsXml, bodyEndRowNumber, delta);
  const patchedWorksheetXml = updateMergeCells(patchedDimensionXml, bodyRows, layout.columns, bodyStartRowNumber, bodyEndRowNumber, delta);
  assertNoDuplicateCellRefs(patchedWorksheetXml);
  return patchedWorksheetXml;
};

export const projectChecklistParserService = {
  async parseWorkbook(buffer: Buffer): Promise<ChecklistSectionDraft[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const layout = findLayout(workbook);
    const sections: ChecklistSectionDraft[] = [];
    let currentSection: ChecklistSectionDraft | null = null;
    let currentGroupTitle: string | undefined;
    let itemCount = 0;

    for (let rowNumber = layout.bodyStartRowNumber; rowNumber <= layout.bodyEndRowNumber; rowNumber += 1) {
      if (itemCount >= maxItems) break;
      const row = layout.worksheet.getRow(rowNumber);

      if (isSectionRow(layout.worksheet, row, layout.columns)) {
        const title = rowTextInRange(row, layout.columns.no, layout.columns.pic);
        if (!title) continue;
        currentSection = { title, items: [] };
        sections.push(currentSection);
        currentGroupTitle = undefined;
        continue;
      }

      if (!currentSection) continue;

      if (isGroupRow(row, layout.columns)) {
        currentGroupTitle = rowTextInRange(row, layout.columns.no, layout.columns.pic);
        continue;
      }

      if (!rowHasTableShape(row, layout.columns)) continue;

      currentSection.items.push(parseItem(row, layout.columns, currentGroupTitle));
      itemCount += 1;
    }

    return sections;
  },

  async writeChecklistWorkbook(buffer: Buffer, checklist: ProjectChecklistDetail): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const layout = findLayout(workbook);
    const zip = await JSZip.loadAsync(buffer);
    const worksheetPath = await worksheetPathForName(zip, layout.worksheet.name);
    const worksheetXml = await readZipText(zip, worksheetPath);
    zip.file(worksheetPath, patchWorksheetXml(worksheetXml, layout, checklist), { createFolders: false });
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  },
};
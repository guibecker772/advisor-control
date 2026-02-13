import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedCellValue, ParsedImportFile, ParsedImportSheet, RawImportRow } from '../types';

function buildHeaders(rawHeaders: ParsedCellValue[]): string[] {
  const seen = new Map<string, number>();

  return rawHeaders.map((value, index) => {
    const base = String(value ?? '').trim() || `Coluna ${index + 1}`;
    const counter = seen.get(base) ?? 0;
    seen.set(base, counter + 1);

    if (counter === 0) return base;
    return `${base} (${counter + 1})`;
  });
}

function matrixToSheet(name: string, matrix: ParsedCellValue[][]): ParsedImportSheet {
  if (!matrix.length) {
    return { name, headers: [], rows: [] };
  }

  const [headerRow, ...bodyRows] = matrix;
  const headers = buildHeaders(headerRow);

  const rows: RawImportRow[] = bodyRows
    .map((row) => {
      const rowObject: RawImportRow = {};
      for (let index = 0; index < headers.length; index += 1) {
        rowObject[headers[index]] = row[index];
      }
      return rowObject;
    })
    .filter((row) =>
      Object.values(row).some((value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        return true;
      }),
    );

  return {
    name,
    headers,
    rows,
  };
}

function parseCsvContent(content: string): ParsedImportSheet {
  const parsed = Papa.parse<ParsedCellValue[]>(content, {
    delimiter: '',
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message || 'Falha ao ler CSV.');
  }

  const matrix = parsed.data as ParsedCellValue[][];
  return matrixToSheet('CSV', matrix);
}

function parseXlsxContent(buffer: ArrayBuffer): ParsedImportSheet[] {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    dense: true,
  });

  return workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<ParsedCellValue[]>(worksheet, {
      header: 1,
      raw: true,
      defval: '',
    });
    return matrixToSheet(sheetName, matrix);
  });
}

function detectFileType(fileName: string): ParsedImportFile['fileType'] {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.xlsx')) return 'xlsx';
  if (normalized.endsWith('.csv')) return 'csv';
  throw new Error('Formato invalido. Use .xlsx ou .csv.');
}

export async function parseClientImportFile(file: File): Promise<ParsedImportFile> {
  const fileType = detectFileType(file.name);

  if (fileType === 'csv') {
    const text = await file.text();
    const sheet = parseCsvContent(text);
    return {
      fileName: file.name,
      fileSize: file.size,
      fileType,
      sheets: [sheet],
    };
  }

  const buffer = await file.arrayBuffer();
  const sheets = parseXlsxContent(buffer);
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType,
    sheets,
  };
}

export function getDefaultSheetName(parsedFile: ParsedImportFile): string {
  const preferred = parsedFile.sheets.find((sheet) => sheet.name.toLowerCase() === 'clientes');
  if (preferred) return preferred.name;
  return parsedFile.sheets[0]?.name ?? '';
}

import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AIService, UsageRecord } from '../../src/types/index.js';
import { teamMembers } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const UPLOAD_FILE = path.join(DATA_DIR, 'csv-uploads.json');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// --- CSV parsing ---

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV split (doesn't handle quoted commas, but covers most exports)
    const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Match a name from CSV to a team member.
 * Tries exact match, then case-insensitive, then partial.
 */
function matchName(csvName: string): string | undefined {
  const normalized = csvName.toLowerCase().trim();
  if (!normalized) return undefined;

  // Exact match
  const exact = teamMembers.find((m) => m.name.toLowerCase() === normalized);
  if (exact) return exact.id;

  // Partial match (CSV might have "Sarah Q" for "Sarah Quarrie")
  const partial = teamMembers.find((m) => {
    const memberName = m.name.toLowerCase();
    return memberName.includes(normalized) || normalized.includes(memberName);
  });
  if (partial) return partial.id;

  // Match by first name + last initial
  const parts = normalized.split(/\s+/);
  if (parts.length >= 1) {
    const firstName = parts[0];
    const match = teamMembers.find((m) => m.name.toLowerCase().startsWith(firstName));
    if (match) return match.id;
  }

  return undefined;
}

/**
 * Try to extract records from CSV rows.
 * Supports various column naming conventions.
 */
function csvToRecords(
  rows: Record<string, string>[],
  service: AIService
): { records: UsageRecord[]; unmatchedNames: string[] } {
  const records: UsageRecord[] = [];
  const unmatchedNames = new Set<string>();

  // Detect column mappings (flexible naming)
  const nameCol = findColumn(rows[0], ['name', 'user', 'employee', 'member', 'person', 'full_name', 'username']);
  const emailCol = findColumn(rows[0], ['email', 'email_address', 'user_email']);
  const dateCol = findColumn(rows[0], ['date', 'day', 'period', 'timestamp', 'usage_date']);
  const creditsCol = findColumn(rows[0], ['credits', 'credit', 'credits_used', 'usage', 'amount', 'quantity', 'units']);
  const costCol = findColumn(rows[0], ['cost', 'price', 'charge', 'total', 'spend', 'amount_usd', 'cost_usd']);

  if (!nameCol && !emailCol) {
    throw new Error('CSV must have a name or email column (e.g., "name", "user", "employee", "email")');
  }
  if (!creditsCol && !costCol) {
    throw new Error('CSV must have a credits or cost column (e.g., "credits", "usage", "cost", "amount")');
  }

  for (const row of rows) {
    const rawName = (nameCol ? row[nameCol] : '') || '';
    const rawEmail = (emailCol ? row[emailCol] : '') || '';
    const rawDate = (dateCol ? row[dateCol] : '') || new Date().toISOString().split('T')[0];
    const credits = parseFloat(creditsCol ? row[creditsCol] : '0') || 0;
    const cost = parseFloat(costCol ? row[costCol] : '0') || 0;

    // Match to team member
    let memberId: string | undefined;
    if (rawEmail) {
      const byEmail = teamMembers.find(
        (m) => m.email && m.email.toLowerCase() === rawEmail.toLowerCase()
      );
      if (byEmail) memberId = byEmail.id;
    }
    if (!memberId && rawName) {
      memberId = matchName(rawName);
    }

    if (!memberId) {
      unmatchedNames.add(rawName || rawEmail);
      continue;
    }

    // Normalize date format
    const date = normalizeDate(rawDate);
    if (!date) continue;

    records.push({
      service,
      memberId,
      date,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: cost || credits * 0.05, // rough estimate if no cost column
      requestCount: 0,
      credits,
    });
  }

  return { records, unmatchedNames: Array.from(unmatchedNames) };
}

function findColumn(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const match = keys.find((k) => k === candidate);
    if (match) return match;
  }
  return undefined;
}

function normalizeDate(raw: string): string | null {
  // Try ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.split('T')[0];
  }
  // Try M/D/YYYY or MM/DD/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try parsing with Date
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

// --- Storage ---

interface StoredUpload {
  service: AIService;
  filename: string;
  uploadedAt: string;
  records: UsageRecord[];
}

function readStorage(): StoredUpload[] {
  try {
    if (fs.existsSync(UPLOAD_FILE)) {
      const raw = fs.readFileSync(UPLOAD_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading upload storage:', err);
  }
  return [];
}

function writeStorage(uploads: StoredUpload[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(UPLOAD_FILE, JSON.stringify(uploads, null, 2));
}

/**
 * Get all stored CSV records for a given service and date range.
 */
export function getUploadedRecords(
  service: AIService,
  startDate: string,
  endDate: string
): UsageRecord[] {
  const uploads = readStorage();
  return uploads
    .filter((u) => u.service === service)
    .flatMap((u) => u.records)
    .filter((r) => r.date >= startDate && r.date <= endDate);
}

// --- Routes ---

// POST /api/upload/:service — upload a CSV for a service
router.post('/:service', upload.single('file'), (req: Request, res: Response) => {
  const service = req.params.service as AIService;
  if (!['higgsfield', 'weavy'].includes(service)) {
    res.status(400).json({
      success: false,
      error: 'CSV upload is only supported for Higgsfield and Weavy',
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  try {
    const csvText = req.file.buffer.toString('utf-8');
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      res.status(400).json({ success: false, error: 'CSV file is empty or has no data rows' });
      return;
    }

    const { records, unmatchedNames } = csvToRecords(rows, service);

    // Store the records
    const uploads = readStorage();
    // Remove previous uploads for the same service
    const filtered = uploads.filter((u) => u.service !== service);
    filtered.push({
      service,
      filename: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      records,
    });
    writeStorage(filtered);

    res.json({
      success: true,
      data: {
        recordsImported: records.length,
        totalRows: rows.length,
        unmatchedNames: unmatchedNames.length > 0 ? unmatchedNames : undefined,
        filename: req.file.originalname,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse CSV',
    });
  }
});

// GET /api/upload/:service — get info about uploaded data for a service
router.get('/:service', (req: Request, res: Response) => {
  const service = req.params.service as AIService;
  const uploads = readStorage();
  const serviceUpload = uploads.find((u) => u.service === service);

  if (!serviceUpload) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({
    success: true,
    data: {
      filename: serviceUpload.filename,
      uploadedAt: serviceUpload.uploadedAt,
      recordCount: serviceUpload.records.length,
    },
  });
});

// DELETE /api/upload/:service — remove uploaded data for a service
router.delete('/:service', (req: Request, res: Response) => {
  const service = req.params.service as AIService;
  const uploads = readStorage();
  const filtered = uploads.filter((u) => u.service !== service);
  writeStorage(filtered);
  res.json({ success: true });
});

export default router;

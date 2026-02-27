import type { UsageRecord, TeamMember } from '../../src/types/index.js';
import { getUploadedRecords } from '../routes/upload.js';

// Higgsfield does NOT have a usage API.
// Usage data comes from CSV uploads (exported from their dashboard).

export async function fetchHiggsFieldUsage(
  startDate: string,
  endDate: string,
  _members: TeamMember[]
): Promise<UsageRecord[]> {
  const records = getUploadedRecords('higgsfield', startDate, endDate);

  if (records.length === 0) {
    console.log('Higgsfield: no uploaded CSV data for this date range');
  } else {
    console.log(`Higgsfield: ${records.length} records from CSV upload`);
  }

  return records;
}

import type { UsageRecord, TeamMember } from '../../src/types/index.js';
import { getUploadedRecords } from '../routes/upload.js';

// Weavy.ai does NOT have a public usage API.
// Usage data comes from CSV uploads (exported from their dashboard).

export async function fetchWeavyUsage(
  startDate: string,
  endDate: string,
  _members: TeamMember[]
): Promise<UsageRecord[]> {
  const records = getUploadedRecords('weavy', startDate, endDate);

  if (records.length === 0) {
    console.log('Weavy: no uploaded CSV data for this date range');
  } else {
    console.log(`Weavy: ${records.length} records from CSV upload`);
  }

  return records;
}

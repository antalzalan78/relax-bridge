import { Temporal } from '@js-temporal/polyfill';
import type { BookingCategory, InstantWindow } from './types';

/** Travel gap after a Home Service before a buffered manual Studio Visit. */
export const homeToManualStudioBufferMinutes = 60;

export interface ManualBlockRow {
  starts_at: Date | string;
  ends_at: Date | string;
  service_category: BookingCategory;
  buffer_minutes: number;
}

export interface ManualBlockWindows {
  blocked: InstantWindow[];
  busy: InstantWindow[];
}

const instant = (value: Date | string) => Temporal.Instant.from(
  value instanceof Date ? value.toISOString() : String(value),
);

/** Manual appointments retain their normal gap, with a travel gap for an earlier Home Service. */
export function manualBlockWindows(
  rows: ManualBlockRow[],
  candidateCategory?: BookingCategory,
): ManualBlockWindows {
  const result: ManualBlockWindows = { blocked: [], busy: [] };
  for (const row of rows) {
    const start = instant(row.starts_at);
    const end = instant(row.ends_at);
    const standardBuffer = Number(row.buffer_minutes);
    const bufferMinutes = candidateCategory === 'home' && row.service_category === 'studio' && standardBuffer > 0
      ? Math.max(standardBuffer, homeToManualStudioBufferMinutes)
      : standardBuffer;
    if (bufferMinutes > 0) {
      result.busy.push({
        start: start.subtract({ minutes: bufferMinutes }).toString(),
        end: end.toString(),
      });
    } else {
      result.blocked.push({ start: start.toString(), end: end.toString() });
    }
  }
  return result;
}

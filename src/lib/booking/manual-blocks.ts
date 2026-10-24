import { Temporal } from '@js-temporal/polyfill';
import type { BookingCategory, InstantWindow } from './types';

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

/** The optional after-buffer is a hard block; the treatment is busy for category-aware gaps. */
export function manualBlockWindows(rows: ManualBlockRow[]): ManualBlockWindows {
  const result: ManualBlockWindows = { blocked: [], busy: [] };
  for (const row of rows) {
    const start = instant(row.starts_at);
    const end = instant(row.ends_at);
    const bufferMinutes = Number(row.buffer_minutes);
    if (bufferMinutes > 0) {
      result.busy.push({
        start: start.subtract({ minutes: bufferMinutes }).toString(),
        end: end.toString(),
      });
      result.blocked.push({
        start: end.toString(),
        end: end.add({ minutes: bufferMinutes }).toString(),
      });
    } else {
      result.blocked.push({ start: start.toString(), end: end.toString() });
    }
  }
  return result;
}

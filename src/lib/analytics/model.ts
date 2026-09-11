import { Temporal } from '@js-temporal/polyfill';

export type TrafficLocale = 'nl' | 'en' | 'hu';

export interface TrafficAggregateRow {
  day: string;
  source: string;
  country_code: string;
  entry_path: string;
  locale: TrafficLocale;
  visits: number | string;
}

export interface TrafficBreakdownItem {
  key: string;
  count: number;
}

export interface TrafficSummary {
  today: number;
  last7Days: number;
  last30Days: number;
  daily: Array<{ day: string; count: number }>;
  sources: TrafficBreakdownItem[];
  countries: TrafficBreakdownItem[];
  entryPaths: TrafficBreakdownItem[];
  locales: Record<TrafficLocale, number>;
}

const knownSources: Array<[RegExp, string]> = [
  [/(^|\.)google\.|^g\.page$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)yahoo\./, 'yahoo'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)facebook\.com$|^fb\.com$/, 'facebook'],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, 'whatsapp'],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, 'x'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
];

function cleanHost(value: string | undefined): string {
  if (!value) return '';
  const input = value.trim().toLowerCase();
  if (!input) return '';
  try {
    const host = input.includes('://') ? new URL(input).hostname : input.split('/')[0];
    return host.replace(/^www\./, '').replace(/:\d+$/, '').slice(0, 100);
  } catch {
    return '';
  }
}

function cleanCampaignSource(value: string | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._ -]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

export function normalizeTrafficSource(input: {
  utmSource?: string;
  referrerHost?: string;
  siteHost?: string;
}): string {
  const campaign = cleanCampaignSource(input.utmSource);
  if (campaign) return `utm:${campaign}`;

  const referrerHost = cleanHost(input.referrerHost);
  if (!referrerHost) return 'direct';

  const siteHost = cleanHost(input.siteHost);
  if (
    referrerHost === siteHost
    || referrerHost === 'relaxbridge.nl'
    || referrerHost.endsWith('.relaxbridge.nl')
  ) return 'internal';

  for (const [pattern, source] of knownSources) {
    if (pattern.test(referrerHost)) return source;
  }
  return referrerHost;
}

export function normalizeEntryPath(value: string): string {
  const path = value.trim().split(/[?#]/, 1)[0] || '/';
  if (!path.startsWith('/')) return '/';
  return path.replace(/\/{2,}/g, '/').slice(0, 180);
}

export function normalizeCountryCode(value: string | null): string {
  const code = (value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : '??';
}

function rank(rows: TrafficAggregateRow[], key: keyof TrafficAggregateRow): TrafficBreakdownItem[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = String(row[key]);
    totals.set(name, (totals.get(name) || 0) + Number(row.visits));
  }
  return [...totals.entries()]
    .map(([name, count]) => ({ key: name, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function summarizeWebsiteTraffic(
  rows: TrafficAggregateRow[],
  todayValue: string,
): TrafficSummary {
  const today = Temporal.PlainDate.from(todayValue);
  const firstDay = today.subtract({ days: 29 });
  const first7Day = today.subtract({ days: 6 });
  const eligibleRows = rows.filter((row) => {
    try {
      const day = Temporal.PlainDate.from(row.day);
      return Temporal.PlainDate.compare(day, firstDay) >= 0
        && Temporal.PlainDate.compare(day, today) <= 0;
    } catch {
      return false;
    }
  });

  const dailyTotals = new Map<string, number>();
  for (const row of eligibleRows) {
    dailyTotals.set(row.day, (dailyTotals.get(row.day) || 0) + Number(row.visits));
  }

  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = firstDay.add({ days: index }).toString();
    return { day, count: dailyTotals.get(day) || 0 };
  });
  const last7Rows = eligibleRows.filter((row) => (
    Temporal.PlainDate.compare(Temporal.PlainDate.from(row.day), first7Day) >= 0
  ));

  const total = (items: TrafficAggregateRow[]) => (
    items.reduce((sum, row) => sum + Number(row.visits), 0)
  );

  return {
    today: dailyTotals.get(today.toString()) || 0,
    last7Days: total(last7Rows),
    last30Days: total(eligibleRows),
    daily,
    sources: rank(eligibleRows, 'source'),
    countries: rank(eligibleRows, 'country_code'),
    entryPaths: rank(eligibleRows, 'entry_path'),
    locales: {
      nl: eligibleRows.filter((row) => row.locale === 'nl').reduce((sum, row) => sum + Number(row.visits), 0),
      en: eligibleRows.filter((row) => row.locale === 'en').reduce((sum, row) => sum + Number(row.visits), 0),
      hu: eligibleRows.filter((row) => row.locale === 'hu').reduce((sum, row) => sum + Number(row.visits), 0),
    },
  };
}

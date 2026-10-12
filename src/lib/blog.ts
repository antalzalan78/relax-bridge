import type { Locale } from '../data/site';

export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function blogDate(date: Date | null, locale: Locale): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale === 'hu' ? 'hu-HU' : locale === 'nl' ? 'nl-NL' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Amsterdam',
  }).format(date);
}

export type BodyBlock = { kind: 'h2' | 'h3' | 'paragraph' | 'list'; text?: string; items?: string[] };
export function parseBlogBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
    if (list.length) blocks.push({ kind: 'list', items: [...list] });
    paragraph = []; list = [];
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('### ')) { flush(); blocks.push({ kind: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## ')) { flush(); blocks.push({ kind: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('- ')) {
      if (paragraph.length) { blocks.push({ kind: 'paragraph', text: paragraph.join(' ') }); paragraph = []; }
      list.push(line.slice(2)); continue;
    }
    if (list.length) { blocks.push({ kind: 'list', items: [...list] }); list = []; }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

export function youtubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    let id = '';
    if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
      id = parsed.pathname === '/watch' ? parsed.searchParams.get('v') || '' : parsed.pathname.startsWith('/shorts/') ? parsed.pathname.split('/')[2] : '';
    } else if (parsed.hostname === 'youtu.be') id = parsed.pathname.slice(1);
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function isSafeExternalUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

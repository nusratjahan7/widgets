import { net } from 'electron';
import { PANEL_LIMITS, type KlipyResult, type KlipySearchResult } from '../../shared/clipboard-panel/types.js';

// Klipy's Tenor-compatible v2 endpoints. The key travels as `key`, matching the
// Tenor request shape so the existing panel UX carries over unchanged.
const FEATURED_URL = 'https://api.klipy.com/v2/featured';
const SEARCH_URL = 'https://api.klipy.com/v2/search';
const LIMIT = 24;
const FEATURED_TTL = 5 * 60 * 1000;
const SEARCH_TTL = 2 * 60 * 1000;

interface MediaFormat {
  url?: string;
  dims?: number[];
}

interface KlipyItem {
  id?: string;
  title?: string;
  content_description?: string;
  type?: string;
  media_formats?: Record<string, MediaFormat>;
}

interface KlipyResponse {
  results?: KlipyItem[];
  result?: boolean;
  errors?: { message?: string[] };
}

let featuredCache: { at: number; results: KlipyResult[] } | null = null;
const searchCache = new Map<string, { at: number; results: KlipyResult[] }>();

export function mapResults(data: KlipyResponse): KlipyResult[] {
  const results: KlipyResult[] = [];

  for (const [index, item] of (data.results ?? []).entries()) {
    if (item.type === 'ad') continue;

    const formats = item.media_formats ?? {};
    const previewUrl =
      formats.tinygif?.url ??
      formats.nanogif?.url ??
      formats.gifpreview?.url ??
      formats.tinygifpreview?.url ??
      formats.mediumgif?.url ??
      formats.gif?.url ??
      '';
    const url = formats.gif?.url ?? formats.mediumgif?.url ?? formats.tinygif?.url ?? previewUrl;
    if (!previewUrl || !url) continue;

    const dims = formats.gif?.dims ?? formats.mediumgif?.dims ?? formats.tinygif?.dims ?? [0, 0];
    results.push({
      id: typeof item.id === 'string' && item.id ? item.id : String(index),
      title:
        (typeof item.content_description === 'string' && item.content_description) ||
        (typeof item.title === 'string' && item.title) ||
        'GIF',
      previewUrl,
      url,
      width: typeof dims[0] === 'number' ? dims[0] : 0,
      height: typeof dims[1] === 'number' ? dims[1] : 0,
    });
  }

  return results;
}

async function request(url: string, params: URLSearchParams): Promise<KlipySearchResult> {
  try {
    const response = await net.fetch(`${url}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(`[clipboard-panel] Klipy responded ${response.status}`);
      return { ok: false, error: 'api', results: [] };
    }

    const data = (await response.json()) as KlipyResponse;
    if (data.result === false) {
      console.warn(`[clipboard-panel] Klipy: ${data.errors?.message?.join(' ') ?? 'request failed'}`);
      return { ok: false, error: 'api', results: [] };
    }

    return { ok: true, results: mapResults(data) };
  } catch {
    return { ok: false, error: 'network', results: [] };
  }
}

function params(key: string): URLSearchParams {
  return new URLSearchParams({
    key,
    limit: String(LIMIT),
    media_filter: 'gif,tinygif',
    contentfilter: 'high',
  });
}

/** Trending when `query` is blank, search otherwise. Requires a user API key. */
export async function searchKlipy(query: string, key: string): Promise<KlipySearchResult> {
  const trimmed = query.trim().slice(0, PANEL_LIMITS.klipyQuery);
  if (!key) return { ok: false, error: 'no-key', results: [] };

  if (!trimmed) {
    if (featuredCache && Date.now() - featuredCache.at < FEATURED_TTL) {
      return { ok: true, results: featuredCache.results };
    }
    const result = await request(FEATURED_URL, params(key));
    if (result.ok) featuredCache = { at: Date.now(), results: result.results };
    return result;
  }

  const cached = searchCache.get(trimmed);
  if (cached && Date.now() - cached.at < SEARCH_TTL) {
    return { ok: true, results: cached.results };
  }

  const requestParams = params(key);
  requestParams.set('q', trimmed);
  const result = await request(SEARCH_URL, requestParams);
  if (result.ok) {
    searchCache.set(trimmed, { at: Date.now(), results: result.results });
    if (searchCache.size > 20) {
      const oldest = searchCache.keys().next().value;
      if (oldest) searchCache.delete(oldest);
    }
  }
  return result;
}

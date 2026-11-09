import { net } from 'electron';
import { PANEL_LIMITS, type TenorResult, type TenorSearchResult } from '../../shared/clipboard-panel/types.js';

const FEATURED_URL = 'https://tenor.googleapis.com/v2/featured';
const SEARCH_URL = 'https://tenor.googleapis.com/v2/search';
const CLIENT_KEY = 'widgets-desktop';
const LIMIT = 24;
const FEATURED_TTL = 5 * 60 * 1000;
const SEARCH_TTL = 2 * 60 * 1000;

interface MediaFormat {
  url?: string;
  dims?: number[];
}

interface TenorItem {
  id?: string;
  content_description?: string;
  media_formats?: Record<string, MediaFormat>;
}

interface TenorResponse {
  results?: TenorItem[];
}

let featuredCache: { at: number; results: TenorResult[] } | null = null;
const searchCache = new Map<string, { at: number; results: TenorResult[] }>();

function mapResults(data: TenorResponse): TenorResult[] {
  const results: TenorResult[] = [];

  for (const [index, item] of (data.results ?? []).entries()) {
    const formats = item.media_formats ?? {};
    const previewUrl =
      formats.tinygif?.url ?? formats.nanogif?.url ?? formats.gif?.url ?? formats.tinywebp?.url ?? '';
    const url = formats.gif?.url ?? formats.tinygif?.url ?? previewUrl;
    if (!previewUrl || !url) continue;

    const dims = formats.tinygif?.dims ?? formats.gif?.dims ?? [0, 0];
    results.push({
      id: typeof item.id === 'string' && item.id ? item.id : String(index),
      title: typeof item.content_description === 'string' ? item.content_description : 'GIF',
      previewUrl,
      url,
      width: typeof dims[0] === 'number' ? dims[0] : 0,
      height: typeof dims[1] === 'number' ? dims[1] : 0,
    });
  }

  return results;
}

async function request(url: string, params: URLSearchParams): Promise<TenorSearchResult> {
  try {
    const response = await net.fetch(`${url}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(`[clipboard-panel] Tenor responded ${response.status}`);
      return { ok: false, error: 'api', results: [] };
    }
    const data = (await response.json()) as TenorResponse;
    return { ok: true, results: mapResults(data) };
  } catch {
    return { ok: false, error: 'network', results: [] };
  }
}

function params(key: string): URLSearchParams {
  return new URLSearchParams({
    key,
    client_key: CLIENT_KEY,
    limit: String(LIMIT),
    media_filter: 'tinygif,gif,nanogif',
    contentfilter: 'high',
  });
}

/** Trending when `query` is blank, search otherwise. Requires a user API key. */
export async function searchTenor(query: string, key: string): Promise<TenorSearchResult> {
  const trimmed = query.trim().slice(0, PANEL_LIMITS.tenorQuery);
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

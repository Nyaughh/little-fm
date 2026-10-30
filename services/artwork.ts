import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastFmApiUrl } from '../config/lastfm';
import type { CurrentTrack } from '../types/lastfm';
import { loadCoverImage } from './cover-image';

const CACHE_KEY = '@lastfm_artwork_v1';
export type Cover = { uri?: string; source?: string; expires: number };
const memory = new Map<string, Cover>();
const failures = new Map<string, { attempts: number; expires: number }>();
const pending = new Map<string, Promise<Cover>>();
let restored: Promise<void> | null = null;
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const keyFor = (track: CurrentTrack) => [track.artist, track.album || track.title].map(value => value.trim().toLowerCase()).join('|');
const failureKey = (track: CurrentTrack) => [keyFor(track), track.title, track.image, ...(track.imageCandidates || [])].join('|');

export function imageCandidates(images: any): string[] {
  if (!Array.isArray(images)) return [];
  // 174px is plenty for these covers. Larger sizes are fallbacks, not the default.
  const rank: Record<string, number> = { large: 0, medium: 1, extralarge: 2, small: 3 };
  return [...new Set<string>([...images].sort((a, b) => (rank[a?.size] ?? 4) - (rank[b?.size] ?? 4))
    .map(image => image?.['#text']).filter(isCoverUrl))];
}
export function isCoverUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\//i.test(value) && !value.includes('2a96cbd8b46e442fc41c2b86b821562f');
}
export function immediateArtwork(track: CurrentTrack | null): string | undefined {
  if (!track) return undefined;
  const cover = memory.get(keyFor(track));
  return cover?.uri && cover.expires > Date.now() ? cover.uri
    : [track.coverImage, track.image, ...(track.imageCandidates || [])].find(uri => uri?.startsWith('data:image/') || isCoverUrl(uri));
}
async function restoreCache() {
  if (!restored) restored = AsyncStorage.getItem(CACHE_KEY).then(value => {
    try { for (const [id, cover] of JSON.parse(value || '[]')) if (cover?.uri && cover.expires > Date.now()) memory.set(id, cover); } catch {}
  }).catch(() => {});
  await restored;
}
export async function getCachedArtwork(track: CurrentTrack): Promise<Cover | undefined> {
  await restoreCache();
  const cover = memory.get(keyFor(track));
  return cover && cover.expires > Date.now() ? cover : undefined;
}
function remember(key: string, cover: Cover) {
  memory.delete(key); memory.set(key, cover);
  let snapshot = JSON.stringify([...memory]);
  // Keep the single AsyncStorage row below Android's CursorWindow limit.
  while (memory.size > 60 || snapshot.length > 600000) {
    memory.delete(memory.keys().next().value!);
    snapshot = JSON.stringify([...memory]);
  }
  void AsyncStorage.setItem(CACHE_KEY, snapshot).catch(() => {});
}
export async function resolveArtwork(track: CurrentTrack, excluded: string[] = [], budgetMs = 6500): Promise<Cover> {
  const key = keyFor(track), missed = failureKey(track);
  await restoreCache();
  const cached = memory.get(key);
  if (cached?.uri && cached.expires > Date.now() && !excluded.includes(cached.uri)) return cached;
  const failure = failures.get(missed);
  if (!excluded.length && failure && failure.expires > Date.now()) return { expires: failure.expires };
  const requestKey = [missed, ...excluded].join('|');
  if (pending.has(requestKey)) return pending.get(requestKey)!;
  const request = findArtwork(track, excluded, budgetMs).then(cover => {
    if (cover.uri) { remember(key, cover); failures.delete(missed); }
    else {
      const attempts = (failure?.attempts || 0) + 1;
      cover.expires = Date.now() + [5000, 15000, 60000][Math.min(attempts - 1, 2)];
      failures.delete(missed); failures.set(missed, { attempts, expires: cover.expires });
      while (failures.size > 120) failures.delete(failures.keys().next().value!);
    }
    return cover;
  }).finally(() => pending.delete(requestKey));
  pending.set(requestKey, request);
  return request;
}

// Unrelated albums with common names (e.g. Greatest Hits) must stay out.
export function matchingAlbums(track: CurrentTrack, albums: any[]): any[] {
  const album = normalize(track.album || '');
  const artists = [track.artist, ...track.artist.split(/,|\s+feat\.?\s+|\s+with\s+/i)].map(normalize);
  const compilation = /musical|soundtrack|motion picture|broadway|original cast|cast recording/i.test(track.album || '');
  return albums.filter(match => album && normalize(match?.name || '') === album
    && (artists.includes(normalize(match?.artist || '')) || compilation))
    .sort((a, b) => Number(artists.includes(normalize(b.artist || ''))) - Number(artists.includes(normalize(a.artist || ''))));
}

async function findArtwork(track: CurrentTrack, excluded: string[], budgetMs: number): Promise<Cover> {
  const deadline = Date.now() + Math.max(250, budgetMs);
  const tried = new Set(excluded);
  const controllers = new Set<AbortController>();
  let finished = false;
  const attempt = async (urls: string[], source: string): Promise<Cover | null> => {
    for (const url of urls) {
      if (finished || tried.has(url) || !isCoverUrl(url) || Date.now() >= deadline) continue;
      tried.add(url);
      const controller = new AbortController(); controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), Math.min(1800, deadline - Date.now()));
      try {
        const uri = await loadCoverImage(url, controller.signal);
        return { uri, source, expires: Date.now() + 7 * 86400000 };
      } catch {} finally { clearTimeout(timer); controllers.delete(controller); }
    }
    return null;
  };
  const metadata = async (method: 'album.getInfo' | 'track.getInfo' | 'album.search', fields: Record<string, string>) => {
    if (finished || Date.now() >= deadline) return null;
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), Math.min(3000, deadline - Date.now()));
    try {
      const response = await fetch(getLastFmApiUrl(method, fields), { signal: controller.signal });
      return response.ok ? await response.json() : null;
    } catch { return null; } finally { clearTimeout(timer); controllers.delete(controller); }
  };
  const archive = (id: string | undefined) => id && /^[0-9a-f-]{36}$/i.test(id)
    ? attempt([`https://coverartarchive.org/release/${id}/front-250`, `https://coverartarchive.org/release-group/${id}/front-250`], 'Cover Art Archive')
    : Promise.resolve(null);
  try {
    const direct = attempt([...(track.imageCandidates || []), ...(track.image ? [track.image] : [])], 'Last.fm');
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
    const quick = await Promise.race([direct, new Promise<null>(resolve => { hedgeTimer = setTimeout(() => resolve(null), 250); })]);
    clearTimeout(hedgeTimer);
    if (quick) return quick;
    // Slow image servers must not hold the metadata fallbacks in a queue.
    const providers: Promise<Cover | null>[] = [direct, archive(track.albumMbid),
      (async () => {
        const album = track.album ? (await metadata('album.getInfo', { artist: track.artist, album: track.album }))?.album : null;
        return await attempt(imageCandidates(album?.image), 'Last.fm album') || archive(album?.mbid);
      })(),
      (async () => {
        const album = (await metadata('track.getInfo', { artist: track.artist, track: track.title }))?.track?.album;
        return await attempt(imageCandidates(album?.image), 'Last.fm track') || archive(album?.mbid);
      })(),
      (async () => {
        if (!track.album) return null;
        const results = (await metadata('album.search', { album: track.album }))?.albums;
        for (const album of matchingAlbums(track, Array.isArray(results) ? results : [])) {
          const cover = await attempt(imageCandidates(album.image), 'Last.fm album search') || await archive(album.mbid);
          if (cover) return cover;
        }
        return null;
      })(),
    ];
    return await new Promise<Cover>(resolve => {
      let remaining = providers.length;
      for (const provider of providers) void provider.catch(() => null).then(cover => {
        if (finished) return;
        if (cover || --remaining === 0) { finished = true; resolve(cover || { expires: Date.now() }); }
      });
    });
  } finally { finished = true; for (const controller of controllers) controller.abort(); }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastFmApiUrl } from '../config/lastfm';
import type { CurrentTrack } from '../types/lastfm';
import { loadCoverImage } from './cover-image';

const CACHE_KEY = '@lastfm_artwork_v1';
type Cover = { uri?: string; source?: string; expires: number };
const memory = new Map<string, Cover>();
const pending = new Map<string, Promise<Cover>>();
let restored: Promise<void> | null = null;
const keyFor = (track: CurrentTrack) => [track.artist, track.album || track.title].map(value => value.trim().toLowerCase()).join('|');

export function imageCandidates(images: any): string[] {
  if (!Array.isArray(images)) return [];
  // Prefer a widget-sized image, with other sizes available if the CDN fails.
  const rank: Record<string, number> = { large: 0, extralarge: 1, medium: 2, small: 3 };
  return [...new Set<string>([...images].sort((a, b) => (rank[a?.size] ?? 4) - (rank[b?.size] ?? 4))
    .map(image => image?.['#text']).filter(isCoverUrl))];
}
export function isCoverUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\//i.test(value) && !value.includes('2a96cbd8b46e442fc41c2b86b821562f');
}
async function restoreCache() {
  if (!restored) restored = AsyncStorage.getItem(CACHE_KEY).then(value => {
    try { for (const [id, cover] of JSON.parse(value || '[]')) if (cover.expires > Date.now()) memory.set(id, cover); } catch {}
  }).catch(() => {});
  await restored;
}
export async function getCachedArtwork(track: CurrentTrack): Promise<Cover | undefined> {
  await restoreCache();
  const cover = memory.get(keyFor(track));
  return cover && cover.expires > Date.now() ? cover : undefined;
}
export async function resolveArtwork(track: CurrentTrack, excluded: string[] = []): Promise<Cover> {
  const key = keyFor(track);
  await restoreCache();
  const cached = memory.get(key);
  if (cached && cached.expires > Date.now() && !excluded.includes(cached.uri || '')) return cached;
  if (pending.has(key) && !excluded.length) return pending.get(key)!;
  const request = findArtwork(track, excluded).then(cover => {
    memory.delete(key); memory.set(key, cover);
    while (memory.size > 12) memory.delete(memory.keys().next().value!);
    // Artwork cache writes are optional; a storage quota must not hide a song.
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify([...memory])).catch(() => {});
    return cover;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
async function findArtwork(track: CurrentTrack, excluded: string[]): Promise<Cover> {
  const deadline = Date.now() + 8000;
  const tried = new Set(excluded);
  const attempt = async (urls: string[], source: string): Promise<Cover | null> => {
    for (const url of urls) {
      if (tried.has(url) || !isCoverUrl(url) || Date.now() >= deadline) continue;
      tried.add(url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(2200, deadline - Date.now()));
      try {
        const uri = await loadCoverImage(url, controller.signal);
        return { uri, source, expires: Date.now() + 7 * 86400000 };
      } catch {} finally { clearTimeout(timer); }
    }
    return null;
  };
  const metadata = async (method: 'album.getInfo' | 'track.getInfo', fields: Record<string, string>) => {
    if (Date.now() >= deadline) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(1800, deadline - Date.now()));
    try {
      const response = await fetch(getLastFmApiUrl(method, fields), { signal: controller.signal });
      return response.ok ? await response.json() : null;
    } catch { return null; } finally { clearTimeout(timer); }
  };
  let cover = await attempt([...(track.imageCandidates || []), ...(track.image ? [track.image] : [])], 'Last.fm');
  if (cover) return cover;
  const album = track.album ? (await metadata('album.getInfo', { artist: track.artist, album: track.album }))?.album : null;
  cover = await attempt(imageCandidates(album?.image), 'Last.fm album');
  if (cover) return cover;
  const info = (await metadata('track.getInfo', { artist: track.artist, track: track.title }))?.track;
  cover = await attempt(imageCandidates(info?.album?.image), 'Last.fm track');
  if (cover) return cover;
  const ids = [...new Set([track.albumMbid, album?.mbid, info?.album?.mbid])].filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id));
  for (const id of ids) {
    cover = await attempt([`https://coverartarchive.org/release/${id}/front-250`, `https://coverartarchive.org/release-group/${id}/front-250`], 'Cover Art Archive');
    if (cover) return cover;
  }
  return { expires: Date.now() + 10 * 60000 };
}

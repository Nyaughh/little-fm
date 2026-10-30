import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastFmApiUrl } from '../config/lastfm';
import type { UserTrack } from '../types/lastfm';
import { defaultSettings, normalizeUsernames, parseRecentTrack, patterns, tones, type ListeningState, type WidgetSettings } from './listening-model';

const USERS = '@lastfm_usernames';
const CACHE = '@lastfm_tracks_v1';
const SETTINGS = '@lastfm_widget_settings_v1';
const decode = (value: string | null, fallback: any) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
export async function loadListeningState(): Promise<ListeningState> {
  const values = await AsyncStorage.multiGet([USERS, CACHE, SETTINGS]);
  const usernames = normalizeUsernames(decode(values[0][1], []));
  const cached = decode(values[1][1], []);
  const saved = decode(values[2][1], defaultSettings);
  const settings: WidgetSettings = {
    tone: saved?.tone && Object.prototype.hasOwnProperty.call(tones, saved.tone) ? saved.tone : 'blush',
    // Preserve the old combined themes when upgrading to separate controls.
    pattern: saved?.pattern && Object.prototype.hasOwnProperty.call(patterns, saved.pattern) ? saved.pattern
      : saved?.pattern == null && (saved?.tone === 'alien' || saved?.tone === 'fruits') ? saved.tone : 'doodles',
    friend: usernames.includes(saved?.friend) ? saved.friend : null,
  };
  return { usernames, tracks: Array.isArray(cached) ? cached.filter(row => row && usernames.includes(row.username)) : [], settings };
}
export async function saveUsernames(usernames: string[]) {
  await AsyncStorage.setItem(USERS, JSON.stringify(normalizeUsernames(usernames)));
}
export async function saveWidgetSettings(settings: WidgetSettings) {
  await AsyncStorage.setItem(SETTINGS, JSON.stringify(settings));
}
let pending: Promise<ListeningState> | null = null;
export function refreshListeningState(): Promise<ListeningState> {
  if (pending) return pending;
  pending = fetchState().finally(() => { pending = null; });
  return pending;
}
async function fetchState(): Promise<ListeningState> {
  const state = await loadListeningState();
  const tracks = await Promise.all(state.usernames.map(async (username): Promise<UserTrack> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(getLastFmApiUrl('user.getrecenttracks', { user: username }), { signal: controller.signal });
      if (!response.ok) throw new Error('Last.fm is unavailable. Try again shortly.');
      return { username, currentTrack: parseRecentTrack(await response.json()), checkedAt: Date.now() };
    } catch (error) {
      const previous = state.tracks.find(row => row.username === username);
      return { username, currentTrack: previous?.currentTrack ?? null, checkedAt: previous?.checkedAt,
        error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'Connection timed out. Try again.' };
    } finally { clearTimeout(timer); }
  }));
  // Membership can change during a request. Removed friends must stay removed.
  const latest = await loadListeningState();
  const filtered = tracks.filter(row => latest.usernames.includes(row.username));
  await AsyncStorage.setItem(CACHE, JSON.stringify(filtered));
  // An added friend may have joined while an interval request was running.
  if (latest.usernames.some(name => !state.usernames.includes(name))) return fetchState();
  return { ...latest, tracks: filtered };
}

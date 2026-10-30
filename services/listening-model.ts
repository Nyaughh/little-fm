import type { CurrentTrack, UserTrack } from '../types/lastfm';
import { imageCandidates } from './artwork';

export const tones = {
  blush: { name: 'Petal', background: '#F7E9E6', ink: '#422E32', muted: '#806369', accent: '#B55E72', disc: '#D9A4AE' },
  sage: { name: 'Sage', background: '#E8EDE3', ink: '#303C32', muted: '#63705F', accent: '#52715B', disc: '#A5B69C' },
  cream: { name: 'Oat', background: '#F3EEE2', ink: '#443D31', muted: '#7B7364', accent: '#8E6B40', disc: '#CABB9A' },
  alien: { name: 'Moss', background: '#EAF2D6', ink: '#34452F', muted: '#68785A', accent: '#64864E', disc: '#C4D5A9' },
  fruits: { name: 'Berry', background: '#FBE6E4', ink: '#56333D', muted: '#946970', accent: '#B76673', disc: '#E9ACB1' },
  butter: { name: 'Butter', background: '#FFF2C5', ink: '#51432B', muted: '#7B683C', accent: '#88652B', disc: '#E6CE86' },
  lilac: { name: 'Lilac', background: '#EEE5F5', ink: '#4A3855', muted: '#75617F', accent: '#7E578F', disc: '#CBB0DF' },
} as const;
export const patterns = { doodles: 'Doodles', alien: 'Alien', fruits: 'Fruits', miffy: 'Miffy' } as const;
export type Tone = keyof typeof tones;
export type Pattern = keyof typeof patterns;
export type WidgetSettings = { tone: Tone; pattern: Pattern; friend: string | null };
export type ListeningState = { usernames: string[]; tracks: UserTrack[]; settings: WidgetSettings };
export const defaultSettings: WidgetSettings = { tone: 'blush', pattern: 'doodles', friend: null };
export function checkedLabel(row: UserTrack): string {
  if (row.error) return row.currentTrack ? 'Offline · saved song' : 'Could not load';
  if (!row.checkedAt) return '';
  const date = new Date(row.checkedAt);
  return `Checked ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function normalizeUsernames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((name): name is string => typeof name === 'string').map(name => name.trim()).filter(name => {
    if (!name || seen.has(name.toLowerCase())) return false;
    seen.add(name.toLowerCase());
    return true;
  });
}
export function parseRecentTrack(data: any): CurrentTrack | null {
  if (data?.error) throw new Error(data.message || 'Last.fm could not load this profile.');
  const raw = data?.recenttracks?.track;
  const track = Array.isArray(raw) ? raw[0] : raw;
  if (!track?.name) return null;
  const playedAt = Number(track.date?.uts) * 1000;
  return {
    title: track.name, artist: track.artist?.['#text'] || track.artist?.name || 'Unknown artist',
    album: track.album?.['#text'],
    image: imageCandidates(track.image)[0],
    imageCandidates: imageCandidates(track.image),
    albumMbid: track.album?.mbid,
    url: typeof track.url === 'string' && track.url.startsWith('https://www.last.fm/') ? track.url : undefined,
    isNowPlaying: track['@attr']?.nowplaying === 'true' || track['@attr']?.nowplaying === true,
    playedAt: Number.isFinite(playedAt) && playedAt > 0 ? playedAt : undefined,
  };
}
// Widgets are snapshots. An old or failed fetch must never be shown as live playback.
export function isLive(row: UserTrack, now = Date.now()): boolean {
  return Boolean(!row.error && row.currentTrack?.isNowPlaying && row.checkedAt && now - row.checkedAt >= 0 && now - row.checkedAt < 120000);
}
export function statusLabel(row: UserTrack, now = Date.now()): string {
  if (row.error) return row.currentTrack ? 'Saved song · offline' : 'Could not load';
  if (isLive(row, now)) return 'Listening now';
  if (!row.currentTrack) return 'No recent songs';
  if (!row.currentTrack.playedAt) return 'Last checked song';
  const minutes = Math.max(0, Math.floor((now - row.currentTrack.playedAt) / 60000));
  if (minutes < 1) return 'Just played';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
export function widgetStatusLabel(row: UserTrack, now = Date.now()): string {
  if (row.error) return 'Offline';
  if (!row.currentTrack) return 'No songs';
  if (isLive(row, now)) return 'listening';
  // An old now-playing snapshot tells us when listening was last observed.
  const playedAt = row.currentTrack.playedAt || (row.currentTrack.isNowPlaying ? row.checkedAt : undefined);
  return playedAt ? statusLabel({ ...row, currentTrack: { ...row.currentTrack, isNowPlaying: false, playedAt } }, now) : 'Last song';
}
export function widgetRows(state: ListeningState, circle: boolean): UserTrack[] {
  const rows = state.usernames.map(username => state.tracks.find(row => row.username === username) ?? { username, currentTrack: null });
  if (circle) return rows.sort((a, b) => Number(isLive(b)) - Number(isLive(a)));
  return rows.filter(row => row.username === (state.settings.friend || state.usernames[0])).slice(0, 1);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultSettings, isLive, normalizeUsernames, parseRecentTrack, statusLabel, widgetRows, widgetStatusLabel } from '../listening-model';
import { loadListeningState, refreshListeningState, saveUsernames, saveWidgetSettings } from '../listening';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../config/lastfm', () => ({ getLastFmApiUrl: (_: string, fields: Record<string, string>) => 'https://example.test/' + fields.user }));
const response = (nowplaying = 'true') => ({ recenttracks: { track: [{ name: 'Song', artist: { '#text': 'Artist' }, album: { '#text': 'Album' }, '@attr': { nowplaying }, date: { uts: '1700000000' } }] } });
beforeEach(async () => { await AsyncStorage.clear(); global.fetch = jest.fn(); });

test('normalizes duplicates without losing original username casing', () => {
  expect(normalizeUsernames([' Mochi ', 'mochi', '', 2, 'fern'])).toEqual(['Mochi', 'fern']);
});
test('the Last.fm string false is not treated as now playing', () => {
  expect(parseRecentTrack(response('false'))?.isNowPlaying).toBe(false);
  expect(parseRecentTrack(response())?.isNowPlaying).toBe(true);
  expect(parseRecentTrack({ recenttracks: { track: [] } })).toBeNull();
  expect(() => parseRecentTrack({ error: 6, message: 'User not found' })).toThrow('User not found');
});
test('old and failed snapshots never claim live listening', () => {
  const row = { username: 'mochi', currentTrack: parseRecentTrack(response()), checkedAt: 1000000 };
  expect(isLive(row, 1001000)).toBe(true);
  expect(isLive(row, 1120001)).toBe(false);
  expect(isLive({ ...row, error: 'offline' }, 1001000)).toBe(false);
  expect(statusLabel({ ...row, error: 'offline' })).toBe('Saved song · offline');
});

test('widget status identifies playback without claiming an old snapshot is live', () => {
  const now = new Date(2026, 9, 31, 14, 32).getTime();
  const row = { username: 'mochi', currentTrack: { title: 'Song', artist: 'Artist', isNowPlaying: true }, checkedAt: now };
  expect(widgetStatusLabel(row, now)).toBe('listening');
  expect(widgetStatusLabel(row, now + 30 * 60000)).toBe('30m ago');
  expect(widgetStatusLabel(row, now + 86400000)).toBe('1d ago');
  expect(widgetStatusLabel({ ...row, error: 'No connection' }, now)).toBe('Offline');
  expect(widgetStatusLabel({ ...row, currentTrack: null }, now)).toBe('No songs');
  expect(widgetStatusLabel({ ...row, currentTrack: { ...row.currentTrack, isNowPlaying: false, playedAt: now - 12 * 60000 } }, now)).toBe('12m ago');
});
test('featured friend is selected and the scrollable circle contains everyone', () => {
  const state = { usernames: ['mochi', 'fern', 'june', 'sky'], tracks: [], settings: { ...defaultSettings, friend: 'fern' } };
  expect(widgetRows(state, false).map(row => row.username)).toEqual(['fern']);
  expect(widgetRows(state, true).map(row => row.username)).toEqual(state.usernames);
});
test('persists settings and repairs a removed featured friend', async () => {
  await saveUsernames(['mochi', 'fern']);
  await saveWidgetSettings({ tone: 'sage', pattern: 'fruits', friend: 'fern' });
  expect((await loadListeningState()).settings).toEqual({ tone: 'sage', pattern: 'fruits', friend: 'fern' });
  await saveUsernames(['mochi']);
  expect((await loadListeningState()).settings.friend).toBeNull();
});
test.each([['alien', 'alien'], ['fruits', 'fruits'], ['sage', 'doodles']])('upgrading the old %s theme preserves its pattern', async (tone, pattern) => {
  await AsyncStorage.setItem('@lastfm_widget_settings_v1', JSON.stringify({ tone, friend: null }));
  expect((await loadListeningState()).settings).toEqual({ tone, pattern, friend: null });
});
test('color and pattern choices survive changes independently', async () => {
  await saveWidgetSettings({ ...defaultSettings, tone: 'alien', pattern: 'fruits' });
  const first = (await loadListeningState()).settings;
  await saveWidgetSettings({ ...first, tone: 'cream' });
  expect((await loadListeningState()).settings).toEqual({ ...first, tone: 'cream' });
  const next = (await loadListeningState()).settings;
  await saveWidgetSettings({ ...next, pattern: 'alien' });
  expect((await loadListeningState()).settings).toEqual({ ...next, pattern: 'alien' });
});

test.each(['butter', 'lilac'] as const)('the new %s color and Miffy pattern survive restart independently', async tone => {
  await saveWidgetSettings({ ...defaultSettings, tone, pattern: 'miffy' });
  expect((await loadListeningState()).settings).toEqual({ ...defaultSettings, tone, pattern: 'miffy' });
  await saveWidgetSettings({ ...defaultSettings, tone, pattern: 'doodles' });
  expect((await loadListeningState()).settings).toEqual({ ...defaultSettings, tone, pattern: 'doodles' });
});
test('unknown patterns recover to the default without losing the selected color', async () => {
  await AsyncStorage.setItem('@lastfm_widget_settings_v1', JSON.stringify({ tone: 'sage', pattern: 'missing', friend: null }));
  expect((await loadListeningState()).settings).toEqual({ ...defaultSettings, tone: 'sage' });
});
test('offline refresh keeps the saved song and marks it offline', async () => {
  await saveUsernames(['mochi']);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => response() });
  await refreshListeningState();
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No connection'));
  const next = await refreshListeningState();
  expect(next.tracks[0].currentTrack?.title).toBe('Song');
  expect(next.tracks[0].error).toBe('No connection');
  expect(isLive(next.tracks[0])).toBe(false);
});
test('a late fetch cannot restore a removed friend to the cache', async () => {
  await saveUsernames(['mochi']);
  (global.fetch as jest.Mock).mockImplementationOnce(async () => {
    await saveUsernames([]);
    return { ok: true, json: async () => response() };
  });
  expect((await refreshListeningState()).tracks).toEqual([]);
  expect((await loadListeningState()).tracks).toEqual([]);
});
test('one failed friend does not hide successful results', async () => {
  await saveUsernames(['mochi', 'fern']);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ error: 6, message: 'User not found' }) }).mockResolvedValueOnce({ ok: true, json: async () => response() });
  const next = await refreshListeningState();
  expect(next.tracks[0].error).toBe('User not found');
  expect(next.tracks[1].currentTrack?.title).toBe('Song');
});
test('corrupt saved JSON does not crash widget startup', async () => {
  await AsyncStorage.setItem('@lastfm_usernames', '{');
  await AsyncStorage.setItem('@lastfm_widget_settings_v1', 'null');
  expect(await loadListeningState()).toEqual({ usernames: [], tracks: [], settings: defaultSettings });
});
test('a friend added during an existing fetch is included immediately', async () => {
  await saveUsernames(['mochi']);
  (global.fetch as jest.Mock).mockImplementationOnce(async () => {
    await saveUsernames(['mochi', 'fern']);
    return { ok: true, json: async () => response() };
  }).mockResolvedValue({ ok: true, json: async () => response() });
  const next = await refreshListeningState();
  expect(next.tracks.map(row => row.username)).toEqual(['mochi', 'fern']);
});

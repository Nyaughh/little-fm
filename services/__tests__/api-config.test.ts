jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { listeningApiUrl: 'https://little-fm.test/api/lastfm' } } } }));
import { getLastFmApiUrl } from '../../config/lastfm';

test('the app sends usernames and artwork lookups to the backend without any Last.fm credentials', () => {
  for (const [method, fields] of [
    ['user.getrecenttracks', { user: 'mochi' }],
    ['album.getInfo', { artist: 'Artist & Friends', album: 'An Album' }],
    ['track.getInfo', { artist: 'Artist', track: 'Song' }],
  ] as const) {
    const url = new URL(getLastFmApiUrl(method, fields));
    expect(url.origin).toBe('https://little-fm.test');
    expect(url.pathname).toBe('/api/lastfm');
    expect(url.searchParams.get('method')).toBe(method);
    expect(url.searchParams.has('api_key')).toBe(false);
    expect(url.searchParams.has('api_sig')).toBe(false);
    for (const [name, value] of Object.entries(fields)) expect(url.searchParams.get(name)).toBe(value);
  }
});

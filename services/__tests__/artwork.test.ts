jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../config/lastfm', () => ({ getLastFmApiUrl: (method: string, fields: Record<string, string>) => 'https://example.test/api/lastfm?' + new URLSearchParams({ method, ...fields }) }));
jest.mock('../cover-image', () => ({ loadCoverImage: jest.fn() }));
let artwork: typeof import('../artwork');
let loader: jest.Mock;
const song = { title: 'Song', artist: 'Artist', album: 'Album', isNowPlaying: false };
const images = (uri: string) => [{ size: 'large', '#text': uri }];
beforeEach(async () => {
  jest.resetModules();
  const storageModule = require('@react-native-async-storage/async-storage');
  const storage = storageModule.default ?? storageModule;
  await storage.clear();
  artwork = require('../artwork');
  loader = require('../cover-image').loadCoverImage;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
});
test('rejects Last.fm placeholder art and insecure or empty URLs', () => {
  expect(artwork.imageCandidates(images('https://lastfm.test/2a96cbd8b46e442fc41c2b86b821562f.png'))).toEqual([]);
  expect(artwork.imageCandidates(images('http://example.test/cover.jpg'))).toEqual([]);
  expect(artwork.imageCandidates([{ size: 'small', '#text': '' }])).toEqual([]);
});
test('a broken recent cover falls back to album metadata artwork', async () => {
  loader.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce('data:image/jpeg;base64,VALID');
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ album: { image: images('https://cover.test/album.jpg') } }) });
  const cover = await artwork.resolveArtwork({ ...song, image: 'https://cover.test/broken.jpg' });
  expect(cover.source).toBe('Last.fm album');
  expect(cover.uri).toBe('data:image/jpeg;base64,VALID');
});
test('missing album covers fall back to track metadata', async () => {
  loader.mockResolvedValue('https://cover.test/track.jpg');
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce({ ok: true, json: async () => ({ track: { album: { image: images('https://cover.test/track.jpg') } } }) });
  expect((await artwork.resolveArtwork(song)).source).toBe('Last.fm track');
});
test('Cover Art Archive release-group is tried when release artwork is missing', async () => {
  loader.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce('data:image/jpeg;base64,VALID');
  const cover = await artwork.resolveArtwork({ ...song, albumMbid: '12345678-1234-1234-1234-123456789abc' });
  expect(cover.source).toBe('Cover Art Archive');
  expect(loader.mock.calls[1][0]).toContain('/release-group/');
});
test('offline artwork lookup returns an empty result for the illustrated fallback', async () => {
  loader.mockRejectedValue(new Error('offline'));
  (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  expect((await artwork.resolveArtwork(song)).uri).toBeUndefined();
});
test('concurrent lookups and later offline use share one cached cover', async () => {
  loader.mockResolvedValue('https://cover.test/good.jpg');
  const track = { ...song, image: 'https://cover.test/good.jpg' };
  const [first, second] = await Promise.all([artwork.resolveArtwork(track), artwork.resolveArtwork(track)]);
  expect(first.uri).toBe(second.uri);
  expect(loader).toHaveBeenCalledTimes(1);
  expect((await artwork.getCachedArtwork(track))?.uri).toBe(first.uri);
  await artwork.resolveArtwork(track);
  expect(loader).toHaveBeenCalledTimes(1);
});
test('an image error skips the previously cached URL', async () => {
  loader.mockResolvedValueOnce('https://cover.test/old.jpg');
  const track = { ...song, image: 'https://cover.test/old.jpg' };
  await artwork.resolveArtwork(track);
  loader.mockResolvedValueOnce('https://cover.test/new.jpg');
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ album: { image: images('https://cover.test/new.jpg') } }) });
  expect((await artwork.resolveArtwork(track, ['https://cover.test/old.jpg'])).uri).toBe('https://cover.test/new.jpg');
  expect(loader.mock.calls[1][0]).toBe('https://cover.test/new.jpg');
});

test('an update retries a saved artwork failure instead of keeping the old Android placeholder', async () => {
  const module = require('@react-native-async-storage/async-storage');
  const storage = module.default ?? module;
  await storage.setItem('@lastfm_artwork_v1', JSON.stringify([['artist|album', { expires: Date.now() + 600000 }]]));
  loader.mockResolvedValue('data:image/jpeg;base64,VALID');
  expect((await artwork.resolveArtwork({ ...song, image: 'https://cover.test/album.jpg' })).uri).toBe('data:image/jpeg;base64,VALID');
  expect(loader).toHaveBeenCalledTimes(1);
});

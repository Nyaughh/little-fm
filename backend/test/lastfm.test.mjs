import test from 'node:test';
import assert from 'node:assert/strict';
import { createLastFmService } from '../lib/lastfm.mjs';

const key = 'test-server-only-credential';
const lookup = '/api/lastfm?method=user.getrecenttracks&user=mochi';
const song = { recenttracks: { track: [{ name: 'Glue Song', artist: { '#text': 'beabadoobee' }, album: { '#text': 'Glue Song' }, image: [{ size: 'large', '#text': 'https://cover.test/song.jpg' }], '@attr': { nowplaying: 'true' } }] } };
const response = body => ({ ok: true, text: async () => JSON.stringify(body) });

test('only the upstream request receives the server key, and unneeded metadata is removed', async () => {
  let target;
  const handle = createLastFmService({ apiKey: key, fetcher: async url => {
    target = url;
    return response({ ...song, debug: key });
  } });
  const result = await handle({ url: lookup });
  assert.equal(target.origin, 'https://ws.audioscrobbler.com');
  assert.equal(target.searchParams.get('api_key'), key);
  assert.equal(target.searchParams.get('limit'), '1');
  assert.equal(result.body.recenttracks.track[0].name, 'Glue Song');
  assert.equal(result.body.recenttracks.track[0]['@attr'].nowplaying, 'true');
  assert.equal(JSON.stringify(result).includes(key), false);
  assert.equal(result.body.debug, undefined);
});

test('write methods, credentials, redirects, duplicate and arbitrary parameters are rejected before fetching', async () => {
  let calls = 0;
  const handle = createLastFmService({ apiKey: key, fetcher: async () => { calls++; return response(song); } });
  for (const url of [
    '/api/lastfm?method=track.scrobble&artist=a&track=b',
    lookup + '&api_key=attacker', lookup + '&sk=session', lookup + '&url=https://example.test',
    lookup + '&method=track.love', lookup + '&user=other', lookup + '&limit=1000',
    '/api/lastfm?method=__proto__', '/api/lastfm?method=user.getrecenttracks&user=bad%2Fname',
    '/api/lastfm?method=album.getinfo&artist=&album=Song',
  ]) assert.equal((await handle({ url })).status, 400, url);
  assert.equal((await handle({ method: 'POST', url: lookup })).status, 405);
  assert.equal(calls, 0);
});

test('upstream URLs, errors and reflected credentials never leak into responses', async () => {
  const failed = createLastFmService({ apiKey: key, fetcher: async () => { throw new Error('request api_key=' + key); } });
  const failure = await failed({ url: lookup });
  assert.equal(failure.status, 502);
  assert.equal(JSON.stringify(failure).includes(key), false);
  const reflected = createLastFmService({ apiKey: key, fetcher: async () => response({ recenttracks: { track: [{ name: key }] } }) });
  assert.equal(JSON.stringify(await reflected({ url: lookup })).includes(key), false);
});

test('simultaneous requests are coalesced, cached, then refreshed after expiry', async () => {
  let calls = 0, time = 1000;
  const handle = createLastFmService({ apiKey: key, now: () => time, fetcher: async () => { calls++; return response(song); } });
  const [a, b] = await Promise.all([handle({ url: lookup }), handle({ url: lookup })]);
  assert.deepEqual(a.body, b.body);
  await handle({ url: lookup });
  assert.equal(calls, 1);
  time += 16000;
  await handle({ url: lookup });
  assert.equal(calls, 2);
});

test('per-client and upstream request limits return 429 without more Last.fm calls', async () => {
  let calls = 0;
  const handle = createLastFmService({ apiKey: key, requestLimit: 2, upstreamLimit: 1, fetcher: async () => { calls++; return response(song); } });
  assert.equal((await handle({ url: lookup, ip: 'one' })).status, 200);
  assert.equal((await handle({ url: lookup, ip: 'one' })).status, 200);
  assert.equal((await handle({ url: lookup, ip: 'one' })).status, 429);
  assert.equal((await handle({ url: lookup.replace('mochi', 'fern'), ip: 'two' })).status, 429);
  assert.equal(calls, 1);
});

test('artwork methods expose only image candidates and album IDs', async () => {
  for (const method of ['album', 'track']) {
    const album = { image: [{ size: 'large', '#text': 'https://cover.test/album.jpg' }], mbid: '12345678-1234-1234-1234-123456789abc', secret: key };
    const handle = createLastFmService({ apiKey: key, fetcher: async () => response(method === 'album' ? { album } : { track: { album } }) });
    const result = await handle({ url: `/api/lastfm?method=${method}.getInfo&artist=Artist&${method}=Song` });
    const actual = method === 'album' ? result.body.album : result.body.track.album;
    assert.equal(result.status, 200);
    assert.equal(actual.image[0]['#text'], 'https://cover.test/album.jpg');
    assert.equal(actual.mbid, album.mbid);
    assert.equal(JSON.stringify(result).includes(key), false);
  }
});

test('missing configuration and invalid upstream data fail without exposing internals', async () => {
  assert.equal((await createLastFmService()({ url: lookup })).status, 503);
  const handle = createLastFmService({ apiKey: key, fetcher: async () => ({ ok: true, text: async () => '<html>bad gateway</html>' }) });
  assert.equal((await handle({ url: lookup })).status, 502);
  assert.equal((await handle({ method: 'OPTIONS' })).status, 204);
});

test('Last.fm profile errors remain usable by the client without raw upstream messages', async () => {
  const handle = createLastFmService({ apiKey: key, fetcher: async () => response({ error: 6, message: key }) });
  for (let i = 0; i < 2; i++) {
    const result = await handle({ url: lookup });
    assert.equal(result.status, 200);
    assert.equal(result.body.error, 6);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.stringify(result).includes(key), false);
  }
});

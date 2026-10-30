const LASTFM = 'https://ws.audioscrobbler.com/2.0/';
const METHODS = {
  'user.getrecenttracks': ['user'],
  'album.getinfo': ['artist', 'album'],
  'track.getinfo': ['artist', 'track'],
  'album.search': ['album'],
};
const commonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};
const result = (status, body, headers = {}) => ({ status, body, headers: { ...commonHeaders, ...headers } });

// The public endpoint supports only these read methods and fixed parameters.
// It never forwards caller-supplied URLs, keys, signatures, or write methods.
export function createLastFmService({ apiKey, fetcher = fetch, now = Date.now, requestLimit = 120, upstreamLimit = 300 } = {}) {
  const cache = new Map();
  const pending = new Map();
  const clients = new Map();
  let upstreamWindow = { expires: 0, count: 0 };
  const clean = (value, limit = 300) => typeof value === 'string'
    ? (apiKey ? value.replaceAll(apiKey, '[redacted]') : value).slice(0, limit) : '';
  const imageList = images => Array.isArray(images) ? images.slice(0, 8).map(image => ({
    size: clean(image?.size, 20), '#text': /^https:\/\//i.test(image?.['#text'] || '') ? clean(image['#text'], 2000) : '',
  })) : [];
  const albumInfo = album => ({ mbid: clean(album?.mbid, 36), image: imageList(album?.image) });
  const publicResponse = (method, data) => {
    if (data?.error) {
      if (Number(data.error) === 6) return { error: 6, message: 'Last.fm could not find this user or song.' };
      throw new Error('Upstream error');
    }
    if (method === 'album.getinfo') return { album: albumInfo(data?.album) };
    if (method === 'track.getinfo') return { track: { album: albumInfo(data?.track?.album) } };
    if (method === 'album.search') {
      const matches = data?.results?.albummatches?.album;
      return { albums: (Array.isArray(matches) ? matches : []).slice(0, 8).map(album => ({
        name: clean(album?.name), artist: clean(album?.artist), ...albumInfo(album),
      })) };
    }
    const raw = data?.recenttracks?.track;
    return { recenttracks: { track: (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(0, 1).map(track => ({
      name: clean(track?.name),
      artist: { '#text': clean(track?.artist?.['#text'] || track?.artist?.name) },
      album: { '#text': clean(track?.album?.['#text']), mbid: clean(track?.album?.mbid, 36) },
      image: imageList(track?.image),
      url: typeof track?.url === 'string' && track.url.startsWith('https://www.last.fm/') ? clean(track.url, 2000) : '',
      date: { uts: clean(track?.date?.uts, 20) },
      '@attr': { nowplaying: track?.['@attr']?.nowplaying === 'true' || track?.['@attr']?.nowplaying === true ? 'true' : 'false' },
    })) } };
  };
  const limited = ip => {
    const time = now();
    for (const [id, entry] of clients) if (entry.expires <= time) clients.delete(id);
    let entry = clients.get(ip);
    if (!entry) {
      if (clients.size >= 2000) return true;
      entry = { expires: time + 60000, count: 0 };
      clients.set(ip, entry);
    }
    return ++entry.count > requestLimit;
  };
  return async function handle({ method = 'GET', url = '/', ip = 'unknown' } = {}) {
    if (method === 'OPTIONS') return result(204, null);
    if (method !== 'GET') return result(405, { message: 'Use GET for listening lookups.' }, { Allow: 'GET, OPTIONS' });
    if (limited(ip)) return result(429, { message: 'Too many checks. Try again in a minute.' }, { 'Retry-After': '60' });
    if (!apiKey) return result(503, { message: 'Music service is being set up. Try again shortly.' });
    if (url.length > 2200) return result(400, { message: 'Invalid lookup.' });
    let query;
    try { query = new URL(url, 'https://little.fm').searchParams; } catch { return result(400, { message: 'Invalid lookup.' }); }
    const lookup = (query.get('method') || '').toLowerCase();
    const fields = Object.hasOwn(METHODS, lookup) ? METHODS[lookup] : null;
    if (!fields) return result(400, { message: 'Unsupported lookup.' });
    if ([...query.keys()].some(key => key !== 'method' && !fields.includes(key) || query.getAll(key).length !== 1)) {
      return result(400, { message: 'Unsupported lookup parameters.' });
    }
    const parameters = Object.fromEntries(fields.map(field => [field, (query.get(field) || '').trim()]));
    if (Object.values(parameters).some(value => !value || value.length > 300 || /[\u0000-\u001f]/.test(value))
      || (parameters.user && !/^[\p{L}\p{N}_-]{1,64}$/u.test(parameters.user))) return result(400, { message: 'Invalid username or song.' });
    const id = JSON.stringify([lookup, parameters]);
    const hasImage = images => Array.isArray(images) && images.some(image => image['#text'] && !image['#text'].includes('2a96cbd8b46e442fc41c2b86b821562f'));
    const hasArtwork = body => lookup === 'album.search' ? body.albums?.some(album => hasImage(album.image))
      : hasImage((lookup === 'track.getinfo' ? body.track?.album : body.album)?.image);
    const ttlFor = body => body.error || lookup === 'user.getrecenttracks' ? 15000 : hasArtwork(body) ? 21600000 : 60000;
    const headersFor = body => ({
      'Cache-Control': 'public, max-age=5',
      'Vercel-CDN-Cache-Control': `public, s-maxage=${ttlFor(body) / 1000}`,
    });
    const saved = cache.get(id);
    if (saved?.expires > now()) return result(200, saved.body, saved.body.error ? { 'Cache-Control': 'no-store' } : headersFor(saved.body));
    if (pending.has(id)) return pending.get(id);
    if (upstreamWindow.expires <= now()) upstreamWindow = { expires: now() + 60000, count: 0 };
    if (++upstreamWindow.count > upstreamLimit) return result(429, { message: 'Music service is busy. Try again shortly.' }, { 'Retry-After': '60' });
    const request = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const upstream = new URL(LASTFM);
        upstream.search = new URLSearchParams({ ...parameters, method: lookup, api_key: apiKey, format: 'json', limit: lookup === 'album.search' ? '8' : '1', autocorrect: '1' }).toString();
        const response = await fetcher(upstream, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Upstream unavailable');
        const raw = await response.text();
        if (raw.length > 256000) throw new Error('Upstream response too large');
        const body = publicResponse(lookup, JSON.parse(raw));
        cache.delete(id);
        cache.set(id, { body, expires: now() + ttlFor(body) });
        while (cache.size > 512) cache.delete(cache.keys().next().value);
        return result(200, body, body.error ? { 'Cache-Control': 'no-store' } : headersFor(body));
      } catch {
        // Never forward upstream error text or a request URL containing the key.
        return result(502, { message: 'Last.fm is unavailable. Try again shortly.' });
      } finally { clearTimeout(timer); }
    })();
    pending.set(id, request);
    try { return await request; } finally { pending.delete(id); }
  };
}

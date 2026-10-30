import { createLastFmService } from '../lib/lastfm.mjs';

const handle = createLastFmService({ apiKey: process.env.LASTFM_API_KEY });

export default async function handler(request, response) {
  const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const result = await handle({ method: request.method, url: request.url, ip });
  response.writeHead(result.status, result.headers);
  response.end(result.body === null ? undefined : JSON.stringify(result.body));
}

import { createServer } from 'node:http';
import handler from './api/lastfm.mjs';

createServer((request, response) => {
  if (request.url?.split('?')[0] === '/api/lastfm') return handler(request, response);
  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ message: 'Not found' }));
}).listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('Little fm API: http://127.0.0.1:3001/api/lastfm'));

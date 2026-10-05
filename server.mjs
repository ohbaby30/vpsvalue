import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
import { calculateCard, createRatesService, today, xml } from './calculator.mjs';
export { calculateCard, createRatesService, cycleDays } from './calculator.mjs';

export function createServer({ getRates = createRatesService(), timeZone = process.env.TZ || 'Asia/Shanghai',
  publicUrl = process.env.PUBLIC_URL || '', currentDate = () => today(timeZone) } = {}) {
  if (publicUrl && !/^https?:\/\//.test(publicUrl)) throw new Error('PUBLIC_URL must start with http:// or https://');
  const cardTemplate = readFile(resolve(root, 'card.svg'), 'utf8');
  return http.createServer(async (req, res) => {
    function send(status, type, body, cache = 'no-store') {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        return send(405, 'text/plain; charset=utf-8', 'Method not allowed');
      }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') return send(200, 'application/json', '{"ok":true}');
      if (url.pathname === '/api/rates') {
        const rates = await getRates();
        return send(rates.success ? 200 : 503, 'application/json; charset=utf-8', JSON.stringify(rates));
      }
      if (url.pathname === '/card') {
        let values;
        try { values = calculateCard(url.searchParams, currentDate()); }
        catch { return send(400, 'text/plain; charset=utf-8', 'Invalid card parameters'); }
        const forwardedProto = req.headers['x-forwarded-proto']?.split(',')[0].trim();
        const protocol = forwardedProto === 'https' ? 'https' : 'http';
        values.siteUrl = publicUrl ? `${publicUrl.replace(/\/$/, '')}/` : `${protocol}://${req.headers.host || 'localhost'}/`;
        const svg = (await cardTemplate).replace(/\{\{(\w+)\}\}/g, (_, key) => xml(values[key]));
        res.setHeader('Access-Control-Allow-Origin', '*');
        return send(200, 'image/svg+xml; charset=utf-8', svg, 'public, max-age=300');
      }
      const pathname = decodeURIComponent(url.pathname);
      let filename;
      if (pathname === '/' || pathname === '/index.html') filename = 'index.html';
      else if (/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname)) filename = pathname.slice(1);
      else return send(404, 'text/plain; charset=utf-8', 'Not found');
      let body;
      try { body = await readFile(resolve(root, 'public', filename)); }
      catch { return send(404, 'text/plain; charset=utf-8', 'Not found'); }
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8', '.ttf': 'font/ttf', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
      return send(200, types[extname(filename)] || 'application/octet-stream', body,
        filename === 'index.html' ? 'no-cache' : 'public, max-age=86400');
    } catch (error) {
      send(error instanceof URIError ? 400 : 500, 'text/plain; charset=utf-8', 'Request failed');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(root, 'server.mjs')) {
  const port = Number(process.env.PORT || 8080), host = process.env.HOST || '0.0.0.0';
  const server = createServer();
  server.listen(port, host, () => console.log(`VPS calculator listening at http://${host}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}

import { calculateCard, createRatesService, today, xml } from './calculator.mjs';

export function createWorker({ cardTemplate, fetcher = fetch,
  currentDate = () => today('Asia/Shanghai') } = {}) {
  return {
    async fetch(request, env, ctx) {
      const respond = (status, type, body, extra = {}) => new Response(request.method === 'HEAD' ? null : body, {
        status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', ...extra },
      });
      try {
        if (!['GET', 'HEAD'].includes(request.method)) {
          return respond(405, 'text/plain; charset=utf-8', 'Method not allowed', { Allow: 'GET, HEAD' });
        }
        const url = new URL(request.url);
        if (url.pathname === '/health') return respond(200, 'application/json', '{"ok":true}');
        if (url.pathname === '/api/rates') {
          // Use an origin-specific key without user headers or query parameters.
          const key = new Request(`${url.origin}/api/rates`);
          const cache = globalThis.caches?.default;
          let hit;
          try { hit = await cache?.match(key); } catch { /* Cache failure must not stop calculation. */ }
          if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit;
          // No cross-request fetch promises: Workers ties outbound I/O to the current request.
          const rates = await createRatesService({ fetcher })();
          const response = respond(rates.success ? 200 : 503, 'application/json; charset=utf-8',
            JSON.stringify(rates), { 'Cache-Control': rates.success ? 'public, max-age=21600' : 'no-store' });
          if (rates.success && cache && request.method === 'GET') {
            ctx.waitUntil(cache.put(key, response.clone()).catch(() => {}));
          }
          return response;
        }
        if (url.pathname === '/card') {
          let values;
          try { values = calculateCard(url.searchParams, currentDate()); }
          catch { return respond(400, 'text/plain; charset=utf-8', 'Invalid card parameters'); }
          values.siteUrl = `${url.origin}/`;
          const svg = cardTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => xml(values[key]));
          return respond(200, 'image/svg+xml; charset=utf-8', svg,
            { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' });
        }
        const pathname = decodeURIComponent(url.pathname);
        if (pathname === '/' || pathname === '/index.html' || /^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname)) {
          return env.ASSETS.fetch(request);
        }
        return respond(404, 'text/plain; charset=utf-8', 'Not found');
      } catch (error) {
        return respond(error instanceof URIError ? 400 : 500, 'text/plain; charset=utf-8', 'Request failed');
      }
    },
  };
}

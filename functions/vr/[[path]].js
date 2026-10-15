/* 360 tours for Type D and Aerial, served from this site (2026-10-16).
   Types A/B/C/E come from the tour maker's CDN, which allows framing. Type D and Aerial exist only on
   m-aurora.com.my, which sends X-Frame-Options: SAMEORIGIN, so the 360 viewer could not show them and opened a
   new tab instead. This function fetches those two tour folders from m-aurora.com.my and serves them from
   /vr/type-d/ and /vr/aerial/ on this site, so the viewer can frame them like the other four. Every tour file
   (player, tour script, language file, image tiles) then loads from this site, so no cross-origin rule applies.
   Only the two folders below are reachable; GET only; responses cached at the edge for a day.
   When the tour maker publishes D and Aerial to its CDN, point VRTOURS at the CDN and delete this file. */
const ORIGIN = 'https://m-aurora.com.my/wp-content/themes/divi-child/';
const TOURS = { 'type-d': 'M-Aurora-360VR-Type-D/', 'aerial': 'M-Aurora-360VR-Aerial-2/' };
const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', txt: 'text/plain; charset=utf-8',
  json: 'application/json', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml',
  ico: 'image/x-icon', mp3: 'audio/mpeg', mp4: 'video/mp4', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', xml: 'application/xml' };

export async function onRequestGet({ request, params }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const folder = TOURS[parts[0]];
  if (!folder) return new Response('Not found', { status: 404 });
  const rest = parts.slice(1).join('/') || 'index.html';
  if (rest.includes('..') || rest.startsWith('/')) return new Response('Bad request', { status: 400 });
  const ext = (rest.split('.').pop() || '').toLowerCase();
  const upstream = ORIGIN + folder + rest + new URL(request.url).search;
  const up = await fetch(upstream, {
    headers: { 'User-Agent': 'Mozilla/5.0 (ver2.m-aurora.com.my 360 tour)', 'Accept': request.headers.get('Accept') || '*/*' },
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });
  if (!up.ok) return new Response(up.status === 404 ? 'Not found' : 'Upstream error', { status: up.status === 404 ? 404 : 502 });
  const h = new Headers();
  h.set('Content-Type', TYPES[ext] || up.headers.get('Content-Type') || 'application/octet-stream');
  h.set('Cache-Control', 'public, max-age=86400');
  h.set('X-Frame-Options', 'SAMEORIGIN');   /* this site may frame it; no one else can */
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(up.body, { status: 200, headers: h });
}

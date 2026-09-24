import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://www.greyexim.com';
const OUT = path.resolve('audit/evidence/site-crawl.json');
const AGENT = 'GreyExim-QA-Audit/1.0 (+read-only; owner-authorized)';

const decode = (s = '') => s
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const strip = (s = '') => decode(s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const pick = (html, pattern) => strip((html.match(pattern) || [])[1] || '');
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decode(m ? (m[1] ?? m[2] ?? m[3] ?? '') : '');
};

async function request(url, method = 'GET') {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': AGENT, accept: method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(20000),
    });
    const body = method === 'HEAD' ? '' : await response.text();
    return {
      ok: true,
      status: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      durationMs: Math.round(performance.now() - started),
      contentType: response.headers.get('content-type') || '',
      contentLength: Number(response.headers.get('content-length') || 0),
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, redirected: false, durationMs: Math.round(performance.now() - started), error: String(error), body: '', headers: {} };
  }
}

function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => decode(m[1].trim()));
}

function pageAudit(url, result) {
  const html = result.body || '';
  const htmlTag = (html.match(/<html\b[^>]*>/i) || [''])[0];
  const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || pick(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const canonical = pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i)
    || pick(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*>/i);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]));
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: attr(m[0], 'src'),
    alt: attr(m[0], 'alt'),
    loading: attr(m[0], 'loading'),
    width: attr(m[0], 'width'),
    height: attr(m[0], 'height'),
    srcset: attr(m[0], 'srcset'),
  }));
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], 'href')).filter(Boolean);
  const internalLinks = [...new Set(anchors.map((href) => {
    try {
      const parsed = new URL(href, url);
      parsed.hash = '';
      return parsed.origin === ORIGIN ? parsed.href : null;
    } catch { return null; }
  }).filter(Boolean))];
  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      const parsed = JSON.parse(m[1]);
      return Array.isArray(parsed) ? parsed.map((x) => x?.['@type']).filter(Boolean) : parsed?.['@type'] || null;
    } catch { return 'INVALID_JSON'; }
  });
  const meta = (property) => pick(html, new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'));

  return {
    url,
    status: result.status,
    finalUrl: result.finalUrl,
    redirected: result.redirected,
    durationMs: result.durationMs,
    htmlBytes: Buffer.byteLength(html),
    contentType: result.contentType,
    title,
    titleLength: title.length,
    description,
    descriptionLength: description.length,
    canonical,
    lang: attr(htmlTag, 'lang'),
    viewport: meta('viewport'),
    robots: meta('robots'),
    h1Count: h1s.length,
    h1s,
    ogTitle: meta('og:title'),
    ogDescription: meta('og:description'),
    ogImage: meta('og:image'),
    twitterCard: meta('twitter:card'),
    schemaTypes: schemas.flat().filter(Boolean),
    imageCount: images.length,
    imagesMissingAlt: images.filter((img) => !img.alt).length,
    imagesMissingDimensions: images.filter((img) => !img.width || !img.height).length,
    imagesMissingSrcset: images.filter((img) => !img.srcset).length,
    eagerImages: images.filter((img) => img.loading !== 'lazy').length,
    internalLinks,
    error: result.error || null,
  };
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const generatedAt = new Date().toISOString();
const root = await request(`${ORIGIN}/sitemap.xml`);
if (!root.ok || root.status !== 200) throw new Error(`Unable to read root sitemap: ${root.status} ${root.error || ''}`);
const childSitemaps = parseSitemap(root.body);
const sitemapResults = await pool(childSitemaps, 4, async (url) => ({ url, ...(await request(url)) }));
const sitemapUrls = [...new Set(sitemapResults.flatMap((r) => parseSitemap(r.body)).filter((url) => url.startsWith(ORIGIN)))];
const priority = [
  `${ORIGIN}/`,
  `${ORIGIN}/search?q=scarf`,
  `${ORIGIN}/cart`,
  `${ORIGIN}/pages/contact`,
  `${ORIGIN}/pages/faq`,
  `${ORIGIN}/pages/track-order`,
  `${ORIGIN}/pages/returns`,
];
const urls = [...new Set([...priority, ...sitemapUrls])];
const pages = await pool(urls, 5, async (url) => pageAudit(url, await request(url)));
const linkTargets = [...new Set(pages.flatMap((p) => p.internalLinks))]
  .filter((url) => !/\.(?:jpg|jpeg|png|gif|webp|avif|svg|mp4|webm|pdf|zip)(?:\?|$)/i.test(url));
const linkChecks = await pool(linkTargets, 6, async (url) => {
  let result = await request(url, 'HEAD');
  if (!result.ok || result.status === 405 || result.status === 403) result = await request(url, 'GET');
  return { url, status: result.status, finalUrl: result.finalUrl, redirected: result.redirected, durationMs: result.durationMs, error: result.error || null };
});
const robots = await request(`${ORIGIN}/robots.txt`);
const report = {
  generatedAt,
  origin: ORIGIN,
  methodology: {
    mode: 'Read-only HTTP crawl',
    concurrency: { pages: 5, links: 6 },
    timeoutMs: 20000,
    coverage: 'All URLs exposed by Shopify XML sitemaps plus priority utility URLs; internal anchor targets checked by HEAD with GET fallback.',
  },
  sitemap: {
    rootStatus: root.status,
    childSitemaps: sitemapResults.map((r) => ({ url: r.url, status: r.status, urls: parseSitemap(r.body).length, error: r.error || null })),
    discoveredUrls: sitemapUrls.length,
  },
  robots: { status: robots.status, body: robots.body, headers: robots.headers },
  rootHeaders: root.headers,
  pages,
  linkChecks,
  summary: {
    auditedPages: pages.length,
    non200Pages: pages.filter((p) => p.status !== 200).length,
    redirectedPages: pages.filter((p) => p.redirected).length,
    missingTitles: pages.filter((p) => !p.title).length,
    duplicateTitleGroups: Object.entries(Object.groupBy(pages.filter((p) => p.title), (p) => p.title)).filter(([, group]) => group.length > 1).map(([title, group]) => ({ title, urls: group.map((p) => p.url) })),
    missingDescriptions: pages.filter((p) => !p.description).length,
    missingCanonicals: pages.filter((p) => !p.canonical).length,
    h1Issues: pages.filter((p) => p.h1Count !== 1).map((p) => ({ url: p.url, h1Count: p.h1Count, h1s: p.h1s })),
    missingOgImages: pages.filter((p) => !p.ogImage).length,
    invalidSchemaPages: pages.filter((p) => p.schemaTypes.includes('INVALID_JSON')).map((p) => p.url),
    brokenInternalLinks: linkChecks.filter((l) => l.status >= 400 || l.status === 0),
    redirectedInternalLinks: linkChecks.filter((l) => l.redirected),
  },
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output: OUT, ...report.summary, duplicateTitleGroups: report.summary.duplicateTitleGroups.length, brokenInternalLinks: report.summary.brokenInternalLinks.length, redirectedInternalLinks: report.summary.redirectedInternalLinks.length }, null, 2));

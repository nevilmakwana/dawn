import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const profile = path.resolve('audit/tmp/chrome-probe');
const output = path.resolve(process.env.PROBE_QUICK ? `audit/evidence/browser-probe-${process.env.PROBE_QUICK}.json` : 'audit/evidence/browser-probe.json');
const allCases = [
  ['home-320', 'https://www.greyexim.com/', 320, 740],
  ['collection-320', 'https://www.greyexim.com/collections/women-scarves', 320, 740],
  ['product-320', 'https://www.greyexim.com/products/merry-forest-french-vanilla-candle', 320, 740],
  ['search-320', 'https://www.greyexim.com/search?q=scarf', 320, 740],
  ['article-320', 'https://www.greyexim.com/blogs/news/gsm-in-fabric-complete-guide-to-fabric-weight-quality-usage', 320, 740],
  ['contact-320', 'https://www.greyexim.com/pages/contact', 320, 740],
  ['faq-320', 'https://www.greyexim.com/pages/contact?view=faq', 320, 740],
  ['returns-320', 'https://www.greyexim.com/pages/contact?view=returns', 320, 740],
  ['track-320', 'https://www.greyexim.com/pages/contact?view=track-order', 320, 740],
  ['home-390', 'https://www.greyexim.com/', 390, 844],
  ['collection-390', 'https://www.greyexim.com/collections/women-scarves', 390, 844],
  ['product-390', 'https://www.greyexim.com/products/merry-forest-french-vanilla-candle', 390, 844],
  ['search-390', 'https://www.greyexim.com/search?q=scarf', 390, 844],
  ['article-390', 'https://www.greyexim.com/blogs/news/gsm-in-fabric-complete-guide-to-fabric-weight-quality-usage', 390, 844],
  ['home-1440', 'https://www.greyexim.com/', 1440, 900],
  ['collection-1440', 'https://www.greyexim.com/collections/women-scarves', 1440, 900],
  ['product-1440', 'https://www.greyexim.com/products/merry-forest-french-vanilla-candle', 1440, 900],
  ['search-1440', 'https://www.greyexim.com/search?q=scarf', 1440, 900],
  ['article-1440', 'https://www.greyexim.com/blogs/news/gsm-in-fabric-complete-guide-to-fabric-weight-quality-usage', 1440, 900],
];
const cases = process.env.PROBE_QUICK === 'article'
  ? allCases.filter(([name]) => name === 'article-390')
  : allCases;

await fs.mkdir(profile, { recursive: true });
const child = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function endpoint(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await delay(200);
  }
  throw new Error(`CDP endpoint unavailable: ${url}`);
}

let ws;
const pending = new Map();
const listeners = new Set();
let nextId = 1;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

try {
  const pages = await endpoint(`http://127.0.0.1:${port}/json/list`);
  const target = pages.find((item) => item.type === 'page');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');

  const results = [];
  for (const [name, url, width, height] of cases) {
    const events = { exceptions: [], console: [], failedRequests: [], errorResponses: [] };
    const handler = (message) => {
      if (message.method === 'Runtime.exceptionThrown') events.exceptions.push(message.params.exceptionDetails?.text || message.params.exceptionDetails?.exception?.description || 'Unknown exception');
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) events.console.push({ type: message.params.type, values: message.params.args.map((arg) => arg.value || arg.description || arg.type).slice(0, 5) });
      if (message.method === 'Network.loadingFailed') events.failedRequests.push({ url: message.params.requestId, errorText: message.params.errorText, type: message.params.type, canceled: message.params.canceled || false });
      if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) events.errorResponses.push({ url: message.params.response.url, status: message.params.response.status, type: message.params.type });
    };
    listeners.add(handler);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    if (width < 768) await send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone' });
    else await send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', platform: 'Windows' });
    await send('Page.navigate', { url });
    await delay(3500);
    const expression = `(() => {
      const root = document.documentElement;
      const body = document.body;
      const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
      const brokenImages = [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src).slice(0, 30);
      const tables = [...document.querySelectorAll('table')].map((table) => { const r = table.getBoundingClientRect(); const p = table.parentElement; return { width: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), viewportOverflow: r.right > innerWidth + 1 || r.left < -1, parentClientWidth: p?.clientWidth || null, parentScrollWidth: p?.scrollWidth || null, rows: table.rows.length }; });
      const inputs = [...document.querySelectorAll('input, select, textarea')].filter(visible).map((el) => ({ tag: el.tagName, type: el.type || null, id: el.id || null, name: el.name || null, fontSize: getComputedStyle(el).fontSize, label: el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || null })).slice(0, 30);
      const fixed = [...document.querySelectorAll('*')].filter((el) => visible(el) && ['fixed','sticky'].includes(getComputedStyle(el).position)).map((el) => { const r=el.getBoundingClientRect(); return { tag: el.tagName, id: el.id, className: String(el.className).slice(0,120), position:getComputedStyle(el).position, top:Math.round(r.top), bottom:Math.round(r.bottom), height:Math.round(r.height) }; }).slice(0, 30);
      const controls = [...document.querySelectorAll('button, a, input, select, summary')].filter(visible).map((el) => { const r=el.getBoundingClientRect(); return { tag:el.tagName, label:(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g,' ').slice(0,80), width:Math.round(r.width), height:Math.round(r.height) }; });
      const overflowingElements = [...document.querySelectorAll('main *')].filter((el) => { const r=el.getBoundingClientRect(); return visible(el) && (el.scrollWidth > el.clientWidth + 1 || r.right > innerWidth + 1 || r.left < -1); }).map((el) => { const r=el.getBoundingClientRect(); return { tag:el.tagName, id:el.id || null, className:String(el.className).slice(0,100), text:(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,120), clientWidth:el.clientWidth, scrollWidth:el.scrollWidth, left:Math.round(r.left), right:Math.round(r.right), overflowX:getComputedStyle(el).overflowX, whiteSpace:getComputedStyle(el).whiteSpace }; }).slice(0,80);
      const smallControls = controls.filter((c) => c.width < 24 || c.height < 24).slice(0,50);
      const details = [...document.querySelectorAll('details')].filter(visible).map((el) => ({ open:el.open, summary:el.querySelector('summary')?.textContent?.trim().replace(/\\s+/g,' ').slice(0,120) || null })).slice(0,30);
      const resourceEntries = performance.getEntriesByType('resource');
      return {
        title: document.title, href: location.href, readyState: document.readyState,
        viewport: { innerWidth, innerHeight, devicePixelRatio },
        dimensions: { htmlClientWidth: root.clientWidth, htmlScrollWidth: root.scrollWidth, bodyClientWidth: body?.clientWidth || 0, bodyScrollWidth: body?.scrollWidth || 0, horizontalOverflow: root.scrollWidth > root.clientWidth + 1 },
        headings: [...document.querySelectorAll('h1')].filter(visible).map((el) => el.textContent.trim().replace(/\\s+/g,' ').slice(0,200)),
        images: { total: document.images.length, broken: brokenImages.length, brokenSources: brokenImages, missingAlt: [...document.images].filter((img) => !img.hasAttribute('alt')).length },
        tables, inputs, fixed, smallControls, details, overflowingElements,
        counts: { domElements: document.querySelectorAll('*').length, scripts: document.scripts.length, stylesheets: document.styleSheets.length, resources: resourceEntries.length, iframes: document.querySelectorAll('iframe').length },
        resources: { transferBytes: resourceEntries.reduce((s,e)=>s+(e.transferSize||0),0), encodedBytes: resourceEntries.reduce((s,e)=>s+(e.encodedBodySize||0),0), decodedBytes: resourceEntries.reduce((s,e)=>s+(e.decodedBodySize||0),0) },
      };
    })()`;
    const evaluated = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    const beforeScroll = evaluated.result.value;
    const scrollEval = await send('Runtime.evaluate', { expression: `window.scrollTo(0, Math.min(1200, document.documentElement.scrollHeight - innerHeight)); new Promise(r => setTimeout(() => r([...document.querySelectorAll('*')].filter(el => { const s=getComputedStyle(el); const x=el.getBoundingClientRect(); return ['fixed','sticky'].includes(s.position) && s.display!=='none' && x.width>0 && x.height>0; }).map(el => ({tag:el.tagName,id:el.id,className:String(el.className).slice(0,120),position:getComputedStyle(el).position,top:Math.round(el.getBoundingClientRect().top),height:Math.round(el.getBoundingClientRect().height)})).slice(0,30)), 500))`, returnByValue: true, awaitPromise: true });
    listeners.delete(handler);
    results.push({ name, requestedUrl: url, width, height, page: beforeScroll, afterScrollFixed: scrollEval.result.value, events });
  }
  const report = { generatedAt: new Date().toISOString(), browser: 'Google Chrome headless via CDP', methodology: 'Cold-ish sequential navigation in an isolated browser profile; 3.5 second settling window; mobile Safari user agent with Chrome device emulation for narrow widths. Not equivalent to physical iOS Safari.', cases: results };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(results.map((item) => ({ name: item.name, href: item.page.href, overflow: item.page.dimensions.horizontalOverflow, scrollWidth: item.page.dimensions.htmlScrollWidth, viewport: item.page.dimensions.htmlClientWidth, brokenImages: item.page.images.broken, missingAlt: item.page.images.missingAlt, h1s: item.page.headings.length, tablesOverflow: item.page.tables.filter((t) => t.viewportOverflow).length, smallControls: item.page.smallControls.length, exceptions: item.events.exceptions.length, consoleWarnings: item.events.console.length, networkErrors: item.events.errorResponses.length + item.events.failedRequests.length, dom: item.page.counts.domElements, scripts: item.page.counts.scripts, resources: item.page.counts.resources })), null, 2));
} finally {
  try { ws?.close(); } catch {}
  child.kill();
}

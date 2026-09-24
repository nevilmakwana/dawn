import fs from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('audit/evidence');
const names = (await fs.readdir(dir)).filter((name) => /^lighthouse-.*\.json$/.test(name) && name !== 'lighthouse-summary.json');
const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift', 'interactive'];
const opportunityIds = ['render-blocking-resources', 'unused-css-rules', 'unused-javascript', 'modern-image-formats', 'uses-optimized-images', 'uses-responsive-images', 'offscreen-images', 'uses-text-compression', 'server-response-time', 'font-display'];

const rows = [];
for (const name of names) {
  const lhr = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
  const audit = lhr.audits;
  const failed = (category) => (lhr.categories?.[category]?.auditRefs || [])
    .map((ref) => audit[ref.id])
    .filter((item) => item && item.scoreDisplayMode !== 'notApplicable' && item.score !== null && item.score < 1)
    .map((item) => ({ id: item.id, title: item.title, score: item.score, displayValue: item.displayValue || null }));
  const network = audit['network-requests']?.details?.items || [];
  const thirdParty = audit['third-party-summary']?.details?.items || [];
  const consoleItems = audit['errors-in-console']?.details?.items || [];
  rows.push({
    file: name,
    url: lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl,
    fetchTime: lhr.fetchTime,
    formFactor: lhr.configSettings?.formFactor,
    scores: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map((id) => [id, Math.round((lhr.categories?.[id]?.score ?? 0) * 100)])),
    metrics: Object.fromEntries(metricIds.map((id) => [id, { numericValue: audit[id]?.numericValue ?? null, displayValue: audit[id]?.displayValue ?? null, score: audit[id]?.score ?? null }])),
    transferBytes: network.reduce((sum, item) => sum + (item.transferSize || 0), 0),
    resourceBytes: network.reduce((sum, item) => sum + (item.resourceSize || 0), 0),
    requestCount: network.length,
    failedRequests: network.filter((item) => (item.statusCode || 0) >= 400).map((item) => ({ url: item.url, statusCode: item.statusCode, resourceType: item.resourceType })),
    domains: Object.entries(Object.groupBy(network, (item) => {
      try { return new URL(item.url).hostname; } catch { return 'invalid'; }
    })).map(([domain, items]) => ({ domain, requests: items.length, transferBytes: items.reduce((sum, item) => sum + (item.transferSize || 0), 0), resourceBytes: items.reduce((sum, item) => sum + (item.resourceSize || 0), 0) })).sort((a, b) => b.transferBytes - a.transferBytes),
    largestRequests: [...network].sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)).slice(0, 20).map((item) => ({ url: item.url, resourceType: item.resourceType, transferSize: item.transferSize, resourceSize: item.resourceSize, statusCode: item.statusCode })),
    resourceTypes: Object.entries(Object.groupBy(network, (item) => item.resourceType || 'Other')).map(([type, items]) => ({ type, requests: items.length, transferBytes: items.reduce((sum, item) => sum + (item.transferSize || 0), 0) })),
    thirdParties: thirdParty.slice(0, 15).map((item) => ({ entity: item.entity, transferSize: item.transferSize, mainThreadTime: item.mainThreadTime, blockingTime: item.blockingTime })),
    mainThreadMs: audit['mainthread-work-breakdown']?.numericValue ?? null,
    bootupMs: audit['bootup-time']?.numericValue ?? null,
    domSize: audit['dom-size']?.numericValue ?? null,
    totalByteWeight: audit['total-byte-weight']?.numericValue ?? null,
    opportunities: opportunityIds.map((id) => ({ id, score: audit[id]?.score ?? null, title: audit[id]?.title, displayValue: audit[id]?.displayValue ?? null, savingsBytes: audit[id]?.details?.overallSavingsBytes ?? null, savingsMs: audit[id]?.details?.overallSavingsMs ?? null })).filter((item) => item.score !== null && item.score < 1),
    insights: ['cache-insight', 'document-latency-insight', 'dom-size-insight', 'duplicated-javascript-insight', 'font-display-insight', 'forced-reflow-insight', 'image-delivery-insight', 'lcp-breakdown-insight', 'lcp-discovery-insight', 'legacy-javascript-insight', 'modern-http-insight', 'network-dependency-tree-insight', 'render-blocking-insight', 'third-parties-insight', 'viewport-insight'].map((id) => ({ id, score: audit[id]?.score ?? null, title: audit[id]?.title || null, description: audit[id]?.description || null, displayValue: audit[id]?.displayValue || null, savingsBytes: audit[id]?.details?.overallSavingsBytes ?? null, savingsMs: audit[id]?.details?.overallSavingsMs ?? null, items: Array.isArray(audit[id]?.details?.items) ? audit[id].details.items.slice(0, 20) : [] })).filter((item) => item.score !== null && item.score < 1),
    consoleErrors: consoleItems.map((item) => ({ source: item.source, description: item.description, url: item.sourceLocation?.url || null, line: item.sourceLocation?.line || null })),
    accessibilityFailures: failed('accessibility'),
    seoFailures: failed('seo'),
    bestPracticeFailures: failed('best-practices'),
  });
}

const output = { generatedAt: new Date().toISOString(), methodology: 'Lighthouse CLI lab data; mobile runs use Lighthouse defaults and desktop uses the desktop preset. Metrics are lab observations, not field/RUM values.', runs: rows };
await fs.writeFile(path.join(dir, 'lighthouse-summary.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(rows.map((row) => ({ file: row.file, url: row.url, formFactor: row.formFactor, scores: row.scores, metrics: Object.fromEntries(Object.entries(row.metrics).map(([k, v]) => [k, v.displayValue])), requestCount: row.requestCount, transferMB: +(row.transferBytes / 1048576).toFixed(2), mainThreadMs: row.mainThreadMs, consoleErrors: row.consoleErrors.length, a11yFailures: row.accessibilityFailures.length, seoFailures: row.seoFailures.length })), null, 2));

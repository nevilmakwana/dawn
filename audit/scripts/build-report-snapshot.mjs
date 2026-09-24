import fs from 'node:fs/promises';
import path from 'node:path';

const evidence = path.resolve('audit/evidence');
const crawl = JSON.parse(await fs.readFile(path.join(evidence, 'site-crawl.json'), 'utf8'));
const lighthouse = JSON.parse(await fs.readFile(path.join(evidence, 'lighthouse-summary.json'), 'utf8'));
const browser = JSON.parse(await fs.readFile(path.join(evidence, 'browser-probe.json'), 'utf8'));
const theme = JSON.parse(await fs.readFile(path.join(evidence, 'static-theme-audit.json'), 'utf8'));
const markdown = await fs.readFile(path.resolve('audit/GREY-EXIM-COMPLETE-WEBSITE-AUDIT.md'), 'utf8');

const lighthouseRows = lighthouse.runs.map((run) => ({
  page: run.file.replace(/^lighthouse-|\.json$/g, ''),
  url: run.url,
  formFactor: run.formFactor,
  performance: run.scores.performance,
  accessibility: run.scores.accessibility,
  bestPractices: run.scores['best-practices'],
  seo: run.scores.seo,
  fcpMs: run.metrics['first-contentful-paint'].numericValue,
  lcpMs: run.metrics['largest-contentful-paint'].numericValue,
  tbtMs: run.metrics['total-blocking-time'].numericValue,
  cls: run.metrics['cumulative-layout-shift'].numericValue,
  interactiveMs: run.metrics.interactive.numericValue,
  requests: run.requestCount,
  transferBytes: run.transferBytes,
  mainThreadMs: run.mainThreadMs,
  consoleErrors: run.consoleErrors.length,
  accessibilityFailures: run.accessibilityFailures.length,
}));

const bugRows = markdown.split('\n')
  .filter((line) => /^\| GE-\d+ \|/.test(line))
  .map((line) => {
    const [id, severity, what, where, why, how, expectedResult, verify] = line.split('|').slice(1, -1).map((cell) => cell.trim());
    return { id, severity, what, where, why, how, expectedResult, verify };
  });

const snapshot = {
  surface: 'report',
  title: 'GREY EXIM — COMPLETE WEBSITE AUDIT',
  generatedAt: new Date().toISOString(),
  asOf: '2026-09-23',
  status: 'reviewed',
  buildStatus: 'creating',
  filters: [],
  queries: {
    lighthouse_runs: {
      rows: lighthouseRows,
      methods: [{ language: 'javascript', code: 'Flatten each saved Lighthouse LHR summary into one row per page/profile without changing the recorded scores or metric numeric values.' }],
      source: {
        label: 'Lighthouse CLI lab captures for Grey Exim',
        files: lighthouse.runs.map((run) => `audit/evidence/${run.file}`),
        filters: ['Single captured lab run per listed page/profile on 2026-09-23; not field/RUM data.'],
        evidenceFlow: [{ title: 'Capture', detail: 'Lighthouse CLI loaded the public production URL in headless Chrome and saved JSON.' }, { title: 'Summarize', detail: 'audit/scripts/summarize-lighthouse.mjs extracted scores, timings, requests, bytes, failures, domains, and insights.' }],
        metricDefinitions: [
          { label: 'LCP', definition: 'Largest Contentful Paint from the saved Lighthouse lab run, in milliseconds.', componentIds: ['audit-overview', 'performance-table', 'audit-lighthouse'] },
          { label: 'TBT', definition: 'Total Blocking Time from the saved Lighthouse lab run, in milliseconds; not INP.', componentIds: ['performance-table', 'audit-lighthouse'] },
          { label: 'Transfer bytes', definition: 'Sum of transferSize for network requests present in the Lighthouse run.', componentIds: ['performance-table', 'audit-lighthouse'] },
        ],
      },
    },
    crawl_summary: {
      rows: [{ auditedPages: crawl.summary.auditedPages, non200Pages: crawl.summary.non200Pages, missingTitles: crawl.summary.missingTitles, missingDescriptions: crawl.summary.missingDescriptions, missingCanonicals: crawl.summary.missingCanonicals, missingOgImages: crawl.summary.missingOgImages, duplicateTitleGroups: crawl.summary.duplicateTitleGroups.length, brokenInternalLinks: crawl.summary.brokenInternalLinks.length, redirectedInternalLinks: crawl.summary.redirectedInternalLinks.length }],
      methods: [{ language: 'javascript', code: 'Count URL-level outcomes from the sitemap crawl; treat direct priority URLs and sitemap URLs as the reviewed population.' }],
      source: {
        label: 'Grey Exim public sitemap and internal-link crawl',
        files: ['audit/evidence/site-crawl.json'],
        filters: ['All URLs exposed by the production sitemap plus listed priority utility URLs.'],
        evidenceFlow: [{ title: 'Discover', detail: 'Read production sitemap.xml and child sitemaps.' }, { title: 'Fetch', detail: 'GET pages with concurrency 5 and 20-second timeout; link targets use HEAD with GET fallback.' }],
        metricDefinitions: [{ label: 'Audited pages', definition: 'Unique public URLs fetched from sitemap discovery plus priority utility URLs.', componentIds: ['audit-overview', 'crawl-summary', 'audit-url-inventory'] }],
      },
    },
    broken_links: {
      rows: crawl.summary.brokenInternalLinks,
      source: { label: 'Failed internal/priority URL checks', files: ['audit/evidence/site-crawl.json'], filters: ['HTTP status 400 or greater, or request failure.'], evidenceFlow: [{ title: 'Check', detail: 'HEAD request with GET fallback for discovered internal link targets.' }] },
    },
    responsive_checks: {
      rows: browser.cases.map((item) => ({ name: item.name, url: item.page.href, width: item.width, height: item.height, horizontalOverflow: item.page.dimensions.horizontalOverflow, scrollWidth: item.page.dimensions.htmlScrollWidth, viewportWidth: item.page.dimensions.htmlClientWidth, brokenImages: item.page.images.broken, missingAlt: item.page.images.missingAlt, h1Count: item.page.headings.length, overflowingTables: item.page.tables.filter((table) => table.viewportOverflow).length, smallControlsSample: item.page.smallControls.length, exceptions: item.events.exceptions.length, networkErrors: item.events.errorResponses.length + item.events.failedRequests.length, domElements: item.page.counts.domElements, scripts: item.page.counts.scripts, resources: item.page.counts.resources })),
      source: { label: 'Chrome DevTools Protocol responsive probes', files: ['audit/evidence/browser-probe.json'], filters: ['320, 390, and 1440 px representative viewports; 3.5-second settling window.'], evidenceFlow: [{ title: 'Render', detail: 'Navigate production pages in an isolated headless Chrome profile.' }, { title: 'Inspect', detail: 'Read DOM dimensions, image state, controls, tables, scripts, resources, and console/network events.' }] },
    },
    static_theme: {
      rows: [{ totalFiles: theme.totalFiles, totalBytes: theme.totalBytes, importantDeclarations: theme.totals.important, inlineScripts: theme.totals.inlineScripts, inlineStyles: theme.totals.inlineStyles, eventListeners: theme.totals.eventListeners, mutationObservers: theme.totals.mutationObservers, intervals: theme.totals.intervals, consoleCalls: theme.totals.consoleCalls, potentialUnusedAssets: theme.potentialUnusedAssets.length, potentialUnusedBytes: theme.potentialUnusedAssets.reduce((sum, item) => sum + item.bytes, 0), missingRenders: theme.missingRenders.length, invalidJson: theme.invalidJson.length }],
      methods: [{ language: 'javascript', code: 'Scan local theme files for exact syntax signals and filename references; zero-reference assets remain review candidates, not deletion proof.' }],
      source: { label: 'Local Grey Exim Dawn theme snapshot', files: ['audit/evidence/static-theme-audit.json'], filters: ['assets, sections, snippets, templates, layout, config, and locales.'], evidenceFlow: [{ title: 'Inventory', detail: 'Read local theme files and sizes.' }, { title: 'Analyze', detail: 'Count CSS/JS signals, parse JSON/JSONC, and resolve static render targets.' }] },
    },
    bug_database: {
      rows: bugRows,
      source: { label: 'Evidence-backed Grey Exim master bug database', files: ['audit/GREY-EXIM-COMPLETE-WEBSITE-AUDIT.md'], filters: ['Confirmed, likely, and potential findings are explicitly labeled.'], evidenceFlow: [{ title: 'Synthesize', detail: 'Map crawler, Lighthouse, browser, screenshot, static-source, and Theme Check evidence into actionable findings.' }] },
    },
  },
};

await fs.writeFile(path.join(evidence, 'report-snapshot.json'), JSON.stringify(snapshot, null, 2));
console.log(JSON.stringify({ output: path.join(evidence, 'report-snapshot.json'), queries: Object.keys(snapshot.queries), bugs: bugRows.length, lighthouseRuns: lighthouseRows.length }, null, 2));

import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const roots = ['assets', 'sections', 'snippets', 'templates', 'layout', 'config', 'locales'];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else result.push(file);
  }
  return result;
}

const files = (await Promise.all(roots.map((dir) => walk(path.join(root, dir))))).flat();
const textExt = new Set(['.liquid', '.json', '.js', '.css', '.svg', '.md', '.txt']);
const records = [];
for (const file of files) {
  const stat = await fs.stat(file);
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const ext = path.extname(file).toLowerCase();
  const text = textExt.has(ext) ? await fs.readFile(file, 'utf8') : '';
  records.push({ file, rel, ext, bytes: stat.size, text });
}

const corpus = records.filter((r) => r.text).map((r) => `\n/* ${r.rel} */\n${r.text}`).join('\n');
const count = (text, re) => [...text.matchAll(re)].length;
const signals = records.filter((r) => r.text).map((r) => ({
  file: r.rel,
  bytes: r.bytes,
  important: count(r.text, /!important/g),
  inlineScripts: count(r.text, /<script\b/gi),
  inlineStyles: count(r.text, /<style\b|{%\s*style\s*%}/gi),
  eventListeners: count(r.text, /addEventListener\s*\(/g),
  mutationObservers: count(r.text, /new\s+MutationObserver\s*\(/g),
  intervals: count(r.text, /setInterval\s*\(/g),
  consoleCalls: count(r.text, /console\.(?:log|warn|error)\s*\(/g),
})).filter((r) => r.important || r.inlineScripts || r.inlineStyles || r.eventListeners || r.mutationObservers || r.intervals || r.consoleCalls);

const assets = records.filter((r) => r.rel.startsWith('assets/')).map((r) => {
  const name = path.basename(r.file);
  const references = records.filter((candidate) => candidate.rel !== r.rel && candidate.text.includes(name)).map((candidate) => candidate.rel);
  return { name, bytes: r.bytes, ext: r.ext, referenceCount: references.length, references: references.slice(0, 30) };
});

const missingRenders = [];
for (const record of records.filter((r) => r.text)) {
  for (const match of record.text.matchAll(/{%[-\s]*(?:render|include)\s+['"]([^'"]+)['"]/g)) {
    const target = `snippets/${match[1]}.liquid`;
    if (!records.some((r) => r.rel === target)) missingRenders.push({ source: record.rel, target });
  }
  for (const match of record.text.matchAll(/{%[-\s]*section\s+['"]([^'"]+)['"]/g)) {
    const target = `sections/${match[1]}.liquid`;
    if (!records.some((r) => r.rel === target)) missingRenders.push({ source: record.rel, target });
  }
}

const invalidJson = [];
for (const record of records.filter((r) => ['templates', 'config', 'locales'].includes(r.rel.split('/')[0]) && r.ext === '.json')) {
  try { JSON.parse(record.text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')); }
  catch (error) { invalidJson.push({ file: record.rel, error: String(error) }); }
}

const byExtension = Object.values(Object.groupBy(records, (r) => r.ext || 'none')).map((items) => ({ ext: items[0].ext || 'none', files: items.length, bytes: items.reduce((sum, item) => sum + item.bytes, 0) })).sort((a, b) => b.bytes - a.bytes);
const totals = signals.reduce((out, row) => {
  for (const key of ['important', 'inlineScripts', 'inlineStyles', 'eventListeners', 'mutationObservers', 'intervals', 'consoleCalls']) out[key] += row[key];
  return out;
}, { important: 0, inlineScripts: 0, inlineStyles: 0, eventListeners: 0, mutationObservers: 0, intervals: 0, consoleCalls: 0 });

const report = {
  generatedAt: new Date().toISOString(),
  methodology: 'Static filename/reference and syntax signal inventory. A zero filename reference is a candidate for manual review, not proof that an asset is safe to delete.',
  totalFiles: records.length,
  totalBytes: records.reduce((sum, item) => sum + item.bytes, 0),
  byExtension,
  totals,
  topSignals: signals.sort((a, b) => (b.important + b.eventListeners + b.inlineScripts) - (a.important + a.eventListeners + a.inlineScripts)).slice(0, 40),
  largestFiles: records.sort((a, b) => b.bytes - a.bytes).slice(0, 40).map(({ rel, bytes, ext }) => ({ file: rel, bytes, ext })),
  potentialUnusedAssets: assets.filter((a) => a.referenceCount === 0).sort((a, b) => b.bytes - a.bytes),
  missingRenders,
  invalidJson,
};
await fs.mkdir(path.resolve('audit/evidence'), { recursive: true });
await fs.writeFile(path.resolve('audit/evidence/static-theme-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output: 'audit/evidence/static-theme-audit.json', totalFiles: report.totalFiles, totalMB: +(report.totalBytes / 1048576).toFixed(2), totals, potentialUnusedAssets: report.potentialUnusedAssets.length, potentialUnusedBytes: report.potentialUnusedAssets.reduce((sum, item) => sum + item.bytes, 0), missingRenders, invalidJson, largestFiles: report.largestFiles.slice(0, 12) }, null, 2));

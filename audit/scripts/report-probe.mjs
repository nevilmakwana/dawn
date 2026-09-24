import { spawn } from 'node:child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9444;
const profile = 'E:\\greyexim_shopify\\dawn\\audit\\tmp\\report-probe';
const child = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function endpoint(url) {
  for (let index = 0; index < 50; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await delay(200);
  }
  throw new Error('Chrome DevTools endpoint unavailable');
}

let socket;
const pending = new Map();
let nextId = 1;
const events = [];

try {
  const pages = await endpoint(`http://127.0.0.1:${port}/json/list`);
  socket = new WebSocket(pages.find((item) => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
      return;
    }
    if (['Runtime.exceptionThrown', 'Runtime.consoleAPICalled', 'Log.entryAdded'].includes(message.method)) {
      events.push(message);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await delay(5000);
  const result = await send('Runtime.evaluate', {
    expression: `({title:document.title, text:document.body.innerText.slice(0,1000), html:document.body.innerHTML.slice(0,1000), color:getComputedStyle(document.body).color, background:getComputedStyle(document.body).backgroundColor, viewport:innerWidth, scrollWidth:document.documentElement.scrollWidth, overflow:document.documentElement.scrollWidth > innerWidth + 1})`,
    returnByValue: true,
  });
  console.log(JSON.stringify({ page: result.result.value, events }, null, 2));
} finally {
  try { socket?.close(); } catch {}
  child.kill();
}

// Loads the app's own <script> from index.html into Node with minimal browser stubs,
// and exposes the model internals for testing. No dependencies.
const fs = require('fs');
const path = require('path');

function extractScript(html) {
  const start = html.indexOf('<script>\nconst $=');
  const end = html.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('main <script> not found in index.html');
  return html.slice(start + '<script>\n'.length, end);
}

function stubElement() {
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === 'value') return t._v ?? '';
      if (k === 'textContent') return t._t ?? '';
      if (k === 'options') return [];
      if (k === 'files') return null;
      if (k === 'hidden') return t._h ?? true;
      if (k === 'getContext') return () => new Proxy({}, { get: (o, kk) => (kk === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
      if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, x: 0, y: 0, width: 900, height: 900 });
      if (k === 'clientWidth') return 900;
      if (k in t) return t[k];
      return stubElement();
    },
    set(t, k, v) { if (k === 'value') t._v = v; else if (k === 'textContent') t._t = v; else if (k === 'hidden') t._h = v; else t[k] = v; return true; },
    apply() { return stubElement(); },
  });
}

// Fixed "now": Thursday 2026-10-22 at 08:00 local time, so tests do not depend on the clock.
const NOW = new Date(2026, 9, 22, 8, 0).getTime();

async function loadApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const src = extractScript(html);
  const els = {};
  const store = {};
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } }
  const env = {
    document: new Proxy({}, { get: (o, k) => (k === 'documentElement' ? stubElement() : k === 'fonts' ? undefined : k === 'getElementById' ? id => (els[id] = els[id] || stubElement()) : () => stubElement()) }),
    window: { devicePixelRatio: 1 },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    getComputedStyle: () => ({ getPropertyValue: () => '#336699' }),
    matchMedia: () => ({ addEventListener() {} }),
    MutationObserver: class { observe() {} },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    location: { hash: '', hostname: 'localhost', pathname: '/', protocol: 'http:', origin: 'http://localhost' },
    history: { replaceState() {} },
    setInterval: () => 0,
    fetch: async () => { throw new Error('offline in tests'); },
    navigator: {},
    Date: FakeDate,
  };
  const names = Object.keys(env);
  const expose = `
    return {
      get events(){return events}, set events(v){events=v},
      get logs(){return logs}, set logs(v){logs=v},
      get conds(){return conds}, set conds(v){conds=v},
      get dayLate(){return dayLate}, set dayLate(v){dayLate=v},
      get boxState(){return boxState}, set boxState(v){boxState=v},
      get learned(){return learned},
      norm, mk, SAMPLE, occOf, runDay, simDay, statsOf, ecdf, quant, sOwn, sDur, skewNoise, gauss, mulberry32,
      dayOrder, dependsOn, repairLinks, learnAll, eff, shrink, parseICS, icsTime, importICS, calendarJSON,
      addDays, dowOf, mondayOf, todayKey, T0, T1, BIN, NB,
      ready: () => new Promise(r => setTimeout(r, 30)),
    };`;
  const fn = new Function(...names, src + '\n' + expose);
  const app = fn(...names.map(n => env[n]));
  await app.ready();
  return app;
}

module.exports = { loadApp };

// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const DAY = '2026-10-21'; // a Wednesday
const ev = (app, id, start, dur, extra = {}) => app.mk(id, id, 0, [2], start, dur, extra);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ± ${tol}`);
const sim = (app, events, n = 4000) => { app.events = events; app.logs = {}; app.boxState = {}; app.learnAll(); return app.runDay(DAY, app.mulberry32(42), n); };

test('occupancy of a fixed 18:00–19:00 event is 1 inside and 0 outside', async () => {
  const app = await loadApp();
  const { res } = sim(app, [ev(app, 'a', { type: 'fixed', mu: 1080 }, { type: 'fixed', median: 60 })], 200);
  const occ = app.occOf(res.a.S, res.a.E, res.a.H);
  for (let b = 0; b < app.NB; b++) {
    const center = app.T0 + app.BIN * (b + 0.5);
    assert.equal(occ[b], center >= 1080 && center < 1140 ? 1 : 0, `bin at ${center} min`);
  }
});

test('occupancy is a probability (0..1) for every event and day of the demo week', async () => {
  const app = await loadApp();
  app.events = app.SAMPLE().map(app.norm);
  for (let i = 0; i < 7; i++) {
    const day = app.simDay(app.addDays('2026-10-19', i), 1500);
    for (const id in day.occ) for (const p of day.occ[id]) assert.ok(p >= 0 && p <= 1, `${id}: ${p}`);
  }
});

test('integrated occupancy equals the mean duration for an event well inside the day', async () => {
  const app = await loadApp();
  const { res } = sim(app, [ev(app, 'a', { type: 'normal', mu: 720, sigma: 15 }, { type: 'lognormal', median: 60, spread: 0.3 })], 8000);
  const occ = app.occOf(res.a.S, res.a.E, res.a.H);
  const area = occ.reduce((x, y) => x + y, 0) * app.BIN;
  let mean = 0; for (let i = 0; i < res.a.S.length; i++) mean += res.a.E[i] - res.a.S[i]; mean /= res.a.S.length;
  near(area, mean, 2.5, 'area under occupancy (min)');
});

test('collision probability matches the analytic value', async () => {
  // A: exactly 10:00–11:00. B: starts Normal(10:50, 10 min), lasts exactly 30 min.
  // They overlap iff B starts before 11:00 (B always starts after 10:00 - 30 min): P = Φ(1) ≈ 0.8413.
  const app = await loadApp();
  const { res } = sim(app, [
    ev(app, 'a', { type: 'fixed', mu: 600 }, { type: 'fixed', median: 60 }),
    ev(app, 'b', { type: 'normal', mu: 650, sigma: 10 }, { type: 'fixed', median: 30 }),
  ], 20000);
  let c = 0; for (let k = 0; k < 20000; k++) if (res.a.S[k] < res.b.E[k] && res.b.S[k] < res.a.E[k]) c++;
  near(c / 20000, 0.8413, 0.012, 'P(overlap)');
});

test('ecdf and quantiles are monotone and consistent', async () => {
  const app = await loadApp();
  const a = Float64Array.from([5, 1, 3, 2, 4]).sort();
  assert.equal(app.ecdf(a, 0), 0); assert.equal(app.ecdf(a, 3), 0.6); assert.equal(app.ecdf(a, 99), 1);
  assert.equal(app.quant(a, 0.5), 3);
});

test('skewed arrivals keep the median at the typical time; the tail points the chosen way', async () => {
  const app = await loadApp();
  const r = app.mulberry32(7), c = { shift: 0, noise: 1, dur: 1, spread: 1 };
  for (const skew of [-1, -0.5, 0.5, 1]) {
    const xs = Array.from({ length: 20000 }, () => app.sOwn({ type: 'skewed', mu: 600, sigma: 20, skew }, r, c)).sort((x, y) => x - y);
    const q = p => xs[Math.floor(p * xs.length)];
    near(q(0.5), 600, 0.8, `median at skew ${skew}`);
    const upper = q(0.95) - 600, lower = 600 - q(0.05);
    assert.ok(skew > 0 ? upper > lower : lower > upper, `tail direction at skew ${skew}`);
  }
});

test('a chained event never starts before its parent ends', async () => {
  const app = await loadApp();
  const { res } = sim(app, [
    ev(app, 'p', { type: 'normal', mu: 1100, sigma: 20 }, { type: 'lognormal', median: 90, spread: 0.3 }),
    ev(app, 'c', { type: 'after', after: 'p', gap: 10, gapSigma: 15, gapSkew: -1, mu: 1200, sigma: 5 }, { type: 'fixed', median: 30 }),
  ]);
  for (let i = 0; i < res.p.S.length; i++) assert.ok(res.c.S[i] >= res.p.E[i] - 1e-9);
});

test('"skip this too": a chained event happens only when its parent does', async () => {
  const app = await loadApp();
  const { res } = sim(app, [
    ev(app, 'p', { type: 'normal', mu: 1100, sigma: 10 }, { type: 'fixed', median: 60 }, { exists: 0.5 }),
    ev(app, 'c', { type: 'after', after: 'p', gap: 10, gapSigma: 5, ifMissing: 'skip', mu: 1200, sigma: 5 }, { type: 'fixed', median: 30 }),
  ], 10000);
  let both = 0, child = 0;
  for (let i = 0; i < 10000; i++) { child += res.c.H[i]; both += res.c.H[i] && res.p.H[i]; }
  assert.equal(both, child, 'child never happens without its parent');
  near(child / 10000, 0.5, 0.02, 'child happens about half the time');
});

test('a circular "after" link is repaired instead of hanging or crashing', async () => {
  const app = await loadApp();
  app.events = [
    ev(app, 'a', { type: 'after', after: 'b', gap: 5, gapSigma: 1 }, { type: 'fixed', median: 30 }),
    ev(app, 'b', { type: 'after', after: 'a', gap: 5, gapSigma: 1 }, { type: 'fixed', median: 30 }),
    ev(app, 'c', { type: 'after', after: 'missing', gap: 5, gapSigma: 1 }, { type: 'fixed', median: 30 }),
  ];
  const fixed = app.repairLinks();
  assert.ok(fixed.length >= 2, 'at least one link of the loop and the dangling link are removed');
  const remaining = app.events.filter(e => e.start.type === 'after');
  for (const e of remaining) assert.ok(!app.dependsOn(app.events.find(x => x.id === e.start.after), e), 'no loop remains');
  assert.doesNotThrow(() => app.runDay(DAY, app.mulberry32(1), 100));
});

test('shared lateness correlates events on the same day; off means independent', async () => {
  const app = await loadApp();
  const two = () => [ev(app, 'a', { type: 'normal', mu: 600, sigma: 10 }, { type: 'fixed', median: 30 }), ev(app, 'b', { type: 'normal', mu: 900, sigma: 10 }, { type: 'fixed', median: 30 })];
  const corr = (x, y) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
  app.dayLate = 0; let { res } = sim(app, two(), 8000); near(corr(res.a.S, res.b.S), 0, 0.05, 'correlation with shared lateness off');
  app.dayLate = 10; ({ res } = sim(app, two(), 8000)); near(corr(res.a.S, res.b.S), 0.5, 0.05, 'correlation with σ_day = σ_event'); // 10²/(10²+10²)
  app.dayLate = 0;
});

test('learning moves the forecast toward logged arrivals, with the plan as a prior', async () => {
  const app = await loadApp();
  app.events = [ev(app, 'g', { type: 'normal', mu: 1110, sigma: 15 }, { type: 'normal', median: 100, sd: 20 })];
  const logs = {}; for (let i = 1; i <= 20; i++) logs['g|' + app.addDays('2026-09-01', i)] = { a: 1140, d: 1250 };
  app.logs = logs; app.learnAll();
  const L = app.learned.g;
  assert.equal(L.nA, 20); near(L.mu, (3 * 1110 + 20 * 1140) / 23, 1e-9, 'shrunk mean'); near(L.median, 110, 3, 'learned duration');
});

test('.ics import: weekly rule with a skipped date, one-off with DURATION, all-day skipped', async () => {
  const app = await loadApp();
  app.events = [];
  const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:s1', 'SUMMARY:Seminar', 'DTSTART:20261020T160000', 'DTEND:20261020T170000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'EXDATE:20261022T160000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:s2', 'SUMMARY:Dentist', 'DTSTART:20261027T150000', 'DURATION:PT45M', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:s3', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20261026', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  app.importICS(ics, 'test.ics');
  const sem = app.events.find(e => e.name === 'Seminar'), den = app.events.find(e => e.name === 'Dentist');
  assert.deepEqual(sem.days, [1, 3]); assert.deepEqual(sem.skip, ['2026-10-22']); assert.equal(sem.start.mu, 960); assert.equal(sem.dur.median, 60);
  assert.equal(den.date, '2026-10-27'); assert.equal(den.start.mu, 900); assert.equal(den.dur.median, 45);
  assert.ok(!app.events.some(e => e.name === 'Holiday'));
});

test('calendar.json leaves out private events and round-trips', async () => {
  const app = await loadApp();
  app.events = app.SAMPLE().map(app.norm); app.events[0].private = true;
  const j = JSON.parse(app.calendarJSON());
  assert.equal(j.events.length, app.events.length - 1);
  assert.deepEqual(j.events.map(app.norm), app.events.slice(1));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGet, handlePost, runFromPayload, createServer } from '../src/api.js';

const parse = (r) => JSON.parse(r.body.toString('utf8'));

test('schedule endpoint default', async () => {
  const r = await handleGet('/api/schedule');
  const d = parse(r);
  assert.equal(r.status, 200);
  assert.equal(r.type, 'application/json');
  assert.deepEqual(d.machines, ['M1', 'M2', 'M3']);
  assert.equal(d.slots.length, 24);
  assert.equal(d.metrics.jobs, 24);
});

test('schedule endpoint params and determinism', async () => {
  const a = await handleGet('/api/schedule?n=10&machines=2&seed=9');
  const b = await handleGet('/api/schedule?n=10&machines=2&seed=9');
  assert.deepEqual(a.body, b.body);
  assert.equal(parse(a).slots.length, 10);
});

for (const q of ['n=abc', 'n=501', 'machines=0', 'machines=33', 'seed=-1']) {
  test(`bad query ${q} returns 400`, async () => {
    const r = await handleGet('/api/schedule?' + q);
    assert.equal(r.status, 400);
    assert.ok(parse(r).error);
  });
}

test('jobs and health endpoints', async () => {
  assert.equal(parse(await handleGet('/api/jobs?n=5')).jobs.length, 5);
  assert.deepEqual(parse(await handleGet('/api/health')), { ok: true });
});

test('unknown path 404 and index served', async () => {
  assert.equal((await handleGet('/nope')).status, 404);
  const r = await handleGet('/');
  assert.equal(r.status, 200);
  assert.ok(r.type.startsWith('text/html'));
  assert.ok(r.body.toString('utf8').includes('Resource Scheduler'));
});

test('runFromPayload orders by priority', () => {
  const out = runFromPayload({
    machines: 1,
    jobs: [{ id: 'a', duration: 3, priority: 1 }, { id: 'b', duration: 2, priority: 0 }],
  });
  assert.deepEqual(out.slots.map((s) => s.job_id), ['b', 'a']);
});

const rejects = [
  ['null', null],
  ['empty object', {}],
  ['jobs not a list', { jobs: 'x' }],
  ['job not an object', { jobs: [1] }],
  ['missing duration', { jobs: [{ id: 'a' }] }],
  ['zero duration', { jobs: [{ id: 'a', duration: 0 }] }],
  ['machines 0', { jobs: [], machines: 0 }],
  ['machines boolean', { jobs: [], machines: true }],
];
for (const [name, payload] of rejects) {
  test(`runFromPayload rejects: ${name}`, () => {
    assert.throws(() => runFromPayload(payload), Error);
  });
}

test('handlePost returns 400 for bad JSON and 404 for other paths', () => {
  assert.equal(handlePost('/api/schedule', 'not json').status, 400);
  assert.equal(handlePost('/api/other', '{}').status, 404);
  assert.equal(handlePost('/api/schedule', '{"jobs":[{"id":"a","duration":2}],"machines":2}').status, 200);
});

test('live server round trip', async () => {
  const srv = createServer();
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    let r = await fetch(base + '/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ machines: 2, jobs: [{ id: 'a', duration: 2 }] }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).metrics.makespan, 2);
    r = await fetch(base + '/api/schedule', { method: 'POST', body: 'not json' });
    assert.equal(r.status, 400);
    await r.arrayBuffer();
    r = await fetch(base + '/api/health');
    assert.equal(r.status, 200);
    await r.arrayBuffer();
    r = await fetch(base + '/api/health', { method: 'DELETE' });
    assert.equal(r.status, 405);
    await r.arrayBuffer();
  } finally {
    srv.closeAllConnections();
    await new Promise((res) => srv.close(res));
  }
});

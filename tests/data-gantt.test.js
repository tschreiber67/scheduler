import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateJobs, makeMachines, rng } from '../src/data.js';
import { schedule } from '../src/scheduler.js';
import { renderAscii } from '../src/gantt.js';
import { Heap } from '../src/heap.js';

test('generator is seeded', () => {
  assert.deepEqual(generateJobs(10, 1), generateJobs(10, 1));
  assert.notDeepEqual(generateJobs(10, 1), generateJobs(10, 2));
});

test('rng sequence is fixed (cross-platform determinism)', () => {
  const r = rng(1);
  const a = [r(), r(), r()];
  const r2 = rng(1);
  assert.deepEqual(a, [r2(), r2(), r2()]);
  assert.ok(a.every((x) => x >= 0 && x < 1));
});

test('generator ranges', () => {
  const jobs = generateJobs(100, 4, 30);
  assert.equal(new Set(jobs.map((j) => j.id)).size, 100);
  assert.ok(jobs.every((j) => j.duration >= 2 && j.duration <= 12 && j.priority >= 0 && j.priority <= 4));
  assert.ok(jobs.every((j) => j.arrival >= 0 && j.arrival <= 30));
});

test('bad generator and machine args', () => {
  assert.throws(() => makeMachines(0), Error);
  assert.throws(() => generateJobs(-1), Error);
});

test('ascii gantt rows and width', () => {
  const lines = renderAscii(schedule(generateJobs(12, 1), makeMachines(3))).split('\n');
  const rows = lines.filter((l) => l.startsWith('M'));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.length === rows[0].length));
  assert.ok(lines.at(-1).startsWith('legend:'));
});

test('ascii gantt cells match the schedule', () => {
  const s = schedule(generateJobs(5, 2), makeMachines(1));
  const row = renderAscii(s).split('\n').find((l) => l.startsWith('M1')).slice(5);
  const busy = s.slots.reduce((a, x) => a + x.end - x.start, 0);
  assert.equal(row.length, s.makespan);
  assert.equal(row.length - [...row].filter((c) => c === '.').length, busy);
});

test('ascii gantt empty', () => {
  assert.equal(renderAscii(schedule([], makeMachines(1))), '(empty schedule)');
});

test('ascii gantt compresses a long timeline', () => {
  const s = schedule(generateJobs(400, 1, 500), makeMachines(1));
  const row = renderAscii(s, 100).split('\n').find((l) => l.startsWith('M1')).slice(5);
  assert.ok(row.length <= 100);
});

test('heap pops in order', () => {
  const h = new Heap((a, b) => a - b);
  [5, 1, 4, 1, 9, 2, 6].forEach((x) => h.push(x));
  const out = [];
  while (h.size) out.push(h.pop());
  assert.deepEqual(out, [1, 1, 2, 4, 5, 6, 9]);
  assert.equal(h.pop(), undefined);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeJob, makeMachine } from '../src/models.js';
import { generateJobs, makeMachines } from '../src/data.js';
import { schedule } from '../src/scheduler.js';

const J = (id, duration, priority = 2, arrival = 0) => makeJob({ id, duration, priority, arrival });
const byId = (s) => Object.fromEntries(s.slots.map((x) => [x.jobId, x]));
const startOrder = (s) => [...s.slots].sort((a, b) => a.start - b.start).map((x) => x.jobId);

test('single machine runs by priority when all arrive together', () => {
  const s = schedule([J('a', 3, 3), J('b', 2, 0), J('c', 4, 1)], [makeMachine('M1')]);
  assert.deepEqual(startOrder(s), ['b', 'c', 'a']);
  assert.equal(s.makespan, 9);
});

test('FIFO within the same priority', () => {
  const s = schedule([J('late', 2, 1, 1), J('early', 2, 1, 0), J('blk', 5, 1, 0)], [makeMachine('M1')]);
  assert.deepEqual(startOrder(s), ['early', 'blk', 'late']);
});

test('ties break on input order', () => {
  const d = byId(schedule([J('x', 1, 2), J('y', 1, 2)], [makeMachine('M1')]));
  assert.equal(d.x.start, 0);
  assert.equal(d.y.start, 1);
});

test('non-preemptive: a running job is not interrupted', () => {
  const d = byId(schedule([J('low', 10, 4, 0), J('urgent', 1, 0, 1)], [makeMachine('M1')]));
  assert.deepEqual([d.low.start, d.low.end], [0, 10]);
  assert.equal(d.urgent.start, 10);
});

test('idle until the next arrival', () => {
  const s = schedule([J('a', 2, 2, 5)], [makeMachine('M1')]);
  assert.deepEqual([s.slots[0].start, s.slots[0].end], [5, 7]);
  assert.equal(s.slots[0].start - s.slots[0].arrival, 0);
});

test('two machines share the load', () => {
  const s = schedule([0, 1, 2, 3].map((i) => J(`j${i}`, 4, 2)), makeMachines(2));
  assert.equal(s.makespan, 8);
  assert.deepEqual(s.metrics().utilization, { M1: 1, M2: 1 });
});

test('no overlap on any machine and no start before arrival', () => {
  const s = schedule(generateJobs(60, 7), makeMachines(4));
  assert.equal(s.slots.length, 60);
  for (const list of s.byMachine().values()) {
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].end <= list[i].start);
  }
  for (const x of s.slots) assert.ok(x.start >= x.arrival && x.end > x.start);
});

test('dispatch clock is monotonic across machines (regression)', () => {
  // M2 frees at 0 but the only job arrives at 9; M1 must not start the next job before its arrival.
  const jobs = [J('a', 2, 2, 0), J('b', 2, 2, 9), J('c', 2, 2, 10)];
  const s = schedule(jobs, makeMachines(2));
  for (const x of s.slots) assert.ok(x.start >= x.arrival);
  const sorted = [...s.slots].sort((p, q) => p.start - q.start);
  assert.deepEqual(sorted.map((x) => x.jobId), ['a', 'b', 'c']);
});

test('every job is scheduled exactly once with its full duration', () => {
  const jobs = generateJobs(40, 3);
  const s = schedule(jobs, makeMachines(3));
  const dur = Object.fromEntries(jobs.map((j) => [j.id, j.duration]));
  assert.deepEqual(s.slots.map((x) => x.jobId).sort(), Object.keys(dur).sort());
  assert.ok(s.slots.every((x) => x.end - x.start === dur[x.jobId]));
});

test('priority respected at dispatch time', () => {
  const s = schedule(generateJobs(50, 11), makeMachines(2));
  for (const x of s.slots) {
    for (const y of s.slots) {
      if (y.priority < x.priority && y.arrival <= x.start) assert.ok(y.start <= x.start);
    }
  }
});

test('deterministic', () => {
  const a = schedule(generateJobs(30, 5), makeMachines(3)).toJSON();
  const b = schedule(generateJobs(30, 5), makeMachines(3)).toJSON();
  assert.deepEqual(a, b);
});

test('metrics values', () => {
  let m = schedule([J('a', 4, 0), J('b', 2, 4, 4)], [makeMachine('M1')]).metrics();
  assert.equal(m.makespan, 6);
  assert.equal(m.avg_wait, 0);
  assert.equal(m.max_wait, 0);
  m = schedule([J('a', 4, 0), J('b', 2, 4, 1)], [makeMachine('M1')]).metrics();
  assert.equal(m.makespan, 6);
  assert.equal(m.avg_wait, 1.5);
  assert.equal(m.max_wait, 3);
  assert.deepEqual(m.avg_wait_by_priority, { 0: 0, 4: 3 });
  assert.deepEqual(m.utilization, { M1: 1 });
});

test('empty jobs', () => {
  const s = schedule([], makeMachines(2));
  assert.equal(s.makespan, 0);
  assert.equal(s.metrics().jobs, 0);
});

const bad = [
  ['zero duration', J('a', 0)],
  ['negative duration', J('a', -1)],
  ['fractional duration', J('a', 1.5)],
  ['priority 5', J('a', 1, 5)],
  ['priority -1', J('a', 1, -1)],
  ['negative arrival', J('a', 1, 2, -1)],
  ['empty id', J('', 1)],
];
for (const [name, job] of bad) {
  test(`invalid job rejected: ${name}`, () => {
    assert.throws(() => schedule([job], makeMachines(1)), Error);
  });
}

test('duplicate ids and bad machines rejected', () => {
  assert.throws(() => schedule([J('a', 1), J('a', 2)], makeMachines(1)), /unique/);
  assert.throws(() => schedule([J('a', 1)], []), /machine/);
  assert.throws(() => schedule([J('a', 1)], [makeMachine('M'), makeMachine('M')]), /unique/);
});

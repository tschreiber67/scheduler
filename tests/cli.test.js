import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.js';

test('demo text output', () => {
  const r = main(['demo', '--jobs', '8', '--machines', '2']);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('makespan='));
  assert.ok(r.out.includes('M1') && r.out.includes('M2'));
});

test('demo json output', () => {
  const r = main(['demo', '--jobs', '8', '--json']);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).metrics.jobs, 8);
});

test('demo bad machines exits 2', () => {
  const r = main(['demo', '--machines', '0']);
  assert.equal(r.code, 2);
  assert.ok(r.err.startsWith('error:'));
});

test('unknown command and unknown flag exit 2', () => {
  assert.equal(main(['nope']).code, 2);
  assert.equal(main(['demo', '--bogus']).code, 2);
});

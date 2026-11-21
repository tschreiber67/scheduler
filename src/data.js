// Deterministic synthetic workload (seeded; no external data).
import { makeJob, makeMachine } from './models.js';

export const KINDS = ['render', 'backup', 'etl', 'train', 'report', 'index', 'export', 'lint'];

// mulberry32: small seeded PRNG, same sequence on every platform.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted(rand, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function generateJobs(n = 24, seed = 1, horizon = 40) {
  if (!Number.isInteger(n) || !Number.isInteger(horizon) || n < 0 || horizon < 0) {
    throw new Error('n and horizon must be non-negative integers');
  }
  const rand = rng(seed);
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const jobs = [];
  for (let i = 0; i < n; i++) {
    jobs.push(
      makeJob({
        id: `J${String(i + 1).padStart(3, '0')}`,
        name: KINDS[int(0, KINDS.length - 1)],
        duration: int(2, 12),
        priority: weighted(rand, [1, 2, 4, 3, 2]),
        arrival: int(0, horizon),
      }),
    );
  }
  return jobs;
}

export function makeMachines(count = 3) {
  if (!Number.isInteger(count) || count < 1) throw new Error('machine count must be an integer >= 1');
  return Array.from({ length: count }, (_, i) => makeMachine(`M${i + 1}`));
}

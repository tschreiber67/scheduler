// Job, Machine, Schedule. Plain objects; validation is explicit.

export const MIN_PRIORITY = 0; // most urgent
export const MAX_PRIORITY = 4; // least urgent

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

export function makeJob({ id, duration, priority = 2, arrival = 0, name = '' }) {
  return { id, duration, priority, arrival, name };
}

export function makeMachine(id) {
  return { id };
}

export function validateJob(j) {
  if (typeof j.id !== 'string' || j.id === '') throw new Error('job id must be a non-empty string');
  if (!isInt(j.duration) || j.duration <= 0) throw new Error(`job ${j.id}: duration must be a positive integer`);
  if (!isInt(j.priority) || j.priority < MIN_PRIORITY || j.priority > MAX_PRIORITY) {
    throw new Error(`job ${j.id}: priority must be ${MIN_PRIORITY}..${MAX_PRIORITY}`);
  }
  if (!isInt(j.arrival) || j.arrival < 0) throw new Error(`job ${j.id}: arrival must be a non-negative integer`);
}

const round = (x, d) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

export class Schedule {
  constructor(machines = []) {
    this.slots = []; // {jobId, machineId, start, end, priority, arrival}
    this.machines = machines;
  }

  get makespan() {
    return this.slots.reduce((m, s) => Math.max(m, s.end), 0);
  }

  byMachine() {
    const out = new Map(this.machines.map((m) => [m.id, []]));
    for (const s of this.slots) out.get(s.machineId).push(s);
    for (const list of out.values()) list.sort((a, b) => a.start - b.start);
    return out;
  }

  metrics() {
    const n = this.slots.length;
    const span = this.makespan;
    const waits = this.slots.map((s) => s.start - s.arrival);
    const perPrio = new Map();
    for (const s of this.slots) {
      if (!perPrio.has(s.priority)) perPrio.set(s.priority, []);
      perPrio.get(s.priority).push(s.start - s.arrival);
    }
    const avgByPriority = {};
    for (const p of [...perPrio.keys()].sort((a, b) => a - b)) {
      const w = perPrio.get(p);
      avgByPriority[String(p)] = round(w.reduce((a, b) => a + b, 0) / w.length, 3);
    }
    const utilization = {};
    for (const [mid, list] of this.byMachine()) {
      const busy = list.reduce((a, s) => a + (s.end - s.start), 0);
      utilization[mid] = span ? round(busy / span, 4) : 0;
    }
    return {
      jobs: n,
      makespan: span,
      avg_wait: n ? round(waits.reduce((a, b) => a + b, 0) / n, 3) : 0,
      max_wait: waits.reduce((m, w) => Math.max(m, w), 0),
      avg_wait_by_priority: avgByPriority,
      utilization,
    };
  }

  toJSON() {
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const slots = [...this.slots]
      .sort((a, b) => a.start - b.start || cmp(a.machineId, b.machineId))
      .map((s) => ({
        job_id: s.jobId,
        machine: s.machineId,
        start: s.start,
        end: s.end,
        priority: s.priority,
        arrival: s.arrival,
        wait: s.start - s.arrival,
      }));
    return { machines: this.machines.map((m) => m.id), slots, metrics: this.metrics() };
  }
}

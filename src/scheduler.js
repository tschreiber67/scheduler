// Non-preemptive priority list scheduling on identical machines.
//
// Event loop: take the machine that frees up first, admit every job that has
// arrived by then into a binary heap keyed (priority, arrival, input order),
// and start the best job. If the heap is empty the machine idles until the
// next arrival. Deterministic: ties break on arrival, then input order, then
// machine order.
import { Heap } from './heap.js';
import { Schedule, validateJob } from './models.js';

export function schedule(jobs, machines) {
  jobs = [...jobs];
  machines = [...machines];
  if (machines.length === 0) throw new Error('at least one machine is required');
  if (new Set(machines.map((m) => m.id)).size !== machines.length) throw new Error('machine ids must be unique');
  if (new Set(jobs.map((j) => j.id)).size !== jobs.length) throw new Error('job ids must be unique');
  jobs.forEach(validateJob);

  const order = new Map(jobs.map((j, i) => [j.id, i]));
  const incoming = [...jobs].sort((a, b) => a.arrival - b.arrival || order.get(a.id) - order.get(b.id));
  const free = new Heap((a, b) => a[0] - b[0] || a[1] - b[1]); // [freeTime, machineIndex]
  machines.forEach((_, i) => free.push([0, i]));
  const queue = new Heap(
    (a, b) => a.job.priority - b.job.priority || a.job.arrival - b.job.arrival || a.order - b.order,
  );
  const result = new Schedule(machines);
  let nxt = 0;
  let clock = 0; // time of the latest dispatch; dispatch times never go backwards

  const admit = (upto) => {
    while (nxt < incoming.length && incoming[nxt].arrival <= upto) {
      const job = incoming[nxt];
      queue.push({ job, order: order.get(job.id) });
      nxt += 1;
    }
  };

  while (nxt < incoming.length || queue.size > 0) {
    const [freeAt, mi] = free.pop();
    let t = Math.max(freeAt, clock);
    admit(t);
    if (queue.size === 0) {
      // idle until the next arrival
      t = incoming[nxt].arrival;
      admit(t);
    }
    clock = t;
    const { job } = queue.pop();
    const end = t + job.duration;
    result.slots.push({
      jobId: job.id,
      machineId: machines[mi].id,
      start: t,
      end,
      priority: job.priority,
      arrival: job.arrival,
    });
    free.push([end, mi]);
  }
  return result;
}

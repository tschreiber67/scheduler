// Text Gantt chart: one row per machine, one column per time unit.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function renderAscii(sched, maxWidth = 200) {
  const span = sched.makespan;
  if (span === 0) return '(empty schedule)';
  const scale = Math.max(1, Math.ceil(span / maxWidth)); // compress long timelines
  const cols = Math.ceil(span / scale);
  const ids = [...new Set(sched.slots.map((s) => s.jobId))].sort();
  const glyph = new Map(ids.map((id, i) => [id, GLYPHS[i % GLYPHS.length]]));
  const lines = [];
  let ruler = '';
  for (let c = 0; c < cols; c++) {
    ruler += (c * scale) % 10 === 0 ? String(Math.floor((c * scale) / 10) % 10) : ' ';
  }
  lines.push(`     ${ruler}   (1 col = ${scale} unit${scale > 1 ? 's' : ''}, tens digit marks)`);
  for (const [mid, slots] of sched.byMachine()) {
    const row = Array(cols).fill('.');
    for (const s of slots) {
      for (let c = Math.floor(s.start / scale); c < Math.ceil(s.end / scale); c++) row[c] = glyph.get(s.jobId);
    }
    lines.push(`${mid.padEnd(4)} ${row.join('')}`);
  }
  lines.push('');
  lines.push('legend: ' + ids.map((j) => `${glyph.get(j)}=${j}`).join(' '));
  return lines.join('\n');
}

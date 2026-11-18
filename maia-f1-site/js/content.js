// Copy comes from the team's engineering portfolio. Edit here, not in the markup.

export const ROSTER = [
  { role: 'Team principal', focus: 'Championship readiness, budget and partner deliverables.' },
  { role: 'Chief aerodynamicist', focus: 'Downforce, drag and the front and rear wing packages.' },
  { role: 'Lead design & manufacturing', focus: 'Chassis geometry, regulation compliance and the build.' },
  { role: 'Race driver', focus: 'Run data, setup feedback and the race-day plan.' },
];

// Illustrative series only. Replace with real run logs before publishing.
function wave(n, { base, amp, cycles, phase = 0, decay = 0 }) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return base + amp * Math.sin(2 * Math.PI * cycles * t + phase) * (1 - decay * t);
  });
}

export const TELEMETRY = {
  width: 640,
  height: 260,
  series: [
    { key: 'speed', label: 'Sector speed', colour: '#d8b66b', values: wave(120, { base: 0.55, amp: 0.3, cycles: 2.2, phase: 0.4 }) },
    { key: 'downforce', label: 'Downforce', colour: '#2fbf7a', values: wave(120, { base: 0.5, amp: 0.22, cycles: 1.4, phase: 1.9 }) },
    { key: 'tyre', label: 'Tyre degradation', colour: '#e9ecf1', dashed: true, values: wave(120, { base: 0.25, amp: 0.1, cycles: 0.9, phase: 0.7, decay: 0.2 }) },
  ],
};

/** SVG path data for one series inside the telemetry viewbox. */
export function tracePath(values, width, height, pad = 16) {
  const step = (width - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = (pad + i * step).toFixed(1);
      const y = (pad + (1 - v) * (height - pad * 2)).toFixed(1);
      return `${i ? 'L' : 'M'}${x} ${y}`;
    })
    .join(' ');
}

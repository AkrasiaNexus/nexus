// Generative sound for the landing story: no audio files. Off until the visitor turns it on.
// A soft two-note pad that breathes, plus a quiet chime from a pentatonic scale on each new chapter.
const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // G4 pentatonic, one note per chapter

export type Ambient = { start: () => Promise<void>; stop: () => void; chime: (chapter: number) => void; readonly on: boolean };

export function createAmbient(): Ambient {
  let ctx: AudioContext | null = null, master: GainNode | null = null, nodes: AudioScheduledSourceNode[] = [], on = false;

  const start = async () => {
    ctx ??= new AudioContext();
    await ctx.resume();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    filter.connect(master);
    // The pad: G2 + D3, slightly detuned, through a filter whose cutoff slowly breathes.
    for (const [f, detune] of [[98, -4], [146.83, 5], [196, 0]] as const) {
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f; o.detune.value = detune;
      const g = ctx.createGain(); g.gain.value = 0.33;
      o.connect(g).connect(filter); o.start(); nodes.push(o);
    }
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.07; depth.gain.value = 260;
    lfo.connect(depth).connect(filter.frequency); lfo.start(); nodes.push(lfo);
    master.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5); // fade in, never sudden
    on = true;
  };

  const stop = () => {
    if (!ctx || !master) return;
    const m = master, playing = nodes;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => { playing.forEach((n) => n.stop()); m.disconnect(); }, 1500);
    nodes = []; master = null; on = false;
  };

  const chime = (chapter: number) => {
    if (!on || !ctx || !master) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = SCALE[Math.max(0, Math.min(SCALE.length - 1, chapter))];
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 2.3);
  };

  return { start, stop, chime, get on() { return on; } };
}

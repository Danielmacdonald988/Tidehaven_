import type { VehicleState } from "./contracts";
/** Original bounded synthesis: two engine harmonics, filtered tire noise and one reusable impact voice. */
export class DriveSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: GainNode | null = null;
  private tire: GainNode | null = null;
  private hit: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private muted = true;
  private volume = 0.45;
  private lastImpact = 0;
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(ctx.destination);
      this.master = master;
      const engine = ctx.createGain();
      engine.gain.value = 0;
      engine.connect(master);
      this.engine = engine;
      for (const f of [1, 2.01]) {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = 45 * f;
        g.gain.value = f === 1 ? 0.65 : 0.2;
        o.connect(g).connect(engine);
        o.start();
        this.oscillators.push(o);
      }
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
        data = buffer.getChannelData(0);
      let seed = 839;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
      for (const [cutoff, key] of [
        [850, "tire"],
        [160, "hit"],
      ] as const) {
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = cutoff;
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(master);
        source.start();
        this.sources.push(source);
        if (key === "tire") this.tire = gain;
        else this.hit = gain;
      }
    } catch {
      /* Audio unavailable: movement remains fully usable. */
    }
  }
  set(muted: boolean, volume: number) {
    this.muted = muted;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.08,
      );
  }
  update(v: VehicleState, _dt: number) {
    const c = this.ctx;
    if (!c) return;
    const speed = Math.abs(v.speed),
      t = c.currentTime;
    this.engine?.gain.setTargetAtTime(
      v.occupied ? 0.035 + speed * 0.004 : 0,
      t,
      0.12,
    );
    this.oscillators.forEach((o, i) =>
      o.frequency.setTargetAtTime((43 + speed * 9) * (i ? 2.01 : 1), t, 0.09),
    );
    this.tire?.gain.setTargetAtTime(
      v.occupied
        ? Math.min(0.06, speed * 0.002 + Math.abs(v.steer) * speed * 0.002)
        : 0,
      t,
      0.12,
    );
    if (v.impact > this.lastImpact + 0.08 && this.hit) {
      this.hit.gain.cancelScheduledValues(t);
      this.hit.gain.setValueAtTime(v.impact * 0.3, t);
      this.hit.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    }
    this.lastImpact = v.impact;
  }
  dispose() {
    this.oscillators.forEach((o) => o.stop());
    this.sources.forEach((o) => o.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.oscillators = [];
    this.sources = [];
  }
}

/** Quiet procedural coastal ambience. No playback or AudioContext until an explicit unmute gesture. */
export class CoastalAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private wind?: GainNode;
  private surf?: GainNode;
  private filter?: BiquadFilterNode;
  private surfPan?: StereoPannerNode;
  private sources: AudioBufferSourceNode[] = [];
  private volume = 0.35;
  private muted = true;
  private elapsed = 0;
  private stride = 0;
  setVolume(v: number) {
    this.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35;
    this.applyVolume();
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (!m && !this.context) this.initialize();
    if (!m && this.context) void this.context.resume().catch(() => {});
    this.applyVolume();
  }
  private applyVolume() {
    if (this.output && this.context)
      this.output.gain.setTargetAtTime(
        this.muted ? 0 : this.volume * 0.24,
        this.context.currentTime,
        0.12,
      );
  }
  private initialize() {
    if (typeof AudioContext === "undefined") return;
    try {
      const context = (this.context = new AudioContext());
      const output = (this.output = context.createGain());
      output.gain.value = 0;
      output.connect(context.destination);
      const buffer = context.createBuffer(
          1,
          context.sampleRate * 4,
          context.sampleRate,
        ),
        data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.035) / 1.035;
        data[i] = previous * 3.5;
      }
      const windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const filter = (this.filter = context.createBiquadFilter());
      filter.type = "lowpass";
      filter.frequency.value = 450;
      const wind = (this.wind = context.createGain());
      wind.gain.value = 0.38;
      windSource.connect(filter);
      filter.connect(wind);
      wind.connect(output);
      windSource.start();
      this.sources.push(windSource);
      const surfSource = context.createBufferSource();
      surfSource.buffer = buffer;
      surfSource.loop = true;
      surfSource.playbackRate.value = 0.7;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 680;
      band.Q.value = 0.5;
      const surf = (this.surf = context.createGain());
      surf.gain.value = 0.3;
      surfSource.connect(band);
      band.connect(surf);
      const pan = (this.surfPan = context.createStereoPanner());
      surf.connect(pan);
      pan.connect(output);
      surfSource.start(0, 1.2);
      this.sources.push(surfSource);
    } catch {
      this.context = undefined;
    }
  }
  update(
    dt: number,
    walking: boolean,
    storm: number,
    position?: { x: number; z: number },
    indoors = false,
  ) {
    const bounded = Math.max(0, Math.min(0.1, dt));
    this.elapsed += bounded;
    const c = this.context;
    if (!c || this.muted || c.state !== "running") return;
    const intensity = Math.max(0, Math.min(1, storm));
    const shelter = indoors ? 0.28 : 1;
    const coast = position
      ? Math.max(0.12, 1 - Math.abs(33 - position.z) / 65)
      : 0.65;
    this.surfPan?.pan.setTargetAtTime(
      position ? Math.max(-0.65, Math.min(0.65, (5 - position.x) / 45)) : 0,
      c.currentTime,
      0.5,
    );
    this.wind?.gain.setTargetAtTime(
      (0.2 + intensity * 0.8) * shelter,
      c.currentTime,
      0.7,
    );
    this.filter?.frequency.setTargetAtTime(
      380 + intensity * 900,
      c.currentTime,
      0.7,
    );
    this.surf?.gain.setTargetAtTime(
      (0.22 + (Math.sin(this.elapsed * 0.37) + 1) * 0.16 + intensity * 0.13) *
        coast *
        shelter,
      c.currentTime,
      0.3,
    );
    if (walking) {
      this.stride += bounded;
      if (this.stride >= 0.46) {
        this.stride %= 0.46;
        this.footstep();
      }
    } else this.stride = 0.3;
  }
  private footstep() {
    const c = this.context;
    if (!c || !this.output) return;
    const oscillator = c.createOscillator(),
      gain = c.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(105, c.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.17, c.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.13);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start();
    oscillator.stop(c.currentTime + 0.15);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    this.sources = [];
    this.output?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.output = undefined;
  }
}

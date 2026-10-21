import type { RescueState } from "./engine";
import type { Point } from "../three/shared";

/** Gesture-started procedural spatial soundtrack. No remote audio or autoplay. */
export class RescueSound {
  private context?: AudioContext;
  private output?: GainNode;
  private noise?: AudioBuffer;
  private wind?: GainNode;
  private rain?: GainNode;
  private filter?: BiquadFilterNode;
  private surfPan?: StereoPannerNode;
  private loops: AudioBufferSourceNode[] = [];
  private muted = true;
  private volume = 0.45;
  private elapsed = 0;
  private distance = 0;
  private previous?: {
    player: Point;
    power: boolean;
    collapse: number;
    phase: string;
    elapsed: number;
  };
  private lastCue = 0;
  private utterance?: SpeechSynthesisUtterance;
  set(muted: boolean, volume: number) {
    if (muted || volume !== this.volume) this.cancelVoice();
    this.muted = muted;
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0.45;
    if (this.context && this.output)
      this.output.gain.setTargetAtTime(
        muted ? 0 : this.volume * 0.45,
        this.context.currentTime,
        0.07,
      );
  }
  unlock() {
    if (this.context) {
      void this.context.resume().catch(() => {});
      return;
    }
    if (typeof AudioContext === "undefined") return;
    try {
      const c = (this.context = new AudioContext()),
        out = (this.output = c.createGain());
      out.gain.value = this.muted ? 0 : this.volume * 0.45;
      out.connect(c.destination);
      const noise = (this.noise = c.createBuffer(
          1,
          c.sampleRate * 4,
          c.sampleRate,
        )),
        data = noise.getChannelData(0);
      let seed = 82736,
        previous = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        previous = (previous + ((seed / 4294967296) * 2 - 1) * 0.12) / 1.12;
        data[i] = previous * 2.8;
      }
      const layer = (
        type: BiquadFilterType,
        hz: number,
        gain: number,
        rate: number,
      ) => {
        const source = c.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        source.playbackRate.value = rate;
        const filter = c.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = hz;
        filter.Q.value = 0.6;
        const amp = c.createGain();
        amp.gain.value = gain;
        source.connect(filter);
        filter.connect(amp);
        amp.connect(out);
        source.start();
        this.loops.push(source);
        return { amp, filter };
      };
      const wind = layer("lowpass", 700, 0.5, 0.7);
      this.wind = wind.amp;
      this.filter = wind.filter;
      this.rain = layer("highpass", 1900, 0.23, 1.4).amp;
      const surf = layer("bandpass", 350, 0.24, 0.45);
      surf.amp.disconnect();
      this.surfPan = c.createStereoPanner();
      surf.amp.connect(this.surfPan);
      this.surfPan.connect(out);
      void c.resume().catch(() => {});
    } catch {
      this.context = undefined;
    }
  }
  private cancelVoice() {
    if (!this.utterance) return;
    this.utterance = undefined;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
  /** Two authored emergency cues, optionally spoken by a local OS voice. Not model audio. */
  private speak(text: string) {
    if (
      this.muted ||
      this.volume <= 0 ||
      typeof speechSynthesis === "undefined" ||
      typeof SpeechSynthesisUtterance === "undefined"
    )
      return;
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.localService && v.lang.startsWith("en"));
    if (!voice) return; // The spatial radio cue remains available without an installed voice.
    this.cancelVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.volume = this.volume;
    utterance.rate = 1.08;
    utterance.pitch = 0.9;
    const finish = () => {
      if (this.utterance === utterance) this.utterance = undefined;
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    this.utterance = utterance;
    try {
      speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  }
  private burst(
    position: Point,
    listener: Point,
    duration: number,
    frequency: number,
    level: number,
  ) {
    const c = this.context,
      out = this.output;
    if (!c || !out || !this.noise || this.muted) return;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      pan = c.createStereoPanner();
    source.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    const distance = Math.hypot(
      position.x - listener.x,
      position.z - listener.z,
    );
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(
      level / (1 + distance * 0.025),
      c.currentTime + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    pan.pan.value = Math.max(
      -0.85,
      Math.min(0.85, (position.x - listener.x) / 24),
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(out);
    source.start();
    source.stop(c.currentTime + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
  }
  private tone(
    position: Point,
    listener: Point,
    hz: number,
    duration: number,
    level: number,
  ) {
    const c = this.context,
      out = this.output;
    if (!c || !out || this.muted) return;
    const source = c.createOscillator(),
      gain = c.createGain(),
      pan = c.createStereoPanner();
    source.type = "sine";
    source.frequency.setValueAtTime(hz, c.currentTime);
    source.frequency.exponentialRampToValueAtTime(
      hz * 0.65,
      c.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(level, c.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    pan.pan.value = Math.max(
      -0.8,
      Math.min(0.8, (position.x - listener.x) / 24),
    );
    source.connect(gain);
    gain.connect(pan);
    pan.connect(out);
    source.start();
    source.stop(c.currentTime + duration);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
  }
  update(state: RescueState, dt: number) {
    const bounded = Math.max(0, Math.min(0.1, dt));
    this.elapsed += bounded;
    const previous = this.previous;
    const recovered = !!previous && state.elapsed < previous.elapsed;
    if (recovered) {
      this.cancelVoice();
      this.distance = 0;
      this.lastCue = this.elapsed;
    }
    this.previous = {
      player: { ...state.player },
      power: state.power,
      collapse: state.collapse,
      phase: state.phase,
      elapsed: state.elapsed,
    };
    const c = this.context;
    if (!c || this.muted || c.state !== "running") return;
    const quiet = state.phase === "aftermath",
      inside =
        (state.player.x < -15 && state.player.z < 14 && state.player.z > 3) ||
        (state.player.x > 20 && state.player.z < 14 && state.player.z > 5);
    const shelter = inside ? 0.28 : 1,
      gust = (Math.sin(this.elapsed * 0.37) + 1) * 0.12;
    this.wind?.gain.setTargetAtTime(
      (quiet ? 0.12 : 0.46 + gust) * shelter,
      c.currentTime,
      0.6,
    );
    this.rain?.gain.setTargetAtTime(
      (quiet ? 0.07 : 0.28) * shelter,
      c.currentTime,
      0.6,
    );
    this.filter?.frequency.setTargetAtTime(
      quiet ? 330 : 550 + gust * 1800,
      c.currentTime,
      0.6,
    );
    this.surfPan?.pan.setTargetAtTime(
      Math.max(-0.7, Math.min(0.7, (5 - state.player.x) / 45)),
      c.currentTime,
      0.4,
    );
    if (previous && !recovered) {
      const distance = Math.hypot(
        state.player.x - previous.player.x,
        state.player.z - previous.player.z,
      );
      if (distance < 2) this.distance += distance;
      if (this.distance > 0.75) {
        this.distance %= 0.75;
        this.tone(state.player, state.player, inside ? 100 : 85, 0.12, 0.19);
        this.burst(
          state.player,
          state.player,
          0.12,
          inside ? 650 : 2200,
          inside ? 0.08 : 0.15,
        );
      }
      if (previous.power && !state.power) {
        this.burst({ x: 15, z: 19 }, state.player, 0.26, 8500, 1.9);
        this.burst({ x: 15, z: 19 }, state.player, 2.4, 140, 1.4);
      }
      if (previous.phase === "blackout" && state.phase === "approach")
        this.speak("Over here! Bay Radio! The front door is blocked.");
      if (previous.collapse <= 0 && state.collapse > 0) {
        this.speak("The awning! Take the side door!");
        this.burst({ x: 24, z: 15 }, state.player, 2.8, 420, 1.8);
        this.burst({ x: 24, z: 15 }, state.player, 0.65, 3700, 1.1);
        this.tone({ x: 24, z: 15 }, state.player, 65, 2, 0.75);
      }
      if (previous.phase !== "aftermath" && quiet)
        this.tone(state.victim, state.player, 330, 2, 0.09);
    }
    // Diegetic failing radio locator. No synthetic voice pretending to be live AI.
    if (
      !quiet &&
      !state.power &&
      !state.rescued &&
      this.elapsed - this.lastCue > 13 &&
      Math.hypot(
        state.player.x - state.victim.x,
        state.player.z - state.victim.z,
      ) < 32
    ) {
      this.lastCue = this.elapsed;
      this.tone(state.victim, state.player, 740, 0.32, 0.09);
    }
  }
  dispose() {
    this.cancelVoice();
    for (const s of this.loops) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    this.loops = [];
    this.output?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}

import { SPECIES, type WildlifeState, type SpeciesId } from "./contracts";
import type { Point } from "../three/shared";

/** Original synthesized animal calls, scored effects and a quiet coastal bed. */
export class WildlifeSound {
  private context?: AudioContext;
  private output?: GainNode;
  private wind?: GainNode;
  private rain?: GainNode;
  private surf?: GainNode;
  private loops: AudioBufferSourceNode[] = [];
  private muted = true;
  private volume = 0.45;
  private last?: WildlifeState;
  private lastCall: Partial<Record<SpeciesId, number>> = {};
  private walked = 0;
  set(muted: boolean, volume: number) {
    this.muted = muted;
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0.45;
    if (this.context && this.output)
      this.output.gain.setTargetAtTime(
        muted ? 0 : this.volume * 0.38,
        this.context.currentTime,
        0.08,
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
      out.gain.value = this.muted ? 0 : this.volume * 0.38;
      out.connect(c.destination);
      const noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate),
        data = noise.getChannelData(0);
      let seed = 61318,
        smoothed = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        smoothed = (smoothed + (seed / 2147483648 - 1) * 0.15) / 1.15;
        data[i] = smoothed * 2.4;
      }
      const layer = (
        type: BiquadFilterType,
        frequency: number,
        rate: number,
      ) => {
        const source = c.createBufferSource(),
          filter = c.createBiquadFilter(),
          gain = c.createGain();
        source.buffer = noise;
        source.loop = true;
        source.playbackRate.value = rate;
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = 0.6;
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        source.start();
        this.loops.push(source);
        return gain;
      };
      this.wind = layer("lowpass", 600, 0.8);
      this.rain = layer("highpass", 2000, 1.3);
      this.surf = layer("bandpass", 240, 0.5);
      void c.resume().catch(() => {});
    } catch {
      this.context = undefined;
    }
  }
  private note(
    position: Point,
    listener: Point,
    hz: number,
    end: number,
    duration: number,
    level: number,
    delay = 0,
    type: OscillatorType = "sine",
  ) {
    const c = this.context,
      out = this.output;
    if (!c || !out || this.muted) return;
    const oscillator = c.createOscillator(),
      amp = c.createGain(),
      pan = c.createStereoPanner();
    const time = c.currentTime + delay,
      distance = Math.hypot(position.x - listener.x, position.z - listener.z);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, end),
      time + duration,
    );
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(
      level / (1 + distance * 0.12),
      time + 0.025,
    );
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    pan.pan.value = Math.max(
      -0.9,
      Math.min(0.9, (position.x - listener.x) / 12),
    );
    oscillator.connect(amp);
    amp.connect(pan);
    pan.connect(out);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      amp.disconnect();
      pan.disconnect();
    };
  }
  private call(id: SpeciesId, position: Point, listener: Point) {
    // Each voice has a distinctive rhythm and interval, not a transposed shared chirp.
    switch (id) {
      case "brindlefin":
        this.note(position, listener, 620, 980, 0.19, 0.23);
        this.note(position, listener, 920, 580, 0.24, 0.18, 0.2);
        break;
      case "cairnback":
        this.note(position, listener, 110, 82, 0.55, 0.28, 0, "triangle");
        this.note(position, listener, 160, 120, 0.3, 0.18, 0.6, "triangle");
        break;
      case "pluvlet":
        [520, 780, 1040].forEach((h, i) =>
          this.note(position, listener, h, h * 0.92, 0.19, 0.15, i * 0.14),
        );
        break;
      case "sailpip":
        [1500, 1800, 1250].forEach((h, i) =>
          this.note(position, listener, h, h * 1.15, 0.13, 0.1, i * 0.23),
        );
        break;
      case "glasswhorl":
        this.note(position, listener, 880, 870, 1.2, 0.12);
        this.note(position, listener, 1318, 1325, 1.3, 0.07, 0.25);
        break;
      case "tempestray":
        [130.81, 196, 261.63, 392].forEach((h, i) =>
          this.note(position, listener, h * 0.7, h, 2.5, 0.13, i * 0.23),
        );
        break;
    }
  }
  update(state: WildlifeState, dt: number) {
    const previous = this.last;
    this.last = state;
    if (previous && state.elapsed < previous.elapsed) {
      this.lastCall = {};
      this.walked = 0;
    }
    const c = this.context;
    if (!c || this.muted || c.state !== "running") return;
    const storm = state.weather === "storm",
      wet = storm || state.weather === "rain";
    this.wind?.gain.setTargetAtTime(storm ? 0.38 : 0.08, c.currentTime, 1.5);
    this.rain?.gain.setTargetAtTime(wet ? 0.17 : 0, c.currentTime, 1.5);
    this.surf?.gain.setTargetAtTime(
      (0.08 + (1 + Math.sin(state.elapsed * 0.4)) * 0.04) *
        Math.max(0.12, Math.min(1, (state.player.z + 5) / 30)),
      c.currentTime,
      0.5,
    );
    if (
      previous &&
      storm &&
      dt > 0 &&
      Math.floor((state.elapsed - 0.85) / 22) >
        Math.floor((previous.elapsed - 0.85) / 22)
    ) {
      // Authored distant thunder follows the regional lightning flash by 850 ms.
      this.note(
        { x: state.player.x + 15, z: state.player.z - 20 },
        state.player,
        48,
        24,
        2.6,
        0.17,
        0,
        "triangle",
      );
      this.note(
        { x: state.player.x + 15, z: state.player.z - 20 },
        state.player,
        67,
        30,
        1.8,
        0.09,
        0.15,
        "triangle",
      );
    }
    if (previous) {
      const distance = Math.hypot(
        state.player.x - previous.player.x,
        state.player.z - previous.player.z,
      );
      if (distance < 2 && dt > 0) this.walked += distance;
      if (this.walked > 0.9) {
        this.walked %= 0.9;
        this.note(
          state.player,
          state.player,
          wet ? 155 : 110,
          65,
          0.1,
          0.08,
          0,
          "triangle",
        );
      }
      if (state.pulse && state.pulse.at !== previous.pulse?.at) {
        this.note(
          state.pulse.from,
          state.player,
          280,
          state.pulse.success ? 680 : 340,
          0.55,
          0.22,
        );
      }
      for (const creature of state.creatures) {
        const old = previous.creatures.find((v) => v.id === creature.id);
        if (creature.bonded && !old?.bonded)
          [392, 493.88, 587.33, 783.99].forEach((h, i) =>
            this.note(
              creature.position,
              state.player,
              h * 0.96,
              h,
              0.65,
              0.2,
              i * 0.13,
            ),
          );
        else if (creature.alarm > 0 && !old?.alarm)
          this.note(creature.position, state.player, 480, 250, 0.25, 0.13);
      }
      if (!previous.rareRevealed && state.rareRevealed) {
        const rare = state.creatures.find((v) => v.id === "tempestray");
        if (rare) this.call("tempestray", rare.position, state.player);
        this.lastCall.tempestray = state.elapsed;
      }
      if (
        Object.values(state.abilities).filter(Boolean).length >
        Object.values(previous.abilities).filter(Boolean).length
      ) {
        this.note(state.player, state.player, 220, 440, 0.9, 0.18);
        this.note(state.player, state.player, 330, 660, 0.9, 0.12, 0.15);
      }
    }
    for (let i = 0; i < SPECIES.length; i++) {
      const creature = state.creatures.find((v) => v.id === SPECIES[i].id);
      if (
        !creature?.available ||
        creature.bonded ||
        Math.hypot(
          creature.position.x - state.player.x,
          creature.position.z - state.player.z,
        ) > 23
      )
        continue;
      if (
        state.elapsed - (this.lastCall[creature.id] ?? -6 - i) >
        10 + i * 2.3
      ) {
        this.call(creature.id, creature.position, state.player);
        this.lastCall[creature.id] = state.elapsed;
      }
    }
  }
  dispose() {
    for (const loop of this.loops) {
      try {
        loop.stop();
      } catch {
        /* stopped */
      }
      loop.disconnect();
    }
    this.loops = [];
    this.output?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}

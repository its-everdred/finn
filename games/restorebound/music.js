// Chiptune music for RestoreBound, synthesized with the Web Audio API so the
// game ships with no audio files. Earthbound-flavoured: syncopated funky bass,
// square and pulse-wave leads, a little swing, and drums made of noise and
// sine sweeps.
//
// Patterns are 16th-note steps. A note is written like "C3" (sharps as "#" or
// "s", flats as "b"); "." is a rest; "-" holds the previous note. Drum lanes
// use x (hit), X (accent), s (soft), o (open hat). Chord and arp lanes take
// stacked notes like "C4E4G4". A lane shorter than the track loops under it,
// so a 1-bar drum pattern can sit under an 8-bar melody. Tracks loop until
// another one is requested; play() crossfades between them.
//
// API: music.play(name), stop(), toggleMute(), unlock(), debug(), sfx(kind),
//      duck(seconds). Unknown track names and sfx kinds are ignored.

window.music = (() => {
  let ctx = null, master = null, muted = false, current = null, timer = null;
  let duckGain = null, sfxBus = null, trackGain = null, pending = null, out = null;
  let nextTime = 0, step = 0, arp = null;
  const LOOKAHEAD = 0.12, TICK = 25, FADE = 0.15;

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])(#|s|b)?(\d)$/.exec(name);
    if (!m) return null;
    return 12 * (parseInt(m[3], 10) + 1) + NOTE[m[1]] + (m[2] === "#" || m[2] === "s" ? 1 : m[2] === "b" ? -1 : 0);
  }
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const isNote = (c) => !!c && c !== "." && c !== "-";
  const notesOf = (c) => (c.match(/[A-G][#sb]?\d/g) || []).map(midi);

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
      // a touch of compression keeps the drums from clipping the lead
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.disconnect(); master.connect(comp); comp.connect(ctx.destination);
      // music runs through a duck stage (lowered under stings); effects have their own bus
      duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      out = sfxBus;
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------- instruments
  // Every instrument writes to `out`, which the scheduler points at the current
  // track's gain node and sfx() points at the effects bus.
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  }
  const waves = {};
  // a pulse wave of the given duty cycle, as a PeriodicWave (cosine series)
  function pulseWave(duty) {
    if (waves[duty]) return waves[duty];
    const N = 40, real = new Float32Array(N), imag = new Float32Array(N);
    for (let k = 1; k < N; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    waves[duty] = ctx.createPeriodicWave(real, imag);
    return waves[duty];
  }
  function setType(o, type) {
    if (type === "pulse25") o.setPeriodicWave(pulseWave(0.25));
    else if (type === "pulse12") o.setPeriodicWave(pulseWave(0.125));
    else o.type = type;
  }
  function env(g, t, a, peak, d, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }
  // a held note: attack, decay to a sustain level, hold to the end, short release.
  // Voices using it should stop at t + dur + REL.
  const REL = 0.08;
  function envS(g, t, a, peak, dur, sus = 0.4) {
    const level = Math.max(peak * sus, 0.0001), decayEnd = t + a + Math.max(0.01, dur * 0.6 - a);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(level, Math.min(decayEnd, t + dur));
    g.gain.setValueAtTime(level, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + REL * 0.5);
  }
  function kick(t, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    env(g, t, 0.002, 0.9 * v, 0.22);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
  }
  function snare(t, v = 1) {
    const n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.8;
    env(g, t, 0.001, 0.5 * v, 0.16);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.2);
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    env(g2, t, 0.001, 0.35 * v, 0.09);
    o.connect(g2); g2.connect(out); o.start(t); o.stop(t + 0.12);
  }
  function hat(t, open = false, v = 1) {
    const n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = "highpass"; hp.frequency.value = 7500;
    env(g, t, 0.001, 0.22 * v, open ? 0.18 : 0.045);
    n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.25);
  }
  // kinds: funk (saw + sub, snappy filter), soft (sine, for quiet scenes), wobble (LFO filter, for the boss)
  function bass(t, n, dur, v = 1, kind = "funk", spb = 0.13) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    const stop = t + dur + REL;
    if (kind === "soft") {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = hz(n); o2.type = "triangle"; o2.frequency.value = hz(n);
      lp.frequency.value = 420; envS(g, t, 0.03, 0.4 * v, dur, 0.55);
      o.connect(lp); o2.connect(lp); o.start(t); o2.start(t); o.stop(stop); o2.stop(stop);
    } else if (kind === "wobble") {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = "sawtooth"; o.frequency.value = hz(n); o2.type = "square"; o2.frequency.value = hz(n + 12); o2.detune.value = 6;
      lp.frequency.value = 520; lp.Q.value = 9;
      lfo.type = "sine"; lfo.frequency.value = 1 / (spb * 2); lg.gain.value = 330;
      lfo.connect(lg); lg.connect(lp.frequency);
      envS(g, t, 0.01, 0.45 * v, dur, 0.65);
      o.connect(lp); o2.connect(lp); o.start(t); o2.start(t); lfo.start(t); o.stop(stop); o2.stop(stop); lfo.stop(stop);
    } else {
      const o = ctx.createOscillator(), sub = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = hz(n);
      sub.type = "sine"; sub.frequency.value = hz(n - 12);
      lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur * 0.9); lp.Q.value = 6;
      env(g, t, 0.004, 0.42 * v, dur * 0.95);
      o.connect(lp); sub.connect(lp); o.start(t); sub.start(t); o.stop(stop); sub.stop(stop);
    }
    lp.connect(g); g.connect(out);
  }
  // two slightly detuned voices sharing one vibrato LFO
  function lead(t, n, dur, v = 1, type = "square") {
    const g = ctx.createGain(); envS(g, t, 0.006, 0.13 * v, dur, 0.45);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.value = 4; vib.connect(vg);
    [0, 7].forEach((cents) => {
      const o = ctx.createOscillator(); setType(o, type); o.frequency.value = hz(n); o.detune.value = cents;
      vg.connect(o.detune); o.connect(g); o.start(t); o.stop(t + dur + REL);
    });
    vib.start(t); vib.stop(t + dur + REL);
    g.connect(out);
  }
  // one quiet pulse voice per arpeggio step
  function arpNote(t, n, dur, v = 1, type = "pulse25") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    setType(o, type); o.frequency.value = hz(n);
    envS(g, t, 0.004, 0.07 * v, dur, 0.3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + REL);
  }
  // kinds: tri (plain triangle stack), pad (slow, warm, filtered), stab (short sawtooth jab)
  function chord(t, notes, dur, v = 1, kind = "tri") {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    if (kind === "pad") { lp.frequency.value = 1100; envS(g, t, Math.min(0.35, dur * 0.3), 0.075 * v, dur, 0.7); }
    else if (kind === "stab") { lp.frequency.value = 2600; env(g, t, 0.003, 0.09 * v, 0.14); }
    else { lp.frequency.value = 4000; envS(g, t, 0.01, 0.07 * v, dur, 0.5); }
    const stop = t + (kind === "stab" ? 0.2 : dur + REL);
    notes.forEach((n) => {
      const o = ctx.createOscillator(); o.type = kind === "stab" ? "sawtooth" : "triangle"; o.frequency.value = hz(n);
      if (kind === "stab") o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(lp); o.start(t); o.stop(stop);
    });
    lp.connect(g); g.connect(out);
  }
  // a water drip: a rising sine blip with a faint echo
  function drip(t, v = 1) {
    [[0, 1], [0.19, 0.35]].forEach(([dt, k]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(700, t + dt); o.frequency.exponentialRampToValueAtTime(1900, t + dt + 0.05);
      env(g, t + dt, 0.003, 0.22 * v * k, 0.22);
      o.connect(g); g.connect(out); o.start(t + dt); o.stop(t + dt + 0.3);
    });
  }
  // a filtered noise sweep; a long attack for a riser, a fast one for a fall
  function sweep(t, dur, f0, f1, v = 1, type = "bandpass", q = 1.2, a = null) {
    const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const att = a == null ? (f1 > f0 ? dur * 0.7 : 0.01) : a;
    env(g, t, att, v, Math.max(0.03, dur - att));
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.05);
  }
  // a single oscillator with a pitch glide, for effects
  function tone(t, type, f0, f1, dur, v, a = 0.005) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    setType(o, type); o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, v, dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------- tracks
  // B() joins 16-step bars so each bar stays readable on its own line.
  const B = (...bars) => bars.join(" ");
  const R = ". . . . . . . . . . . . . . . .";
  const T = {
    // The game's theme: bright, bouncy, hopeful. C major with a hook that
    // climbs C - F - Am - G and lands back on C when the loop comes round.
    title: {
      bpm: 124, swing: 0.14, leadType: "square",
      kick: B("x . . . . . . x . . x . . . . .",
              "x . . . . . . x . . x . . . x .",
              "x . . . . . . x . . x . . . . .",
              "x . . . . . . x . . x . x . . x"),
      snare: B(". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . x"),
      hat: B("x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x x x x x . o ."),
      bass: B("C2 . . C2 . . E2 . G2 . . G2 . A2 . Bb2",
              "F2 . . F2 . . A2 . C3 . . C3 . . D3 .",
              "A2 . . A2 . . C3 . E3 . . E3 . D3 . C3",
              "G2 . . G2 . . B2 . D3 . . D3 . . F3 ."),
      lead: B("G4 . E4 . C4 . E4 . G4 - - . A4 . G4 .",
              "A4 . F4 . C4 . F4 . A4 - - . C5 . A4 .",
              "E5 . C5 . A4 . C5 . E5 - - . D5 . C5 .",
              "B4 . D5 . G4 . B4 . D5 - - - . . . .",
              "E5 . G5 . E5 . C5 . D5 . E5 . D5 . C5 .",
              "A4 . C5 . A4 . F4 . G4 . A4 . C5 - - .",
              "E5 . E5 . D5 . C5 . B4 . A4 . B4 . C5 .",
              "D5 - - . B4 . G4 . A4 . B4 . D5 - - ."),
      chord: B("C4E4G4 . . . . . . . . . C4E4G4 . . . . .",
               "F4A4C5 . . . . . . . . . F4A4C5 . . . . .",
               "A3C4E4 . . . . . . . . . A3C4E4 . . . . .",
               "G3B3D4 . . . . . . . . . G3B3D4 . . . . ."),
      chordLen: 4,
      arp: B(R, R, R, R,
             "C5E5G5C6 - - - - - - - . . . . . . . .",
             "F5A5C6 - - - - - - - . . . . . . . .",
             "A4C5E5 - - - - - - - . . . . . . . .",
             "G4B4D5 - - - - - - - . . . . . . . ."),
      arpVol: 0.8,
    },
    // The house at night before the explosion: soft pads, a clock ticking,
    // a music-box lead that wanders, one borrowed chord to make it uneasy.
    night: {
      bpm: 72, swing: 0, vol: 0.65, leadType: "triangle", leadVol: 0.9, bassKind: "soft", bassVol: 1.2, chordKind: "pad", chordVol: 1.5, sweepVol: 0.05,
      hat: "s . . . s . . . s . . . s . . .",
      bass: B("C2 - - - - - - - - - - - - - - -",
              "A1 - - - - - - - - - - - - - - -",
              "F1 - - - - - - - - - - - - - - -",
              "Ab1 - - - - - - - - - - - - - - -"),
      chord: B("C3E3G3B3 - - - - - - - - - - - - - - -",
               "A2C3E3G3 - - - - - - - - - - - - - - -",
               "F2A2C3E3 - - - - - - - - - - - - - - -",
               "Ab2C3Eb3G3 - - - - - - - - - - - - - - -"),
      lead: B(". . . . E5 . . . . . . . G5 - - .",
              ". . . . . . . . B4 - - - . . . .",
              ". . A4 . . . . . . . . . C5 - . .",
              ". . . . . . Eb5 - - . . . . . D5 ."),
      sweep: B(R, R, "d . . . . . . . . . . . . . . .", R),
    },
    // The break-in: a relentless eighth-note pulse on E, a flat-nine, and
    // dissonant stabs landing on the off-beats.
    danger: {
      bpm: 138, swing: 0, leadType: "pulse12", chordKind: "stab", chordVol: 1.2, sweepVol: 0.16,
      kick: B("x . . . x . . . x . . . x . . .",
              "x . . . x . . . x . . . x . . .",
              "x . . . x . . . x . . . x . . .",
              "x . . . x . . . x . . . x . x x"),
      snare: B(". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . x x"),
      hat: "x . x . x . x . x . x . x . x o",
      bass: B("E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 .",
              "E2 . E2 . E2 . E2 . E2 . E2 . G2 . F#2 .",
              "F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 .",
              "B1 . B1 . B1 . B1 . C2 . C2 . B1 . Bb1 ."),
      chord: B(". . . . . . E4G4Bb4 . . . . . . . . .",
               ". . . . . . E4G4Bb4 . . . E4F4B4 . . . . .",
               ". . . . . . F4Ab4B4 . . . . . . . . .",
               ". . B3D#4F4A4 . . . . . . . . . C4Eb4F#4 . . ."),
      lead: B(". . . . . . . . E5 . F5 . E5 . . .",
              ". . . . . . . . . . . . Bb4 . B4 .",
              "F5 - - . E5 . . . . . . . . . . .",
              ". . . . . . . . D#5 . E5 . F5 . F#5 ."),
      sweep: B(R, R, "u . . . . . . . . . . . . . . .", R),
    },
    // Town on the hill: laid-back swung funk with dominant sevenths and a
    // walking bass, the Onett feeling.
    outside: {
      bpm: 108, swing: 0.22, leadType: "square", chordLen: 3,
      kick: B("x . . . . . . x . . x . . . . .",
              "x . . . . . . x . . x . . x . .",
              "x . . . . . . x . . x . . . . .",
              "x . . . . . . x . . x . . . x ."),
      snare: B(". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . x"),
      hat: B("x . x . x . x . x . x . x . o .",
             "x . x . x x x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x x x . x . x . x . o ."),
      bass: B("C2 . . C2 . . Bb1 . C2 . . . E2 . G2 .",
              "C2 . . C2 . . Bb1 . C2 . . . G2 . Bb2 .",
              "F2 . . F2 . . Eb2 . F2 . . . A2 . C3 .",
              "G2 . . G2 . . F2 . G2 . B2 . D3 . F3 .",
              "C2 . . C2 . . Bb1 . C2 . . . E2 . G2 .",
              "C2 . . C2 . . Bb1 . C2 . . A2 . Bb2 . B2",
              "F2 . . F2 . . Eb2 . F2 . . . A2 . Ab2 .",
              "G2 . . G2 . . F2 . G2 . . . D2 . F2 ."),
      lead: B(". . . . E4 . G4 . . . Bb4 . A4 . G4 .",
              ". . E4 . G4 . . . C5 . . . Bb4 . G4 .",
              ". . . . A4 . C5 . . . Eb5 . D5 . C5 .",
              ". . B4 . D5 . . . F5 . . . E5 . D5 .",
              "C5 . . . E4 . G4 . . . Bb4 . A4 . G4 .",
              ". . E4 . G4 . . . C5 . D5 . Bb4 . G4 .",
              ". . . . A4 . C5 . . . Eb5 . D5 . C5 .",
              ". . B4 . D5 . . . F5 . E5 . D5 . C5 ."),
      chord: B(". . . . . . C4E4Bb4 . . . . . . . C4E4Bb4 .",
               ". . . . . . C4E4Bb4 . . . . . . . C4E4Bb4 .",
               ". . . . . . F4A4Eb5 . . . . . . . F4A4Eb5 .",
               ". . . . . . G4B4F5 . . . . . . . G4B4F5 ."),
    },
    // The cave: sparse and minor, still grooving, with water dripping.
    cave: {
      bpm: 92, swing: 0.12, vol: 0.85, leadType: "pulse25", bassVol: 0.85, chordKind: "pad", chordVol: 0.8,
      kick: B("x . . . . . . . . . x . . . . .",
              "x . . . . . . x . . x . . . . .",
              "x . . . . . . . . . x . . . . .",
              "x . . . . . . x . . x . . . x ."),
      snare: B(". . . . s . . . . . . . x . . .",
               ". . . . s . . . . . . . x . . .",
               ". . . . s . . . . . . . x . . .",
               ". . . . s . . . . . . . x . . s"),
      hat: ". . x . . . x . . . x . . . o .",
      bass: B("C2 . . . . . . Eb2 . . G2 . . . Bb1 .",
              "C2 . . . . . . Eb2 . . G2 . . . F2 .",
              "Ab1 . . . . . . C2 . . Eb2 . . . Ab1 .",
              "G1 . . . . . . B1 . . D2 . . . G1 ."),
      lead: B(". . . . . . . . . . . . Eb4 . . .",
              ". . . . . . . . G4 . Bb4 . . . . .",
              ". . . . C5 - - . Bb4 . . . . . . .",
              ". . . . . . . . . . . . D4 . Eb4 ."),
      chord: B("C3Eb3G3 - - - - - - - - - - - - - - -",
               "C3Eb3G3 - - - - - - - - - - - - - - -",
               "Ab2C3Eb3 - - - - - - - - - - - - - - -",
               "G2B2D3 - - - - - - - - - - - - - - -"),
      drip: B(". . . . . . . . . . x . . . . .",
              ". . . x . . . . . . . . . . . .",
              ". . . . . . . . . . . . . x . .",
              ". . . . . x . . . . . . . . . x"),
    },
    // Battle: fast, four on the floor, octave-jumping bass, a lead that
    // answers itself in the second half over a running arpeggio.
    battle: {
      bpm: 152, swing: 0.04, leadType: "square", chordKind: "stab", arpVol: 0.55,
      kick: B("x . . . x . . . x . . . x . . .",
              "x . . . x . . . x . . . x . . .",
              "x . . . x . . . x . . . x . . .",
              "x . . . x . . . x . . . x . x ."),
      snare: B(". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . x"),
      hat: "x x x x x x x x x x x x x x o x",
      bass: B("E2 . E2 . E3 . E2 . E2 . E3 . E2 . D2 .",
              "E2 . E2 . E3 . E2 . G2 . G2 . A2 . B2 .",
              "C2 . C2 . C3 . C2 . C2 . C3 . C2 . B1 .",
              "D2 . D2 . D3 . D2 . B1 . B1 . B2 . B1 ."),
      lead: B("E5 . . B4 . . G4 . A4 . . . B4 . . .",
              "E5 . . B4 . . G4 . A4 . G4 . F#4 . E4 .",
              "C5 . . G4 . . E4 . F4 . . . G4 . . .",
              "D5 . . A4 . . F#4 . B4 . A4 . G4 . F#4 .",
              "E5 . G5 . B5 - . . A5 . G5 . F#5 . E5 .",
              "G5 . . E5 . . B4 . E5 - - . . . . .",
              "C5 . E5 . G5 - . . A5 . G5 . E5 . C5 .",
              "D5 . F#5 . A5 - . . B5 . A5 . F#5 . D5 ."),
      chord: B("E4G4B4 . . . . . . E4G4B4 . . . . . . . .",
               "E4G4B4 . . . . . . E4G4B4 . . . . . . . .",
               "C4E4G4 . . . . . . C4E4G4 . . . . . . . .",
               "D4F#4A4 . . . . . . B3D#4F#4 . . . . . . . ."),
      arp: B(R, R, R, R,
             "E5G5B5 - - - - - - - - - - - - - - -",
             "E5G5B5 - - - - - - - - - - - - - - -",
             "C5E5G5 - - - - - - - - - - - - - - -",
             "D5F#5A5 - - - - - - - - - - - - - - -"),
    },
    // Boss: half-time, a wobbling bass an octave below everything, sawtooth
    // lead over a Phrygian slide, and a noise fall into the loop.
    boss: {
      bpm: 96, swing: 0, leadType: "sawtooth", leadVol: 0.9, bassKind: "wobble", chordKind: "stab", chordVol: 1.3, sweepVol: 0.2,
      kick: B("X . . . . . . . . . x . . . . .",
              "X . . . . . . x . . x . . . . .",
              "X . . . . . . . . . x . . . . .",
              "X . . . . . . x . . x . . . x x"),
      snare: B(". . . . . . . . x . . . . . . .",
               ". . . . . . . . x . . . . . . .",
               ". . . . . . . . x . . . . . . .",
               ". . . . . . . . x . . . . . s x"),
      hat: B("x . x . x . x x x . x . x . x x",
             "x . x . x . x x x . x . x . x x",
             "x . x x x . x x x . x x x . x x",
             "x . x x x . x x x . x x x . x x"),
      bass: B("D1 - - - - - - - . . D1 - - . F1 -",
              "D1 - - - - - - - . . Ab1 - - . G1 -",
              "Eb1 - - - - - - - . . Eb1 - - . D1 -",
              "Bb1 - - - - - - - A1 - - - - - - -"),
      lead: B("D4 . . . . . . . Ab4 - - . G4 . F4 .",
              ". . . . . . . . D4 . F4 . Ab4 . G4 .",
              "Eb4 . . . . . . . Bb4 - - . A4 . G4 .",
              "F4 . E4 . Eb4 . D4 . A3 - - - - - - ."),
      chord: B(". . . . . . . . . . D4F4Ab4 . . . . .",
               ". . . . . . . D4F4Ab4 . . D4F4Ab4 . . . . .",
               ". . . . . . . . . . Eb4G4Bb4 . . . . .",
               "Bb3D4F4 . . . . . . . A3C#4E4 . . . . . . ."),
      sweep: B(R, R, R, ". . . . . . . . d . . . . . . ."),
    },
    // Victory: a two-bar fanfare played once, then a gentle loop.
    victory: {
      bpm: 128, swing: 0.1, loopStart: 32, leadType: "square",
      kick: B("x . . . . . . . x . . . . . . .",
              "x . . . . . . . . . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . ."),
      snare: B(". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . . . . .",
               ". . . . s . . . . . . . s . . .",
               ". . . . s . . . . . . . s . . .",
               ". . . . s . . . . . . . s . . .",
               ". . . . s . . . . . . . s . . ."),
      hat: B("x . x . x . x . x . x . x . x .",
             "x . x . x . x . . . . . . . . .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o ."),
      bass: B("C2 . . . G2 . . . C3 . . . G2 . . .",
              "F2 . . . G2 . . . C2 - - - - - - -",
              "C2 . . . . . . . E2 . . . G2 . . .",
              "F2 . . . . . . . A2 . . . C3 . . .",
              "D2 . . . . . . . F2 . . . A2 . . .",
              "G2 . . . . . . . B2 . . . D2 . . ."),
      lead: B("C5 . E5 . G5 . C6 - - . A5 . G5 . . .",
              "E5 . G5 . C6 - - - - - - - . . . .",
              ". . . . E5 . G5 . . . . . . . . .",
              ". . A5 . G5 . . . F5 . . . . . . .",
              ". . . . D5 . F5 . . . . . A5 - - .",
              ". . G5 . . . E5 . . . D5 . . . . ."),
      chord: B("C4E4G4 . . . . . . . . . . . . . . .",
               "F4A4C5 . . . G4B4D5 . . . C4E4G4 - - - - - - -",
               "C4E4G4B4 - - - - - - - - - - - - - - -",
               "F4A4C5E5 - - - - - - - - - - - - - - -",
               "D4F4A4C5 - - - - - - - - - - - - - - -",
               "G3B3D4F4 - - - - - - - - - - - - - - -"),
    },
    // The ending: the title hook again, slower and warmer over pads, then a
    // cadence that lands on a held C with sparkles on top.
    finis: {
      bpm: 100, swing: 0.1, leadType: "square", bassVol: 0.8, chordKind: "pad", chordVol: 1.1, arpVol: 0.7,
      kick: B("x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . x . . . . . . .",
              "x . . . . . . . . . . . . . . ."),
      snare: B(". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . x . . .",
               ". . . . x . . . . . . . . . . ."),
      hat: B("x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . x . x . o .",
             "x . x . x . x . x . . . . . . ."),
      bass: B("C2 - - - - - - . C2 . . . E2 . G2 .",
              "G2 - - - - - - . G2 . . . B2 . D3 .",
              "A2 - - - - - - . A2 . . . C3 . E3 .",
              "F2 - - - - - - . F2 . . . A2 . C3 .",
              "C2 - - - - - - . C2 . . . E2 . G2 .",
              "F2 - - - - - - . F2 . . . A2 . C3 .",
              "G2 - - - - - - . G2 . . . F2 . D2 .",
              "C2 - - - - - - - - - - - - - - -"),
      lead: B("G4 . E4 . C4 . E4 . G4 - - . A4 . G4 .",
              "B4 . G4 . D4 . G4 . B4 - - . D5 . B4 .",
              "E5 . C5 . A4 . C5 . E5 - - . D5 . C5 .",
              "A4 . F4 . C4 . F4 . A4 - - - . . . .",
              "E5 . G5 . E5 . C5 . D5 . E5 . D5 . C5 .",
              "A4 . C5 . A4 . F4 . G4 . A4 . C5 - - .",
              "D5 - - . B4 . G4 . A4 . B4 . D5 - - .",
              "E5 - - . C6 - - - - - - - - - - ."),
      chord: B("C3E3G3B3 - - - - - - - - - - - - - - -",
               "G2B2D3 - - - - - - - - - - - - - - -",
               "A2C3E3G3 - - - - - - - - - - - - - - -",
               "F2A2C3E3 - - - - - - - - - - - - - - -",
               "C3E3G3B3 - - - - - - - - - - - - - - -",
               "F2A2C3E3 - - - - - - - - - - - - - - -",
               "G2B2D3F3 - - - - - - - - - - - - - - -",
               "C3E3G3C4 - - - - - - - - - - - - - - -"),
      arp: B(R, R, R, R,
             "C5E5G5 - - - - - - - - - - - - - - -",
             "F5A5C6 - - - - - - - - - - - - - - -",
             "G5B5D6 - - - - - - - - - - - - - - -",
             "C5E5G5C6 - - - - - - - . . . . . . . ."),
    },
  };
  // older scene code asked for "home"; keep it pointing at the theme
  const ALIAS = { home: "title" };
  const LANES = ["kick", "snare", "hat", "bass", "lead", "lead2", "chord", "arp", "drip", "sweep"];
  Object.keys(T).forEach((name) => {
    const tr = T[name]; let len = 0;
    LANES.forEach((k) => {
      if (typeof tr[k] !== "string") return;
      tr[k] = tr[k].trim().split(/\s+/);
      if (tr[k].length % 16) console.warn(`music: ${name}.${k} has ${tr[k].length} steps`);
      len = Math.max(len, tr[k].length);
    });
    tr.len = len;
  });

  function schedule() {
    const tr = T[current]; if (!tr || !trackGain) return;
    const spb = 60 / tr.bpm / 4; // seconds per 16th
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      if (step >= tr.len) step = tr.loopStart || 0;
      const i = step;
      const t = nextTime + ((i % 2 === 1) ? spb * tr.swing : 0);
      out = trackGain;
      const tok = (lane) => lane ? lane[i % lane.length] : ".";
      // how many steps a note lasts: itself plus the "-" holds after it
      const holdLen = (lane) => { let n = 1; while (n < 64 && lane[(i + n) % lane.length] === "-") n++; return n; };
      const dv = (c) => c === "X" ? 1.3 : c === "x" ? 1 : c === "s" ? 0.4 : 0;
      let c;
      c = tok(tr.kick); if (dv(c)) kick(t, dv(c));
      c = tok(tr.snare); if (dv(c)) snare(t, dv(c));
      c = tok(tr.hat); if (c === "o") hat(t, true); else if (dv(c)) hat(t, false, dv(c));
      c = tok(tr.bass); if (isNote(c)) { const n = holdLen(tr.bass); bass(t, midi(c), n > 1 ? spb * n * 0.95 : spb * 1.6, tr.bassVol || 1, tr.bassKind || "funk", spb); }
      c = tok(tr.lead); if (isNote(c)) lead(t, midi(c), spb * holdLen(tr.lead) * 0.95, tr.leadVol || 1, tr.leadType || "square");
      c = tok(tr.lead2); if (isNote(c)) lead(t, midi(c), spb * holdLen(tr.lead2) * 0.95, tr.lead2Vol || 0.7, tr.lead2Type || "triangle");
      c = tok(tr.chord); if (isNote(c)) { const n = holdLen(tr.chord); chord(t, notesOf(c), n > 1 ? spb * n * 0.95 : spb * (tr.chordLen || 6), tr.chordVol || 1, tr.chordKind || "tri"); }
      c = tok(tr.arp);
      if (c === ".") arp = null; else if (c !== "-") arp = { notes: notesOf(c), idx: 0 };
      if (arp && arp.notes.length) { arpNote(t, arp.notes[arp.idx % arp.notes.length], spb * 0.9, tr.arpVol || 1, tr.arpType || "pulse25"); arp.idx++; }
      c = tok(tr.drip); if (dv(c)) drip(t, dv(c));
      c = tok(tr.sweep); if (c === "u") sweep(t, spb * 16, 200, 3000, tr.sweepVol || 0.12); else if (c === "d") sweep(t, spb * 16, 3000, 150, tr.sweepVol || 0.12);
      nextTime += spb; step += 1;
    }
  }

  // Each run of a track gets its own gain node, so the outgoing track fades
  // out (taking its ringing pads with it) while the new one fades in.
  function newTrackGain(vol) {
    const g = ctx.createGain(), now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol, now + FADE);
    g.connect(duckGain); return g;
  }
  function retire(g) {
    if (!g) return;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + FADE);
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* already gone */ } }, 2000);
  }
  function start() {
    if (!ensure() || !current) return;
    if (ctx.state === "suspended") ctx.resume();
    if (timer) return;
    const tr = T[current]; if (!tr) return;
    retire(trackGain); trackGain = newTrackGain(tr.vol || 1);
    nextTime = ctx.currentTime + 0.05; step = 0; arp = null;
    timer = setInterval(schedule, TICK);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function clearPending() { if (pending) { clearTimeout(pending); pending = null; } }

  // Browsers only allow audio after a user gesture: arm on the first one.
  // iOS additionally (a) needs the context created/resumed synchronously inside
  // a touchend/click handler and (b) keeps Web Audio under the ringer/silent
  // switch until a media element has played, so we play a silent clip once to
  // move the session to the playback category.
  let armed = false, keeper = null;
  // one second of 8-bit silence as a WAV, built in memory
  function silentWav() {
    const rate = 8000, n = rate, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
    if (!keeper) {
      // iOS keeps Web Audio under the ringer switch until a media element is *playing*;
      // a looping silent clip, kept referenced, moves the session to playback and holds it there.
      try {
        keeper = new Audio(silentWav()); keeper.loop = true; keeper.setAttribute("playsinline", ""); keeper.muted = false;
        const pr = keeper.play(); if (pr && pr.catch) pr.catch(() => { keeper = null; });
      } catch (e) { keeper = null; }
      try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch (e) { /* ignore */ }
    }
    start();
  }
  function arm() {
    if (armed) return; armed = true;
    // capture phase, so a canvas that stops propagation cannot hide the gesture from us
    ["keydown", "pointerdown", "pointerup", "touchstart", "touchend", "click"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", () => { if (!document.hidden && ctx && ctx.state === "suspended") ctx.resume(); });
  }
  arm();

  // ------------------------------------------------------------- effects
  // Each effect is written against `out`, which sfx() points at the effects bus.
  const SFX = {
    boom(t) { kick(t, 1.4); kick(t + 0.08, 1.2); snare(t + 0.02, 1.3); sweep(t, 1.4, 600, 60, 0.9, "lowpass", 0.7, 0.01); tone(t, "sine", 70, 28, 1.1, 0.8); },
    bang(t) { kick(t, 1.1); snare(t, 1); sweep(t, 0.35, 1500, 200, 0.6, "lowpass", 0.7, 0.005); },
    hit(t) { snare(t, 0.9); lead(t, 72, 0.08, 0.6, "sawtooth"); sweep(t, 0.08, 2500, 800, 0.3, "bandpass", 2, 0.003); },
    hurt(t) { tone(t, "square", 330, 110, 0.28, 0.35); sweep(t, 0.2, 900, 300, 0.35, "lowpass", 0.7, 0.005); },
    slash(t) { sweep(t, 0.18, 4000, 500, 0.5, "bandpass", 1.2, 0.01); tone(t + 0.02, "sawtooth", 900, 200, 0.12, 0.12); },
    psi_fire(t) { sweep(t, 0.7, 200, 2500, 0.7, "lowpass", 1, 0.15); tone(t, "sawtooth", 110, 520, 0.5, 0.25, 0.05); tone(t + 0.35, "sawtooth", 520, 160, 0.35, 0.2); },
    psi_ice(t) { [96, 91, 88, 84, 79, 76].forEach((n, i) => tone(t + i * 0.06, "sine", hz(n), hz(n), 0.35, 0.22)); sweep(t, 0.6, 8000, 2500, 0.25, "highpass", 1, 0.02); },
    psi_star(t) { [72, 76, 79, 84, 88, 91, 96, 100].forEach((n, i) => lead(t + i * 0.05, n, 0.18, 0.7, "pulse25")); chord(t + 0.42, [84, 88, 91, 96], 0.7, 1.5); sweep(t + 0.4, 0.5, 6000, 9000, 0.15, "highpass", 1, 0.05); },
    heal(t) { [60, 64, 67, 72].forEach((n, i) => lead(t + i * 0.09, n, 0.35, 0.5, "triangle")); chord(t + 0.2, [72, 76, 79, 84], 0.9, 1.2, "pad"); },
    select(t) { lead(t, 84, 0.05, 0.5); },
    move(t) { lead(t, 79, 0.03, 0.35); },
    back(t) { lead(t, 79, 0.04, 0.4); lead(t + 0.06, 72, 0.06, 0.4); },
    talk(t) { lead(t, 88, 0.025, 0.3, "triangle"); },
    pickup(t) { [76, 80, 83, 88].forEach((n, i) => lead(t + i * 0.07, n, 0.14, 0.8)); },
    unlock(t) { [67, 72, 76, 79].forEach((n, i) => chord(t + i * 0.09, [n], 0.3, 1.5)); },
    door(t) { kick(t, 0.7); sweep(t, 0.25, 300, 900, 0.35, "bandpass", 4, 0.08); tone(t + 0.2, "square", 1200, 1200, 0.02, 0.15); },
    battle_start(t) {
      [0, 0.28, 0.5, 0.66].forEach((d) => kick(t + d, 1.1));
      tone(t, "sawtooth", 110, 880, 0.85, 0.3, 0.05); sweep(t, 0.9, 300, 4000, 0.5, "bandpass", 1, 0.6);
      chord(t + 0.86, [64, 67, 71, 76], 0.4, 2, "stab"); api.duck(1.2);
    },
    win(t) {
      kick(t); [72, 76, 79, 84].forEach((n, i) => lead(t + i * 0.12, n, 0.14, 0.9));
      snare(t + 0.5, 1.1); hat(t + 0.5, true); lead(t + 0.5, 84, 0.9, 0.9); chord(t + 0.5, [60, 64, 67, 72], 1.0, 2.0); api.duck(1.6);
    },
    lose(t) { [64, 63, 62, 61].forEach((n, i) => lead(t + i * 0.26, n, 0.3, 0.6, "sawtooth")); chord(t + 0.9, [57, 60, 64], 1.2, 1.5, "pad"); api.duck(2.0); },
    kidnap(t) {
      kick(t, 1.3); sweep(t, 0.9, 2000, 120, 0.6, "lowpass", 1, 0.02);
      [0, 1, 6].forEach((d) => tone(t, "sawtooth", 600 * Math.pow(2, d / 12), 80 * Math.pow(2, d / 12), 0.9, 0.22, 0.01)); api.duck(1.2);
    },
  };

  const api = {
    play(name) {
      name = ALIAS[name] || name;
      if (!T[name]) return;
      if (current === name && timer) return;
      current = name;
      if (!ctx) return; // starts on the first gesture, via unlock()
      clearPending();
      if (timer) {
        // fade the running track out, then start the new one fading in
        stopTimer(); retire(trackGain); trackGain = null;
        pending = setTimeout(() => { pending = null; if (current === name) start(); }, FADE * 1000);
      } else {
        start();
      }
    },
    unlock,
    // diagnostics: is the context running, is a track scheduled, and is there signal on the master bus?
    debug() {
      const out = { hasCtx: !!ctx, ctxState: ctx ? ctx.state : null, current, timerRunning: !!timer, muted, masterGain: master ? master.gain.value : null, rms: null, sampleRate: ctx ? ctx.sampleRate : null };
      if (ctx && master) {
        if (!this._an) { this._an = ctx.createAnalyser(); this._an.fftSize = 2048; master.connect(this._an); }
        const buf = new Float32Array(this._an.fftSize); this._an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        out.rms = Math.sqrt(sum / buf.length);
      }
      return out;
    },
    stop() { clearPending(); stopTimer(); if (ctx) { retire(trackGain); trackGain = null; } current = null; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() { return muted; },
    // lower the music under a sting for `seconds`, then bring it back
    duck(seconds = 0.8, depth = 0.25) {
      if (!ctx || !duckGain) return;
      const g = duckGain.gain, now = ctx.currentTime, hold = Math.max(0.05, seconds);
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(depth, now + 0.03);
      g.setValueAtTime(depth, now + hold);
      g.linearRampToValueAtTime(1, now + hold + 0.25);
    },
    // one-shot effects; unknown kinds are ignored
    sfx(kind) {
      const fn = SFX[kind]; if (!fn || !ensure()) return;
      out = sfxBus;
      fn(ctx.currentTime);
    },
  };
  return api;
})();

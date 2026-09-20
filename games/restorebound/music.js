// Chiptune music for RestoreBound, synthesized with the Web Audio API so the
// game ships with no audio files. Earthbound-flavoured: syncopated funky bass,
// square-wave leads, a little swing, and drums made of noise and sine sweeps.
//
// Patterns are 16th-note steps. A note is written like "C3"; "." is a rest;
// "-" holds the previous note. Tracks loop until another one is requested.

window.music = (() => {
  let ctx = null, master = null, muted = false, current = null, timer = null;
  let nextTime = 0, step = 0;
  const LOOKAHEAD = 0.12, TICK = 25;

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name);
    if (!m) return null;
    return 12 * (parseInt(m[3], 10) + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
      // a touch of compression keeps the drums from clipping the lead
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.disconnect(); master.connect(comp); comp.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------- instruments
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function env(g, t, a, peak, d, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }
  function kick(t, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    env(g, t, 0.002, 0.9 * v, 0.22);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
  }
  function snare(t, v = 1) {
    const n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.8;
    env(g, t, 0.001, 0.5 * v, 0.16);
    n.connect(bp); bp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.2);
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    env(g2, t, 0.001, 0.35 * v, 0.09);
    o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.12);
  }
  function hat(t, open = false, v = 1) {
    const n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = "highpass"; hp.frequency.value = 7500;
    env(g, t, 0.001, 0.22 * v, open ? 0.18 : 0.045);
    n.connect(hp); hp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.25);
  }
  function bass(t, n, dur, v = 1) {
    const o = ctx.createOscillator(), sub = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = hz(n);
    sub.type = "sine"; sub.frequency.value = hz(n - 12);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur * 0.9); lp.Q.value = 6;
    env(g, t, 0.004, 0.42 * v, dur * 0.95);
    o.connect(lp); sub.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); sub.start(t); o.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
  }
  function lead(t, n, dur, v = 1, type = "square") {
    const g = ctx.createGain(); env(g, t, 0.006, 0.13 * v, dur * 0.9);
    [0, 7].forEach((cents) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(n); o.detune.value = cents;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.value = 4;
      vib.connect(vg); vg.connect(o.detune); vib.start(t); vib.stop(t + dur + 0.05);
      o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
    g.connect(master);
  }
  function chord(t, notes, dur, v = 1) {
    notes.forEach((n) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = hz(n);
      env(g, t, 0.01, 0.07 * v, dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  // ------------------------------------------------------------- tracks
  // Each lane is a space-separated string of steps. Drums use x (hit), o (open hat), . (rest).
  const T = {
    // Funky, bouncy, major with bluesy sevenths. Home, town, title.
    home: {
      bpm: 116, swing: 0.16,
      kick:  "x . . . . . x . x . . . . . x . x . . . . . x . x . . x . . . .",
      snare: ". . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . x",
      hat:   "x . x . x . x . x . x . x . o . x . x . x . x . x . x . x . o .",
      bass:  "C2 . . C2 . Eb2 . E2 G2 . . . . Bb2 . B2 C3 . . C2 . . G2 . F2 . . F2 . Ab2 . G2",
      lead:  "E4 . G4 . . A4 . . G4 . E4 . . . D4 . E4 . . . G4 . . . . . A4 . G4 . E4 .",
      chord: "C4E4G4 . . . . . . . . . . . . . . . F4A4C5 . . . . . . . . . . . . . .",
    },
    // Sparse, minor, mysterious but still grooving. The cave.
    cave: {
      bpm: 100, swing: 0.1,
      kick:  "x . . . . . . . x . . . . . x . x . . . . . . . x . . . . . . .",
      snare: ". . . . . . . . x . . . . . . . . . . . . . . . x . . . . . x .",
      hat:   ". . x . . . x . . . x . . . x . . . x . . . x . . . x . . . o .",
      bass:  "C2 . . . . . Eb2 . . . G2 . . . Bb1 . C2 . . . . . Eb2 . . . F2 . . . Ab1 .",
      lead:  ". . . . . . . . . . . . Eb4 . . . . . . . . . . . . . G4 . Bb4 . . .",
      chord: "C3Eb3G3 . . . . . . . . . . . . . . . Ab2C3Eb3 . . . . . . . . . . . . . .",
    },
    // Driving, minor, fast. Battle.
    battle: {
      bpm: 146, swing: 0.05,
      kick:  "x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . x .",
      snare: ". . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . x",
      hat:   "x x x x x x x x x x x x x x o x x x x x x x x x x x x x x x o x",
      bass:  "E2 . E2 . E3 . E2 . G2 . G2 . A2 . B2 . E2 . E2 . E3 . E2 . D2 . D2 . C2 . B1 .",
      lead:  "E5 . . B4 . . G4 . A4 . . . B4 . . . E5 . . B4 . . G4 . A4 . G4 . Fs4 . E4 .",
      chord: "E3G3B3 . . . . . . . . . . . . . . . C3E3G3 . . . . . . . D3Fs3A3 . . . . . .",
    },
    // Short fanfare, then a gentle loop.
    victory: {
      bpm: 120, swing: 0.1,
      kick:  "x . . . . . . . x . . . . . . . x . . . x . . . x . . . . . . .",
      snare: ". . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . .",
      hat:   "x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . o .",
      bass:  "C2 . . . G2 . . . C3 . . . . . . . F2 . . . G2 . . . C2 . . . . . . .",
      lead:  "C5 . E5 . G5 . C6 . . . . . . . . . A5 . G5 . E5 . G5 . C5 . . . . . . .",
      chord: "C4E4G4 . . . . . . . . . . . . . . . F4A4C5 . . . G4B4D5 . . . C4E4G4 . . . . . . .",
    },
  };
  Object.values(T).forEach((tr) => { Object.keys(tr).forEach((k) => { if (typeof tr[k] === "string") tr[k] = tr[k].trim().split(/\s+/); }); });

  function schedule() {
    const tr = T[current]; if (!tr) return;
    const spb = 60 / tr.bpm / 4; // seconds per 16th
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const i = step % tr.kick.length;
      const swing = (i % 2 === 1) ? spb * tr.swing : 0;
      const t = nextTime + swing;
      if (tr.kick[i] === "x") kick(t);
      if (tr.snare[i] === "x") snare(t);
      if (tr.hat[i] === "x") hat(t); else if (tr.hat[i] === "o") hat(t, true);
      const b = tr.bass[i]; if (b && b !== "." && b !== "-") bass(t, midi(b), spb * 1.6);
      const l = tr.lead[i]; if (l && l !== "." && l !== "-") {
        // hold the note through following "-" steps
        let len = 1; while (tr.lead[(i + len) % tr.lead.length] === "-") len++;
        lead(t, midi(l.replace("s", "#")), spb * len * 0.95);
      }
      const c = tr.chord[i]; if (c && c !== ".") {
        const ns = c.match(/[A-G][#b]?\d/g).map(midi);
        chord(t, ns, spb * 6);
      }
      nextTime += spb; step += 1;
    }
  }

  function start() {
    if (!ensure() || !current) return;
    if (ctx.state === "suspended") ctx.resume();
    if (timer) return;
    nextTime = ctx.currentTime + 0.05; step = 0;
    timer = setInterval(schedule, TICK);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

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

  return {
    play(name) {
      if (current === name && timer) return;
      current = name;
      if (ctx) { stopTimer(); start(); }
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
    stop() { stopTimer(); current = null; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() { return muted; },
    // one-shot effects
    sfx(kind) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      if (kind === "boom") { kick(t, 1.4); kick(t + 0.08, 1.2); snare(t + 0.02, 1.3); const n = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = "lowpass"; lp.frequency.value = 300; env(g, t, 0.01, 0.9, 1.2); n.connect(lp); lp.connect(g); g.connect(master); n.start(t); n.stop(t + 1.3); }
      if (kind === "hit") { snare(t, 0.9); lead(t, 72, 0.08, 0.6, "sawtooth"); }
      if (kind === "pickup") { [76, 80, 83, 88].forEach((n, i) => lead(t + i * 0.07, n, 0.14, 0.8)); }
      if (kind === "select") { lead(t, 84, 0.05, 0.5); }
      if (kind === "unlock") { [67, 72, 76, 79].forEach((n, i) => chord(t + i * 0.09, [n], 0.3, 1.5)); }
    },
  };
})();

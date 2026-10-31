/* ============ 拾光吉他 · 音频引擎 ============ */

const GT_AUDIO = (() => {
  let ctx = null;
  let stream = null;
  let analyser = null;
  let buf = null;
  let running = false;
  let rafId = null;
  let listeners = [];

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  async function initMic() {
    ensureCtx();
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
    return stream;
  }

  // 自相关音高检测（YIN 简化版）
  function detectPitch(data, sampleRate) {
    const SIZE = data.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += data[i] * data[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.008) return { freq: 0, clarity: 0, rms };

    // 去直流
    let mean = 0;
    for (let i = 0; i < SIZE; i++) mean += data[i];
    mean /= SIZE;
    const x = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) x[i] = data[i] - mean;

    const minLag = Math.floor(sampleRate / 1200); // 最高 1200Hz
    const maxLag = Math.floor(sampleRate / 70);   // 最低 70Hz
    let bestLag = -1;
    let bestCorr = 0;
    const corr = new Float32Array(maxLag + 2);

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < SIZE - lag; i++) {
        sum += x[i] * x[i + lag];
        e1 += x[i] * x[i];
        e2 += x[i + lag] * x[i + lag];
      }
      const norm = Math.sqrt(e1 * e2) || 1;
      const c = (sum / norm) * ((SIZE - lag) / SIZE);
      corr[lag] = c;
      if (c > bestCorr) { bestCorr = c; bestLag = lag; }
    }
    if (bestLag < 0 || bestCorr < 0.5) return { freq: 0, clarity: bestCorr, rms };

    // 抛物线插值细化
    const y1 = corr[bestLag - 1] || 0;
    const y2 = corr[bestLag];
    const y3 = corr[bestLag + 1] || 0;
    const denom = 2 * (2 * y2 - y1 - y3);
    const shift = denom !== 0 ? (y3 - y1) / denom : 0;
    const lag = bestLag + Math.max(-0.5, Math.min(0.5, shift));
    return { freq: sampleRate / lag, clarity: bestCorr, rms };
  }

  function freqToMidi(f) {
    return 69 + 12 * Math.log2(f / 440);
  }
  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }
  function midiName(m) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const r = Math.round(m);
    return names[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
  }

  function loop() {
    if (!running) return;
    analyser.getFloatTimeDomainData(buf);
    const res = detectPitch(buf, ctx.sampleRate);
    const out = {
      freq: res.freq,
      clarity: res.clarity,
      rms: res.rms,
      midi: res.freq > 0 ? freqToMidi(res.freq) : 0,
      cents: 0,
    };
    if (out.midi) {
      out.cents = (out.midi - Math.round(out.midi)) * 100;
      out.midiRounded = Math.round(out.midi);
    }
    listeners.forEach((fn) => fn(out));
    rafId = requestAnimationFrame(loop);
  }

  async function start() {
    await initMic();
    if (running) return;
    running = true;
    loop();
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function onFrame(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter((f) => f !== fn); };
  }

  /* ---- 单音播放（用于听旋律） ---- */
  function playTone(freq, dur, when, gainVal) {
    const c = ensureCtx();
    const t = when || c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const peak = gainVal || 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.08, dur * 0.92));
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function click(when, accent) {
    const c = ensureCtx();
    const t = when || c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.3 : 0.16, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /* ---- 节拍器（lookahead 调度） ---- */
  const Metro = {
    bpm: 76,
    beatsPerBar: 4,
    subdivision: 1,
    running: false,
    nextTime: 0,
    beatIndex: 0,
    timer: null,
    onBeat: null,
    start() {
      const c = ensureCtx();
      this.running = true;
      this.beatIndex = 0;
      this.nextTime = c.currentTime + 0.12;
      const tick = () => {
        if (!this.running) return;
        const c2 = ensureCtx();
        while (this.nextTime < c2.currentTime + 0.12) {
          const isDown = this.beatIndex % this.beatsPerBar === 0;
          click(this.nextTime, isDown);
          if (this.onBeat) {
            const b = this.beatIndex;
            const when = this.nextTime;
            setTimeout(() => this.onBeat && this.onBeat(b, when), Math.max(0, (when - c2.currentTime) * 1000));
          }
          this.beatIndex++;
          this.nextTime += 60 / this.bpm / this.subdivision;
        }
        this.timer = setTimeout(tick, 25);
      };
      tick();
    },
    stop() {
      this.running = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    },
  };

  return {
    ensureCtx, initMic, start, stop, onFrame, detectPitch,
    freqToMidi, midiToFreq, midiName, playTone, click, Metro,
    get ctx() { return ctx; },
    get isRunning() { return running; },
  };
})();

window.GT_AUDIO = GT_AUDIO;

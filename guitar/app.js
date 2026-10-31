/* ============ 拾光吉他 · 主逻辑 ============ */
(function () {
  const D = window.GT_DATA;
  const A = window.GT_AUDIO;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------- 存储 ---------------- */
  const STORE_KEY = 'gt_progress_v1';
  const Store = {
    data: { cleared: {}, seconds: 0, lastDay: '', streak: 0, chords: {} },
    load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
      } catch (e) {}
      this.touch();
    },
    save() { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); },
    touch() {
      const today = new Date().toISOString().slice(0, 10);
      if (this.data.lastDay !== today) {
        const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        this.data.streak = this.data.lastDay === y ? (this.data.streak || 0) + 1 : 1;
        this.data.lastDay = today;
        this.save();
      }
    },
    clear() { localStorage.removeItem(STORE_KEY); location.reload(); },
  };
  Store.load();

  /* ---------------- 麦克风 ---------------- */
  let micOn = false;
  const micBtn = $('#micBtn');
  micBtn.addEventListener('click', async () => {
    if (micOn) return;
    try {
      await A.start();
      micOn = true;
      micBtn.textContent = '麦克风已开';
      micBtn.classList.add('on');
    } catch (e) {
      micBtn.textContent = '麦克风被拒绝';
      alert('拿不到麦克风权限。请允许浏览器使用麦克风，或换 Chrome / Edge 打开。\n' + e.message);
    }
  });

  /* ---------------- 标签切换 ---------------- */
  function route(page) {
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.page === page));
    $$('.page').forEach((p) => p.classList.toggle('on', p.id === 'page-' + page));
    if (page === 'progress') renderProgress();
    if (page === 'theory') renderTheory();
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => route(b.dataset.page)));

  /* ================= 调音器 ================= */
  const noteName = $('#noteName');
  const centsText = $('#centsText');
  const needle = $('#needle');
  const tunerHint = $('#tunerHint');
  let targetString = 6;
  let autoPick = true;

  function buildStringRow() {
    const row = $('#stringRow');
    row.innerHTML = '';
    D.TUNING.forEach((t) => {
      const b = document.createElement('button');
      b.dataset.s = t.s;
      b.innerHTML = `${t.s}弦<small>${t.name}${t.oct}</small>`;
      b.addEventListener('click', () => {
        autoPick = false;
        targetString = t.s;
        markString();
        tunerHint.textContent = `正在调 ${t.label}，标准音 ${t.freq.toFixed(2)} Hz。慢慢拧，别一次拧太多。`;
      });
      row.appendChild(b);
    });
    markString();
  }
  function markString() {
    $$('#stringRow button').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.s) === targetString && !autoPick);
    });
  }
  buildStringRow();

  let lastFrameAt = 0;
  A.onFrame((f) => {
    if (!micOn) return;
    const now = performance.now();
    if (now - lastFrameAt < 40) return;
    lastFrameAt = now;
    if (!f.midi || f.clarity < 0.6) {
      if (now - lastFrameAt > 400) {
        noteName.textContent = '—';
      }
      return;
    }
    // 自动选弦：找最近的弦
    if (autoPick) {
      let bestS = targetString, bestD = 99;
      D.TUNING.forEach((t) => {
        const d = Math.abs(f.midi - t.midi);
        if (d < bestD) { bestD = d; bestS = t.s; }
      });
      if (bestD < 2.5) { targetString = bestS; markString(); }
    }
    const t = D.TUNING.find((x) => x.s === targetString);
    noteName.textContent = A.midiName(f.midiRounded);
    const cents = Math.round((f.midi - t.midi) * 100);
    const clamped = Math.max(-60, Math.min(60, cents));
    needle.setAttribute('transform', `rotate(${(clamped / 60) * 62} 150 150)`);
    if (Math.abs(cents) <= 5) {
      centsText.textContent = '准了 ✓';
      centsText.className = 'cents ok';
    } else if (Math.abs(cents) < 20) {
      centsText.textContent = (cents > 0 ? '偏高 ' : '偏低 ') + Math.abs(cents) + ' 音分 · 快到了';
      centsText.className = 'cents';
    } else {
      centsText.textContent = (cents > 0 ? '偏高 ' : '偏低 ') + Math.abs(cents) + ' 音分 · ' + (cents > 0 ? '往松拧' : '往紧拧');
      centsText.className = 'cents bad';
    }
  });

  /* ================= 曲谱列表 ================= */
  let songKind = 'melody';
  $$('#songSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      songKind = b.dataset.kind;
      $$('#songSeg button').forEach((x) => x.classList.toggle('on', x === b));
      renderSongList();
    });
  });

  function renderSongList() {
    const wrap = $('#songList');
    wrap.innerHTML = '';
    const list = songKind === 'melody' ? D.MELODIES : D.SONGBOOK;
    list.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'song-card' + (Store.data.cleared[s.id] ? ' cleared' : '');
      const chords = s.chords && s.chords.length ? s.chords.join(' · ') : '单音';
      card.innerHTML = `
        <div>
          <div class="name">${s.name}</div>
          <div class="sub">${s.key} 调 · ${s.bpm} BPM · ${chords}</div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="lv">L${s.level}</span>
          <span class="go">›</span>
        </div>`;
      card.addEventListener('click', () => openSheet(s, songKind));
      wrap.appendChild(card);
    });
  }
  renderSongList();

  /* ================= 曲谱层 ================= */
  const sheet = $('#sheet');
  let currentSong = null;
  let currentKind = 'melody';
  let practiceTimer = null;
  let stopFlag = false;

  function openSheet(song, kind) {
    currentSong = song;
    currentKind = kind;
    sheet.classList.add('on');
    $('#sheetTitle').textContent = song.name;
    $('#scoreBar').textContent = '准确率 —';
    const meta = [`${song.key} 调`, `${song.bpm} BPM`, `难度 L${song.level}`];
    if (song.chords && song.chords.length) meta.push('和弦 ' + song.chords.join(' '));
    $('#sheetMeta').textContent = meta.join(' · ');
    const body = $('#sheetBody');
    body.innerHTML = '';
    if (kind === 'melody') body.appendChild(renderMelody(song));
    else body.appendChild(renderSongbook(song));
    body.scrollTop = 0;
  }
  $('#sheetBack').addEventListener('click', closeSheet);
  function closeSheet() {
    stopAll();
    sheet.classList.remove('on');
    currentSong = null;
  }
  function stopAll() {
    stopFlag = true;
    A.Metro.stop();
    if (practiceTimer) clearTimeout(practiceTimer);
    practiceTimer = null;
    $$('.note-num.now').forEach((e) => e.classList.remove('now'));
    $$('.bar.now').forEach((e) => e.classList.remove('now'));
  }

  /* ---------- TAB 渲染 ---------- */
  const STR_GAP = 11;
  const PX_PER_BEAT = 42;

  function boxWidth() {
    const w = window.innerWidth;
    return Math.max(280, Math.min(660, w > 780 ? 660 : w - 66));
  }

  // 整首曲子的音符统一编号（绝对拍位），渲染与跟练共用同一顺序
  function buildNotes(song) {
    const src = song.jianpu.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).join(' | ');
    const parsed = D.parseJianpu(src, song.meter);
    const notes = parsed.events.filter(function (e) { return e.kind === 'note'; });
    notes.forEach(function (n, i) { n.id = i; });
    return { notes: notes, totalBeats: parsed.totalBeats };
  }

  function renderMelody(song) {
    const box = document.createElement('div');
    const data = buildNotes(song);
    const m = song.meter || 4;
    const maxBeats = m * 2;                       // 每行两小节，读谱不挤
    const rowCount = Math.max(1, Math.ceil(data.totalBeats / maxBeats));
    const ppb = Math.max(24, Math.min(90, (boxWidth() - 52) / maxBeats));
    const rowW = maxBeats * ppb + 44;
    const top = 16, bottom = top + 5 * STR_GAP;

    for (let r = 0; r < rowCount; r++) {
      const startBeat = r * maxBeats;
      const wrap = document.createElement('div');
      wrap.className = 'tab-line';

      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('width', rowW);
      svg.setAttribute('height', bottom + 22);
      svg.setAttribute('viewBox', '0 0 ' + rowW + ' ' + (bottom + 22));

      // 六根弦
      for (let s = 1; s <= 6; s++) {
        const y = top + (s - 1) * STR_GAP;
        const line = document.createElementNS(SVGNS, 'line');
        line.setAttribute('x1', 14); line.setAttribute('x2', rowW - 6);
        line.setAttribute('y1', y); line.setAttribute('y2', y);
        line.setAttribute('stroke', s <= 3 ? '#4a3a2c' : '#3a2e24');
        line.setAttribute('stroke-width', 1);
        svg.appendChild(line);
      }
      // 琴枕
      const nut = document.createElementNS(SVGNS, 'line');
      nut.setAttribute('x1', 14); nut.setAttribute('x2', 14);
      nut.setAttribute('y1', top); nut.setAttribute('y2', bottom);
      nut.setAttribute('stroke', '#7a6650'); nut.setAttribute('stroke-width', 2);
      svg.appendChild(nut);
      // 小节线
      for (let b = m; b <= maxBeats + 0.001; b += m) {
        const x = 20 + b * ppb;
        const bl = document.createElementNS(SVGNS, 'line');
        bl.setAttribute('x1', x); bl.setAttribute('x2', x);
        bl.setAttribute('y1', top - 2); bl.setAttribute('y2', bottom + 2);
        bl.setAttribute('stroke', b === maxBeats ? '#7a6650' : '#3a2e24');
        bl.setAttribute('stroke-width', 1);
        svg.appendChild(bl);
      }
      // 音符
      data.notes.forEach(function (ev) {
        if (ev.beat < startBeat - 0.001 || ev.beat >= startBeat + maxBeats - 0.001) {
          if (!(r === rowCount - 1 && ev.beat >= startBeat)) return;
        }
        const x = 20 + (ev.beat - startBeat) * ppb;
        const y = top + (ev.string - 1) * STR_GAP + 4.5;
        const bg = document.createElementNS(SVGNS, 'rect');
        bg.setAttribute('x', x - 6.5); bg.setAttribute('y', y - 9);
        bg.setAttribute('width', 13); bg.setAttribute('height', 11);
        bg.setAttribute('fill', '#14100d');
        svg.appendChild(bg);
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', x);
        t.setAttribute('y', y);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'note-num');
        t.setAttribute('id', 'n-' + ev.id);
        t.textContent = ev.fret;
        svg.appendChild(t);
        if (ev.dur < 1) {
          const ln = document.createElementNS(SVGNS, 'line');
          ln.setAttribute('x1', x - 5); ln.setAttribute('x2', x + 5);
          ln.setAttribute('y1', y + 8.5); ln.setAttribute('y2', y + 8.5);
          ln.setAttribute('stroke', '#7a6650'); ln.setAttribute('stroke-width', 2);
          svg.appendChild(ln);
        }
      });

      const lab = document.createElement('div');
      lab.className = 'bar-label';
      lab.textContent = '第 ' + (r + 1) + ' 行';
      wrap.appendChild(lab);
      wrap.appendChild(svg);
      box.appendChild(wrap);
    }

    const hint = document.createElement('div');
    hint.className = 'pattern-box';
    hint.textContent = song.note || '';
    box.appendChild(hint);
    return box;
  }

  function renderSongbook(song) {
    const box = document.createElement('div');
    song.sections.forEach((sec) => {
      const lab = document.createElement('div');
      lab.className = 'section-label';
      lab.textContent = sec.label;
      box.appendChild(lab);
      const line = document.createElement('div');
      line.className = 'chord-line';
      sec.bars.forEach((c) => {
        const d = document.createElement('div');
        d.className = 'bar';
        d.textContent = c;
        line.appendChild(d);
      });
      box.appendChild(line);
    });
    const p = document.createElement('div');
    p.className = 'pattern-box';
    p.innerHTML = `<b style="color:var(--wood2)">建议节奏型：</b>${song.pattern}<br><b style="color:var(--wood2)">提示：</b>${song.tip}`;
    box.appendChild(p);
    return box;
  }

  /* ---------- 听一遍 ---------- */
  $('#btnDemo').addEventListener('click', async function () {
    if (!currentSong || currentKind !== 'melody') {
      alert('弹唱谱先跟节拍器练和弦；单音旋律可以听示范。');
      return;
    }
    await A.ensureCtx();
    const data = buildNotes(currentSong);
    const beatSec = 60 / currentSong.bpm;
    const t0 = A.ctx.currentTime + 0.25;
    data.notes.forEach(function (ev) {
      A.playTone(A.midiToFreq(ev.midi), Math.max(0.12, ev.dur * beatSec * 0.92), t0 + ev.beat * beatSec);
    });
    $('#scoreBar').textContent = '正在播放示范…';
    const total = (data.totalBeats * beatSec + 1) * 1000;
    setTimeout(function () { $('#scoreBar').textContent = '准确率 —'; }, total);
  });

  $('#btnStop').addEventListener('click', () => {
    stopAll();
    $('#scoreBar').textContent = '已停止';
  });

  /* ---------- 跟练 ---------- */
  $('#btnPractice').addEventListener('click', async () => {
    if (!currentSong) return;
    await A.ensureCtx();
    if (!micOn) {
      try { await A.start(); micOn = true; micBtn.textContent = '麦克风已开'; micBtn.classList.add('on'); }
      catch (e) { alert('跟练需要麦克风权限。'); return; }
    }
    stopAll();
    stopFlag = false;
    if (currentKind === 'melody') practiceMelody(currentSong);
    else practiceSongbook(currentSong);
  });

  function practiceMelody(song) {
    const all = buildNotes(song).notes;
    if (!all.length) return;
    const beatSec = 60 / song.bpm;
    let hitCount = 0;
    const judged = new Map();
    const t0 = A.ctx.currentTime + 0.9;

    A.Metro.bpm = song.bpm;
    A.Metro.beatsPerBar = song.meter || 4;
    A.Metro.start();

    const frameOff = A.onFrame(function (f) {
      if (stopFlag) return;
      if (!f.midi || f.clarity < 0.55) return;
      const cur = (A.ctx.currentTime - t0) / beatSec;
      for (let i = 0; i < all.length; i++) {
        const ev = all[i];
        if (judged.has(ev.id)) continue;
        const rel = cur - ev.beat;
        if (rel < -0.45 || rel > ev.dur + 0.35) continue;
        if (Math.abs(f.midi - ev.midi) < 0.62) {
          judged.set(ev.id, 'hit');
          hitCount++;
          const el = document.getElementById('n-' + ev.id);
          if (el) { el.classList.remove('now'); el.classList.add('hit'); }
          updateScore(hitCount, all.length);
          return;
        }
      }
    });

    const tick = function () {
      if (stopFlag) return;
      const cur = (A.ctx.currentTime - t0) / beatSec;
      const last = all[all.length - 1];
      if (cur > last.beat + last.dur + 2) { finish(); return; }
      let curEv = null;
      for (let i = 0; i < all.length; i++) {
        const ev = all[i];
        if (cur >= ev.beat - 0.08 && cur < ev.beat + Math.max(0.35, ev.dur)) { curEv = ev; break; }
      }
      document.querySelectorAll('.note-num.now').forEach(function (e) { e.classList.remove('now'); });
      if (curEv && !judged.has(curEv.id)) {
        const el = document.getElementById('n-' + curEv.id);
        if (el) el.classList.add('now');
      }
      practiceTimer = setTimeout(tick, 40);
    };
    tick();

    function finish() {
      frameOff();
      A.Metro.stop();
      const acc = Math.round((hitCount / all.length) * 100);
      $('#scoreBar').textContent = '准确率 ' + acc + '%（' + hitCount + '/' + all.length + ' 音）';
      if (acc >= 60) {
        Store.data.cleared[song.id] = Math.max(Store.data.cleared[song.id] || 0, acc);
        Store.save();
        renderSongList();
      }
      all.forEach(function (ev) {
        if (!judged.has(ev.id)) {
          const el = document.getElementById('n-' + ev.id);
          if (el) el.classList.add('miss');
        }
      });
      stopFlag = true;
    }
  }

  function updateScore(hit, total) {
    $('#scoreBar').textContent = `准确率 ${Math.round((hit / total) * 100)}%（${hit}/${total}）`;
  }

  function practiceSongbook(song) {
    const beatSec = 60 / song.bpm;
    const bars = [];
    song.sections.forEach((sec) => sec.bars.forEach((c) => bars.push({ chord: c, sec: sec.label })));
    const barBeats = song.meter || 4;
    const totalBeats = bars.length * barBeats;

    A.Metro.bpm = song.bpm;
    A.Metro.beatsPerBar = barBeats;
    const t0 = A.ctx.currentTime + 0.6;
    A.Metro.start();

    let strums = [];       // 检测到的扫弦时刻（拍）
    let lastRms = 0;
    let lastOnset = -1;

    const frameOff = A.onFrame((f) => {
      if (stopFlag) return;
      const cur = (A.ctx.currentTime - t0) / beatSec;
      const rising = f.rms > 0.02 && f.rms > lastRms * 1.8;
      if (rising && cur - lastOnset > 0.18) {
        lastOnset = cur;
        strums.push(cur);
        $$('.bar').forEach((el) => el.classList.remove('now'));
        const bi = Math.floor(cur / barBeats);
        const el = $$('.bar')[bi];
        if (el) el.classList.add('now');
      }
      lastRms = f.rms;
    });

    const tick = () => {
      if (stopFlag) return;
      const cur = (A.ctx.currentTime - t0) / beatSec;
      if (cur > totalBeats + 1) { finish(); return; }
      const bi = Math.floor(cur / barBeats);
      const bars_ = $$('.bar');
      bars_.forEach((el, i) => el.classList.toggle('now', i === bi));
      $('#scoreBar').textContent = `第 ${Math.min(bars.length, bi + 1)}/${bars.length} 小节 · ${bars[Math.min(bars.length - 1, bi)].chord}`;
      practiceTimer = setTimeout(tick, 60);
    };
    tick();

    function finish() {
      frameOff();
      A.Metro.stop();
      // 每小节是否有一次扫弦落点
      const perBar = new Array(bars.length).fill(0);
      strums.forEach((s) => {
        const bi = Math.floor(s / barBeats);
        if (bi >= 0 && bi < bars.length) perBar[bi]++;
      });
      const okBars = perBar.filter((n) => n > 0).length;
      const pct = Math.round((okBars / bars.length) * 100);
      $('#scoreBar').textContent = `完成 ${pct}% 小节（${okBars}/${bars.length}）· 共 ${strums.length} 次扫弦`;
      if (pct >= 70) {
        Store.data.cleared[song.id] = Math.max(Store.data.cleared[song.id] || 0, pct);
        Store.save();
        renderSongList();
      }
      stopFlag = true;
    }
  }

  /* ================= 和弦 ================= */
  let activeChord = null;

  function buildStarter() {
    const row = $('#starterRow');
    row.innerHTML = '';
    D.STARTER_CHORDS.forEach((c) => {
      const d = document.createElement('div');
      d.className = 'chip';
      d.dataset.c = c;
      d.textContent = c;
      d.addEventListener('click', () => selectChord(c));
      row.appendChild(d);
    });
  }
  buildStarter();

  function buildChordGrid() {
    const grid = $('#chordGrid');
    grid.innerHTML = '';
    D.EASY_ORDER.forEach((c) => {
      const info = D.CHORDS[c];
      if (!info) return;
      const cell = document.createElement('div');
      cell.className = 'chord-cell' + (info.hard ? ' hard' : '');
      cell.dataset.c = c;
      cell.appendChild(chordDiagramSVG(c, 54));
      const nm = document.createElement('div');
      nm.className = 'cname';
      nm.textContent = c;
      cell.appendChild(nm);
      cell.addEventListener('click', () => selectChord(c));
      grid.appendChild(cell);
    });
  }

  function chordDiagramSVG(name, w, showFretNum) {
    const frets = D.CHORDS[name].frets;
    const padL = w * 0.17, padR = w * 0.05;
    const top = w * 0.26;
    const gapX = (w - padL - padR) / 5;
    const fretH = w * 0.155;
    const bottom = top + fretH * 4;
    const H = bottom + w * 0.13;

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + H);
    svg.setAttribute('width', w);
    svg.setAttribute('height', H);

    // 弦（左 6 弦 → 右 1 弦）
    for (let i = 0; i < 6; i++) {
      const x = padL + i * gapX;
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', x); l.setAttribute('x2', x);
      l.setAttribute('y1', top); l.setAttribute('y2', bottom);
      l.setAttribute('stroke', '#5a4736');
      l.setAttribute('stroke-width', i === 0 || i === 5 ? 1.6 : 1);
      svg.appendChild(l);
    }
    // 品丝
    for (let i = 0; i <= 4; i++) {
      const y = top + i * fretH;
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', padL); l.setAttribute('x2', padL + 5 * gapX);
      l.setAttribute('y1', y); l.setAttribute('y2', y);
      l.setAttribute('stroke', i === 0 ? '#c99055' : '#5a4736');
      l.setAttribute('stroke-width', i === 0 ? 2.4 : 1);
      svg.appendChild(l);
    }
    // 品号
    if (showFretNum) {
      [1, 2, 3].forEach(function (n) {
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', padL - w * 0.055);
        t.setAttribute('y', top + (n - 0.55) * fretH);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', '#6b5d4d');
        t.setAttribute('font-size', w * 0.075);
        t.textContent = n;
        svg.appendChild(t);
      });
    }
    // 按点
    frets.forEach(function (f, idx) {
      const x = padL + idx * gapX;
      if (f > 0) {
        const y = top + (f - 0.5) * fretH;
        const c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', y);
        c.setAttribute('r', Math.min(4.6, gapX * 0.34));
        c.setAttribute('fill', '#e8a04c');
        svg.appendChild(c);
      } else if (f === 0) {
        const c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', top - w * 0.075);
        c.setAttribute('r', Math.min(3.2, gapX * 0.24));
        c.setAttribute('fill', 'none');
        c.setAttribute('stroke', '#8a775f');
        c.setAttribute('stroke-width', 1.3);
        svg.appendChild(c);
      } else {
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', top - w * 0.045);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', '#6b5d4d');
        t.setAttribute('font-size', w * 0.085);
        t.textContent = '×';
        svg.appendChild(t);
      }
    });
    return svg;
  }

  buildChordGrid();

  function selectChord(name) {
    activeChord = name;
    $$('.starter-row .chip').forEach((e) => e.classList.toggle('on', e.dataset.c === name));
    $$('.chord-cell').forEach((e) => e.classList.toggle('on', e.dataset.c === name));
    const body = $('#sheetBody');
    body.innerHTML = '';
    const info = D.CHORDS[name];
    const card = document.createElement('div');
    card.className = 'chord-diagram';
    const head = document.createElement('div');
    head.className = 'cd-head';
    head.innerHTML = `<div class="cd-name">${name}</div><div style="font-size:12px;color:var(--dim)">6弦 → 1弦</div>`;
    card.appendChild(head);
    const bigWrap = document.createElement('div');
    bigWrap.style.textAlign = 'center';
    const big = chordDiagramSVG(name, 170, true);
    big.style.margin = '0 auto';
    big.style.display = 'block';
    bigWrap.appendChild(big);
    card.appendChild(bigWrap);
    const tip = document.createElement('div');
    tip.className = 'cd-tip';
    tip.textContent = info.tip;
    card.appendChild(tip);
    // 逐弦检查
    const btn = document.createElement('button');
    btn.className = 'btn main';
    btn.style.width = '100%';
    btn.style.marginTop = '14px';
    btn.textContent = '逐弦检查（一根一根拨）';
    card.appendChild(btn);
    const checks = document.createElement('div');
    checks.className = 'str-check';
    checks.id = 'strCheck';
    card.appendChild(checks);
    body.appendChild(card);

    $('#sheetTitle').textContent = `和弦 ${name}`;
    $('#sheetMeta').textContent = info.hard ? '横按和弦 · 先按实 1 品再拨' : '按好之后逐弦拨，看每根弦准不准';
    sheet.classList.add('on');

    btn.addEventListener('click', () => runStringCheck(name, checks));
  }

  let checkState = null;
  let checkOff = null;

  async function runStringCheck(name, wrap) {
    const frets = D.CHORDS[name].frets;
    const strings = [];
    frets.forEach((f, i) => {
      const s = 6 - i;
      if (f >= 0) strings.push({ s, fret: f, midi: D.OPEN_MIDI[s] + f });
    });
    wrap.innerHTML = strings.map((x) => `<div data-s="${x.s}">${x.s}弦</div>`).join('');

    // 关键：没开麦就先把麦开上，否则等于什么都没在听
    if (!micOn) {
      $('#scoreBar').textContent = '正在开启麦克风…';
      try {
        await A.start();
        micOn = true;
        micBtn.textContent = '麦克风已开';
        micBtn.classList.add('on');
      } catch (e) {
        $('#scoreBar').textContent = '麦克风没开成，检查浏览器权限';
        alert('逐弦检查要听声音，需要麦克风权限。\n请点右上角「开启麦克风」，允许后再试。\n' + e.message);
        return;
      }
    }

    if (checkOff) { checkOff(); checkOff = null; }
    const state = { idx: 0, list: strings, streak: 0, gotAny: false };
    checkState = state;
    $('#scoreBar').textContent = `正在听… 请拨 ${strings[0].s} 弦（目标 ${A.midiName(strings[0].midi)}）`;
    setTimeout(function () {
      if (checkState === state && !state.gotAny) {
        $('#scoreBar').textContent = '没听到声音：确认浏览器已允许麦克风、拨弦别太轻，再点一次';
      }
    }, 3500);

    checkOff = A.onFrame(function (fr) {
      if (checkState !== state) return;
      if (fr.midi && fr.clarity >= 0.45) state.gotAny = true;
      if (!fr.midi || fr.clarity < 0.45 || fr.rms < 0.004) return;
      const cur = state.list[state.idx];
      if (!cur) return;
      const box = wrap.querySelector(`[data-s="${cur.s}"]`);
      if (!box) return;
      const diff = Math.abs(fr.midi - cur.midi);

      if (diff < 0.8) {
        state.streak++;
        $('#scoreBar').textContent = `${cur.s}弦 ${A.midiName(fr.midiRounded)} ✓`;
        if (state.streak < 2) return;  // 连续两帧确认，防毛刺误判
        box.className = 'ok';
        box.textContent = `${cur.s}弦 ✓`;
        state.idx++;
        state.streak = 0;
        if (state.idx >= state.list.length) {
          $('#scoreBar').textContent = '全部按对了 ✓ 这个和弦可以用了';
          Store.data.chords[name] = true;
          Store.save();
          checkOff();
          checkOff = null;
          checkState = null;
        } else {
          const nx = state.list[state.idx];
          $('#scoreBar').textContent = `接着拨 ${nx.s} 弦（目标 ${A.midiName(nx.midi)}）`;
        }
        return;
      }

      state.streak = 0;
      if (diff < 4) {
        box.className = 'bad';
        box.textContent = `${A.midiName(fr.midiRounded)} ✗`;
        $('#scoreBar').textContent = `听到 ${A.midiName(fr.midiRounded)}，要的是 ${A.midiName(cur.midi)}（${cur.s}弦 ${cur.fret}品）`;
        setTimeout(function () {
          if (box && box.className === 'bad') { box.className = ''; box.textContent = `${cur.s}弦`; }
        }, 1200);
      }
    });
  }

  /* ================= 节奏 ================= */
  const bpmRange = $('#bpmRange');
  const bpmNum = $('#bpmNum');
  const metroBtn = $('#metroBtn');
  const beatDots = $('#beatDots');

  bpmRange.addEventListener('input', () => {
    bpmNum.textContent = bpmRange.value;
    A.Metro.bpm = Number(bpmRange.value);
    renderDots();
  });
  $$('#meterSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#meterSeg button').forEach((x) => x.classList.toggle('on', x === b));
      A.Metro.beatsPerBar = Number(b.dataset.v);
      renderDots();
    });
  });
  $$('#subSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#subSeg button').forEach((x) => x.classList.toggle('on', x === b));
      A.Metro.subdivision = Number(b.dataset.v);
      renderDots();
    });
  });

  function renderDots() {
    const n = A.Metro.beatsPerBar;
    beatDots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i === 0 ? 'down' : ''}"></i>`).join('');
  }
  renderDots();

  metroBtn.addEventListener('click', async () => {
    await A.ensureCtx();
    if (A.Metro.running) {
      A.Metro.stop();
      metroBtn.textContent = '开始';
      metroBtn.classList.remove('main');
      $$('#beatDots i').forEach((d) => d.classList.remove('on'));
      return;
    }
    A.Metro.bpm = Number(bpmRange.value);
    A.Metro.onBeat = (bi) => {
      const n = A.Metro.beatsPerBar;
      const dots = $$('#beatDots i');
      dots.forEach((d) => d.classList.remove('on'));
      const idx = bi % n;
      if (dots[idx]) dots[idx].classList.add('on');
    };
    A.Metro.start();
    metroBtn.textContent = '停止';
    metroBtn.classList.add('main');
  });

  /* ================= 进度 ================= */
  /* ================= 乐理 ================= */
  let theoryBuilt = false;
  function renderTheory() {
    if (theoryBuilt) return;
    theoryBuilt = true;
    const toc = $('#thyToc');
    const list = $('#thyList');
    D.THEORY.forEach(function (t, i) {
      const chip = document.createElement('button');
      chip.className = 'thy-chip';
      chip.textContent = t.icon + ' ' + t.title;
      chip.addEventListener('click', function () {
        const el = document.getElementById('thy-' + t.id);
        if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
      toc.appendChild(chip);

      const d = document.createElement('details');
      d.className = 'thy-card';
      d.id = 'thy-' + t.id;
      if (i === 0) d.open = true;
      const s = document.createElement('summary');
      s.innerHTML = '<span class="ic">' + t.icon + '</span><span>' + t.title + '</span>';
      d.appendChild(s);
      const body = document.createElement('div');
      body.className = 'thy-body';
      body.innerHTML = t.html;
      d.appendChild(body);
      list.appendChild(d);
    });
  }

  function renderProgress() {
    const cleared = Store.data.cleared;
    const count = Object.keys(cleared).length;
    const totalSongs = D.MELODIES.length + D.SONGBOOK.length;
    const chordCount = Object.keys(Store.data.chords || {}).length;
    $('#statRow').innerHTML = `
      <div class="stat"><b>${count}</b><span>通过曲目 / ${totalSongs}</span></div>
      <div class="stat"><b>${chordCount}</b><span>按对的和弦</span></div>
      <div class="stat"><b>${Store.data.streak || 1}</b><span>连续天数</span></div>`;

    // 关卡解锁判定
    const melodyCleared75 = D.MELODIES.filter((s) => (cleared[s.id] || 0) >= 75).length;
    const starterDone = D.STARTER_CHORDS.every((c) => Store.data.chords[c]);
    const lvlOpen = [
      true,
      melodyCleared75 >= 1,
      starterDone,
      starterDone && count >= 3,
      (cleared['sb'] || cleared['cd'] || cleared['hkkt'] || 0) >= 70,
    ];
    const list = $('#levelList');
    list.innerHTML = '';
    D.LEVELS.forEach((lv, i) => {
      const open = lvlOpen[i];
      const div = document.createElement('div');
      div.className = 'level' + (open ? ' open' : '');
      div.innerHTML = `
        <div class="h"><div class="t">${lv.id}. ${lv.name}</div><div class="tag">${open ? '已解锁' : '未解锁'}</div></div>
        <div class="d">${lv.desc}</div>
        <div class="r">${open ? '✓ ' + lv.req : lv.req}</div>`;
      list.appendChild(div);
    });
  }
  $('#resetLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('清空所有练习记录？')) Store.clear();
  });

  /* 初始 */
  route('tuner');
})();

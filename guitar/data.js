/* ============ 拾光吉他 · 数据层 ============ */

// 标准调弦：6 弦（最粗）→ 1 弦（最细）
const TUNING = [
  { s: 6, name: 'E', oct: 2, freq: 82.41, midi: 40, label: '6弦 低音E' },
  { s: 5, name: 'A', oct: 2, freq: 110.00, midi: 45, label: '5弦 A' },
  { s: 4, name: 'D', oct: 3, freq: 146.83, midi: 50, label: '4弦 D' },
  { s: 3, name: 'G', oct: 3, freq: 196.00, midi: 55, label: '3弦 G' },
  { s: 2, name: 'B', oct: 3, freq: 246.94, midi: 59, label: '2弦 B' },
  { s: 1, name: 'E', oct: 4, freq: 329.63, midi: 64, label: '1弦 高音E' },
];

// 空弦 midi（下标 0 = 6 弦）
const OPEN_MIDI = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };

// 常用和弦：从 6 弦到 1 弦，-1 = 不弹，0 = 空弦
const CHORDS = {
  C:    { frets: [-1, 3, 2, 0, 1, 0], tip: '无名指 5 弦 3 品，中指 4 弦 2 品，食指 2 弦 1 品' },
  G:    { frets: [3, 2, 0, 0, 0, 3],   tip: '中指 5 弦 2 品，无名指 6 弦 3 品，小指 1 弦 3 品' },
  Am:   { frets: [-1, 0, 2, 2, 1, 0],  tip: '食指 2 弦 1 品，中指 4 弦 2 品，无名指 3 弦 2 品' },
  Em:   { frets: [0, 2, 2, 0, 0, 0],   tip: '中指 5 弦 2 品，无名指 4 弦 2 品' },
  F:    { frets: [1, 3, 3, 2, 1, 1],   tip: '大横按：食指横压 1 品，无名指 5 弦 3 品，小指 4 弦 3 品，中指 3 弦 2 品', hard: true },
  Dm:   { frets: [-1, -1, 0, 2, 3, 1], tip: '食指 1 弦 1 品，中指 3 弦 2 品，无名指 2 弦 3 品' },
  D:    { frets: [-1, -1, 0, 2, 3, 2], tip: '食指 3 弦 2 品，中指 1 弦 2 品，无名指 2 弦 3 品' },
  A:    { frets: [-1, 0, 2, 2, 2, 0],  tip: '食指 4 弦 2 品，中指 3 弦 2 品，无名指 2 弦 2 品' },
  E:    { frets: [0, 2, 2, 1, 0, 0],   tip: '食指 3 弦 1 品，中指 5 弦 2 品，无名指 4 弦 2 品' },
  G7:   { frets: [3, 2, 0, 0, 0, 1],   tip: '在 G 的基础上，食指加按 1 弦 1 品' },
  C7:   { frets: [-1, 3, 2, 3, 1, 0],  tip: '在 C 的基础上，小指加按 3 弦 3 品' },
  Am7:  { frets: [-1, 0, 2, 0, 1, 0],  tip: 'Am 松开无名指' },
  Em7:  { frets: [0, 2, 0, 0, 0, 0],   tip: 'Em 松开 4 弦' },
  Dm7:  { frets: [-1, -1, 0, 2, 1, 1], tip: '食指横按 1、2 弦 1 品，中指 3 弦 2 品' },
  Fmaj7:{ frets: [-1, -1, 3, 2, 1, 0], tip: 'F 的省力版，不横按，适合新手' },
  Dsus4:{ frets: [-1, -1, 0, 2, 3, 3], tip: 'D 把小指加到 1 弦 3 品' },
};

// 新手最先要拿下的四个和弦
const STARTER_CHORDS = ['Em', 'Am', 'C', 'G'];
const EASY_ORDER = ['Em', 'Am', 'C', 'G', 'D', 'A', 'E', 'Dm', 'G7', 'C7', 'Am7', 'Em7', 'Fmaj7', 'Dm7', 'F', 'D', 'Dsus4'];

/* ---------- 简谱解析 ----------
   token: 1-7 数字，后缀 ' = 升八度，, = 降八度
          _ = 八分音符（0.5 拍），__ = 十六分（0.25 拍）
          - = 延长上一音一拍，0 = 休止一拍，0_ = 休止半拍
          | = 小节线（仅视觉）
   默认 1 = C3（5 弦 3 品），1' = C4（2 弦 1 品）
*/
const DEGREE_SEMITONE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };

function jianpuToMidi(token) {
  let t = token;
  let octShift = 0;
  if (t.endsWith("'")) { octShift = 12; t = t.slice(0, -1); }
  else if (t.endsWith(',')) { octShift = -12; t = t.slice(0, -1); }
  const d = parseInt(t[0], 10);
  if (!d || !(d in DEGREE_SEMITONE)) return null;
  return 48 + DEGREE_SEMITONE[d] + octShift; // 48 = C3
}

// midi → 第一把位最优指法
function midiToFret(midi) {
  let best = null;
  for (let s = 6; s >= 1; s--) {
    const fret = midi - OPEN_MIDI[s];
    if (fret < 0 || fret > 12) continue;
    const score = fret * 10 + (6 - s) * 0.5; // 品位优先，同品位偏好粗弦
    if (!best || score < best.score) best = { string: s, fret, score };
  }
  return best ? { string: best.string, fret: best.fret } : null;
}

// 解析成事件流：{kind:'note'|'rest', midi, string, fret, beat, dur, bar}
function parseJianpu(src, beatsPerBar) {
  const bpb = beatsPerBar || 4;
  const tokens = src.replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
  const events = [];
  let beat = 0;
  let bar = 0;
  let lastNote = null;
  for (const raw of tokens) {
    if (raw === '|') { bar++; continue; }
    if (raw === '-') {
      if (lastNote) { lastNote.dur += 1; }
      else { events.push({ kind: 'rest', beat, dur: 1, bar }); lastNote = null; }
      beat += 1;
      continue;
    }
    let t = raw;
    let dur = 1;
    if (t.endsWith('__')) { dur = 0.25; t = t.slice(0, -2); }
    else if (t.endsWith('_')) { dur = 0.5; t = t.slice(0, -1); }
    if (t === '0') {
      events.push({ kind: 'rest', beat, dur, bar });
      beat += dur; lastNote = null; continue;
    }
    const midi = jianpuToMidi(t);
    if (midi == null) continue;
    const pos = midiToFret(midi);
    const ev = { kind: 'note', midi, string: pos.string, fret: pos.fret, beat, dur, bar, token: raw };
    events.push(ev);
    lastNote = ev;
    beat += dur;
  }
  return { events, totalBeats: beat };
}

/* ---------- 旋律曲谱 ---------- */
const MELODIES = [
  {
    id: 'xxs', name: '小星星', level: 1, bpm: 80, meter: 4, key: 'C',
    chords: ['C', 'F', 'G'],
    note: '第一首完整的单音曲，全在 5 弦到 3 弦之间，适合熟悉拨弦',
    jianpu: `1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 - |
             5 5 4 4 | 3 3 2 - | 5 5 4 4 | 3 3 2 - |
             1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 -`,
  },
  {
    id: 'lzh', name: '两只老虎', level: 1, bpm: 92, meter: 4, key: 'C',
    chords: ['C', 'G'],
    note: '含八分音符，练右手交替拨弦',
    jianpu: `1 2 3 1 | 1 2 3 1 | 3 4 5 - | 3 4 5 - |
             5_ 6_ 5_ 4_ 3 1 | 5_ 6_ 5_ 4_ 3 1 | 1 5, 1 - | 1 5, 1 -`,
  },
  {
    id: 'srk', name: '生日歌', level: 1, bpm: 88, meter: 4, key: 'C',
    chords: ['C', 'G', 'F'],
    note: '会用到 1 弦的音，注意 1 弦音准偏细，拨轻一点',
    jianpu: `5_ 5_ 6 5 1' | 7 - - - | 5_ 5_ 6 5 2' | 1' - - - |
             5_ 5_ 5' 3' 1' | 7 6 - - | 4'_ 4'_ 3' 1' 2' | 1' - - -`,
  },
  {
    id: 'hls', name: '欢乐颂', level: 2, bpm: 96, meter: 4, key: 'C',
    chords: ['C', 'F', 'G'],
    note: '贝多芬第九，音阶上下行，练连贯',
    jianpu: `3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3_ 2_ 2 - |
             3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 2_ 1_ 1 -`,
  },
  {
    id: 'mlh', name: '茉莉花', level: 2, bpm: 76, meter: 4, key: 'C',
    chords: ['C', 'Am', 'F', 'G'],
    note: '江苏民歌，练长音与呼吸感（此处为简化教学谱）',
    jianpu: `3 3 5 6 | 1'_ 1'_ 6 5 | 5 6 5 - | 3 3 5 6 |
             1'_ 1'_ 6 5 | 5 6 5 - | 5 5 5 3 5 | 6 6 5 -`,
  },
  {
    id: 'sb', name: '送别（长亭外）', level: 3, bpm: 72, meter: 4, key: 'C',
    chords: ['C', 'G', 'Am', 'Em', 'F', 'Dm'],
    note: '李叔同填词，旋律跨度大，练换把前的第一把位极限',
    jianpu: `5 3 5 1' | 7 6 5 - | 5 1 2 3 | 2 - - - |
             5 3 5 1' | 7 6 5 - | 5 2 3 4 | 7, - - - |
             6 1 1 7 | 6 7 5 - | 6 1 1 7 | 6 7 5 - |
             5 3 5 1' | 7 6 5 - | 5 2 3 4 | 7, - - -`,
  },
  {
    id: 'scale', name: 'C 大调音阶（练习）', level: 1, bpm: 70, meter: 4, key: 'C',
    chords: [],
    note: '每天两分钟，从 5 弦 3 品一路到 1 弦 3 品再回来',
    jianpu: `1 2 3 4 5 6 7 1' | 2' 3' 4' 5' 4' 3' 2' 1' |
             7 6 5 4 3 2 1 0 | 0 0 0 0 0 0 0 0`,
  },
  {
    id: 'spider', name: '蜘蛛爬格子（练习）', level: 2, bpm: 60, meter: 4, key: 'C',
    chords: [],
    note: '左手四指依次按 1-2-3-4 品，右手交替拨弦，练手指独立',
    jianpu: `1 1 1 1 | 1 1 1 1 | 2 2 2 2 | 2 2 2 2 |
             3 3 3 3 | 3 3 3 3 | 5 5 5 5 | 5 5 5 5`,
    custom: true,
  },
];

/* ---------- 弹唱谱（和弦进行 + 段落） ----------
   pattern: 建议节奏型
   sections: [{label, bars:['C','G','Am','F']}]
*/
const SONGBOOK = [
  {
    id: 'cef', name: '虫儿飞', level: 1, bpm: 76, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'Em', 'F', 'Dm'],
    pattern: '下 下上 上下上（一个和弦两小节）',
    tip: '主歌全是 C-G-Am-Em 循环，副歌才进 F，先练主歌',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'Em', 'C', 'G', 'Am', 'Em'] },
      { label: '副歌', bars: ['F', 'C', 'Dm', 'G', 'F', 'C', 'G', 'C'] },
    ],
  },
  {
    id: 'sb2', name: '送别（弹唱版）', level: 2, bpm: 72, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'Em', 'F', 'Dm'],
    pattern: '分解：5-3-2-3-1-3-2-3',
    tip: '每小节一个和弦，四拍一换，慢比快重要',
    sections: [
      { label: 'A 段', bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G'] },
      { label: 'B 段', bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'G', 'C'] },
    ],
  },
  {
    id: 'tn', name: '童年', level: 2, bpm: 100, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'F'],
    pattern: '下 下上 上下上',
    tip: '万能四和弦，练熟这首等于打开一大片歌',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'] },
      { label: '副歌', bars: ['F', 'G', 'C', 'Am', 'F', 'G', 'C', 'C'] },
    ],
  },
  {
    id: 'yl', name: '月亮代表我的心', level: 2, bpm: 72, key: 'C', meter: 4,
    chords: ['C', 'Em', 'F', 'G', 'Am', 'Dm'],
    pattern: '分解：根音-3-2-3-1-3-2-3',
    tip: '三拍子感，别弹太满，留白',
    sections: [
      { label: 'A 段', bars: ['C', 'Em', 'F', 'G', 'C', 'Em', 'F', 'G'] },
      { label: 'B 段', bars: ['Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'C'] },
    ],
  },
  {
    id: 'th', name: '童话', level: 2, bpm: 84, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'Em', 'F'],
    pattern: '下 下上 上下上',
    tip: '和虫儿飞几乎同一套和弦，可以串着练',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'] },
      { label: '副歌', bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'] },
    ],
  },
  {
    id: 'cd', name: '成都', level: 3, bpm: 88, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'F', 'Em', 'Dm'],
    pattern: '下 下 下上 上下上',
    tip: '前奏有分解，副歌扫弦，先只弹和弦走向',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'] },
      { label: '副歌', bars: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'] },
    ],
  },
  {
    id: 'pfzl', name: '平凡之路', level: 3, bpm: 92, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'F'],
    pattern: '下 下上 上下上',
    tip: '全曲就四个和弦，考验的是稳定',
    sections: [
      { label: '全曲', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'] },
    ],
  },
  {
    id: 'hkkt', name: '海阔天空（简化）', level: 3, bpm: 80, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'F'],
    pattern: '下 下 下上 上下上',
    tip: '原调更高，这里用 C 调降难度，先求完整',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'F'] },
      { label: '副歌', bars: ['F', 'G', 'C', 'Am', 'F', 'G', 'C', 'C'] },
    ],
  },
  {
    id: 'zdan', name: '真的爱你', level: 3, bpm: 88, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'F'],
    pattern: '下 下上 上下上',
    tip: '四和弦到底，跟上节拍就成',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'F'] },
    ],
  },
  {
    id: 'zz', name: '知足', level: 2, bpm: 76, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'F'],
    pattern: '分解：5-3-2-3-1-3-2-3',
    tip: '慢歌更要稳，每个音都要出声',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'F'] },
    ],
  },
  {
    id: 'hl', name: '后来', level: 3, bpm: 84, key: 'C', meter: 4,
    chords: ['C', 'G', 'Am', 'Em', 'F', 'Dm'],
    pattern: '下 下上 上下上',
    tip: '副歌有 F，横按按不实就先换成 Fmaj7',
    sections: [
      { label: '主歌', bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G'] },
      { label: '副歌', bars: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'] },
    ],
  },
  {
    id: 'xxs2', name: '小星星（弹唱版）', level: 1, bpm: 76, key: 'C', meter: 4,
    chords: ['C', 'F', 'G'],
    pattern: '下 下上',
    tip: '最简单的弹唱入门，一个和弦两小节',
    sections: [
      { label: '全曲', bars: ['C', 'C', 'F', 'C', 'F', 'C', 'G', 'C'] },
    ],
  },
];

/* ---------- 关卡（按水平递进解锁） ---------- */
const LEVELS = [
  { id: 1, name: '起步：认弦与单音', desc: '调准弦、认准 6 根弦、弹出干净的单音', req: '完成调音 + 小星星命中 60%' },
  { id: 2, name: '入门：第一把位与八分音符', desc: '音阶上下行、两只老虎这种节拍', req: '解锁：完成 1 首 L1 曲子 75%' },
  { id: 3, name: '进阶：四个和弦', desc: 'Em Am C G 按实、换得动', req: '解锁：和弦检查全部按对' },
  { id: 4, name: '弹唱：四和弦循环', desc: '每小节换一次不卡顿', req: '解锁：60 BPM 四和弦循环两圈' },
  { id: 5, name: '完整曲目', desc: '带 F 的歌，扫弦节奏型', req: '解锁：完成 1 首 L3 曲子 70%' },
];

window.GT_DATA = { TUNING, OPEN_MIDI, CHORDS, STARTER_CHORDS, EASY_ORDER, MELODIES, SONGBOOK, LEVELS, parseJianpu, midiToFret, jianpuToMidi };

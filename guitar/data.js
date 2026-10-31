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

/* ---------- 乐理速查 ---------- */
const THEORY = [
  {
    id: 'readtab', icon: '🎼', title: '怎么看六线谱（TAB）',
    html: `
      <p>TAB 不是音高谱，它是<b>手指地图</b>：告诉你哪根弦、第几品，不告诉你这个音叫什么。</p>
      <svg viewBox="0 0 330 108" style="max-width:100%;height:auto;margin:6px 0">
        <g stroke="#5a4736" stroke-width="1">
          <line x1="62" y1="22" x2="310" y2="22"/>
          <line x1="62" y1="34" x2="310" y2="34"/>
          <line x1="62" y1="46" x2="310" y2="46"/>
          <line x1="62" y1="58" x2="310" y2="58"/>
          <line x1="62" y1="70" x2="310" y2="70"/>
          <line x1="62" y1="82" x2="310" y2="82"/>
        </g>
        <g fill="#9a8b78" font-size="9">
          <text x="34" y="25">1弦</text>
          <text x="34" y="61">4弦</text>
          <text x="34" y="85">6弦</text>
        </g>
        <g fill="#17120e">
          <rect x="93" y="60" width="14" height="13"/>
          <rect x="143" y="60" width="14" height="13"/>
          <rect x="193" y="38" width="14" height="13"/>
          <rect x="243" y="38" width="14" height="13"/>
        </g>
        <g fill="#efe6d8" font-size="12" font-weight="bold" text-anchor="middle" font-family="monospace">
          <text x="100" y="71">3</text>
          <text x="150" y="71">3</text>
          <text x="200" y="49">0</text>
          <text x="250" y="49">0</text>
        </g>
        <text x="66" y="100" fill="#e8a04c" font-size="9">上面是 1 弦（最细），最下面这条是 6 弦（最粗）</text>
      </svg>
      <ul>
        <li><b>六条横线 = 六根弦</b>，最上面是 1 弦（最细），最下面是 6 弦（最粗）。这个方向千万别记反。</li>
        <li><b>数字 = 左手按第几品</b>。写在 5 弦上的 “3”，就是左手按 5 弦 3 品，右手拨 5 弦。</li>
        <li><b>0 = 空弦</b>，左手什么都不按，直接拨那根弦。</li>
        <li><b>同一纵列的数字 = 同时弹</b>（和弦或双音），从上往下依次排开。</li>
        <li><b>竖线 = 小节线</b>，数字下面的短横线 = 八分音符（比前一个快一倍）。</li>
        <li>读的方向：从左往右，一行读完接下一行。</li>
      </ul>
      <p><b>TAB 的短板：它不告诉你节奏。</b>所以本页的谱都是 TAB 加节拍器一起用，或者对照上面的简谱。</p>`,
  },
  {
    id: 'readjianpu', icon: '🔢', title: '怎么看简谱',
    html: `
      <p>简谱管<b>音高和节奏</b>，TAB 管<b>手指位置</b>，两个配着看最快。</p>
      <table class="thy">
        <tr><th>写法</th><th>意思</th></tr>
        <tr><td>1 2 3 4 5 6 7</td><td>do re mi fa sol la si</td></tr>
        <tr><td>数字上方一点（如 1̇）</td><td>高八度</td></tr>
        <tr><td>数字下方一点（如 1̣）</td><td>低八度</td></tr>
        <tr><td>数字下面一条横线</td><td>八分音符，唱半拍</td></tr>
        <tr><td>数字下面两条横线</td><td>十六分音符，唱四分之一拍</td></tr>
        <tr><td>数字右边的短横线「－」</td><td>延长一拍（唱的时候拖长）</td></tr>
        <tr><td>0</td><td>休止，不唱也不弹</td></tr>
        <tr><td>竖线 ｜</td><td>小节线</td></tr>
      </table>
      <p><b>开头的两个标记要看清：</b></p>
      <ul>
        <li><b>1=C</b>：调号，表示 do 是 C。写 1=G 就是 G 调，同一个数字按的音不一样。</li>
        <li><b>4/4</b>：拍号，每小节 4 拍，以四分音符为一拍。每小节里的时值加起来应该等于 4。</li>
      </ul>
      <p>例：<code>1 1 5 5 | 6 6 5 -</code> 读作 do do sol sol ｜ la la sol（拖长一拍）。这就是小星星的第一句。</p>`,
  },
  {
    id: 'readpage', icon: '📄', title: '本页面上的谱怎么用',
    html: `
      <p><b>单音旋律（曲谱页第一栏）</b></p>
      <ul>
        <li>每行两小节，行首标「第 N 行」，一行一行往下练就行。</li>
        <li>点<b>听一遍</b>先听节奏，再点<b>开始跟练</b>：节拍器先响一下预备，然后当前该弹的音会<b>高亮</b>。</li>
        <li>弹对了变<b>绿</b>，没弹的结束时变<b>红</b>，底部显示准确率。60% 以上就算过。</li>
        <li>弹错不要紧，别停下来重来，接着往下走，这样才知道自己到底哪几个音不稳。</li>
      </ul>
      <p><b>弹唱谱（第二栏）</b></p>
      <ul>
        <li>每一格 = 一个和弦，占一小节（4 拍）。格子跟着节拍器一个个亮，亮了就换到那个和弦。</li>
        <li>只弹和弦不唱歌词，先把换和弦练顺，再加唱。</li>
        <li>弹唱谱不打分，它只帮你看“换到第几个了”，不要因为没分数就觉得没练到。</li>
      </ul>
      <p><b>底部那行灰字</b>：它在实时告诉你它在听什么。如果一直显示“没听到声音”，就是麦克风或音量的问题，不是你的错。</p>`,
  },
  {
    id: 'strings', icon: '🎸', title: '六根弦与音名',
    html: `
      <table class="thy">
        <tr><th>弦</th><th>音名</th><th>频率</th><th>粗细</th></tr>
        <tr><td>6 弦</td><td>E2</td><td>82.41 Hz</td><td>最粗（低音 E）</td></tr>
        <tr><td>5 弦</td><td>A2</td><td>110.00 Hz</td><td></td></tr>
        <tr><td>4 弦</td><td>D3</td><td>146.83 Hz</td><td></td></tr>
        <tr><td>3 弦</td><td>G3</td><td>196.00 Hz</td><td></td></tr>
        <tr><td>2 弦</td><td>B3</td><td>246.94 Hz</td><td></td></tr>
        <tr><td>1 弦</td><td>E4</td><td>329.63 Hz</td><td>最细（高音 E）</td></tr>
      </table>
      <p>从粗到细记成 <b>E A D G B E</b>。英文口诀：<i>Eddie Ate Dynamite, Good Bye Eddie</i>。</p>
      <p>为什么这么调？因为这样最常用的几个和弦（C、G、Am、Em、D、A、E）指法都落在前三品，手不用跑。</p>`,
  },
  {
    id: 'names', icon: '🎵', title: '音名与唱名',
    html: `
      <p>同一个音有两套叫法，别被绕晕：</p>
      <table class="thy">
        <tr><th>音名</th><td>C</td><td>D</td><td>E</td><td>F</td><td>G</td><td>A</td><td>B</td></tr>
        <tr><th>唱名</th><td>do</td><td>re</td><td>mi</td><td>fa</td><td>sol</td><td>la</td><td>si</td></tr>
        <tr><th>简谱</th><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr>
      </table>
      <p>音名是固定的（C 就是 C），唱名随调移动（C 调里 1=C，G 调里 1=G）。看谱时先确认「1 等于哪个音」。</p>`,
  },
  {
    id: 'semitone', icon: '📏', title: '半音与全音',
    html: `
      <p>吉他上最简单的一条规律：<b>每往琴身方向按一品，升高一个半音；退一品，降低一个半音。</b></p>
      <ul>
        <li>相邻两品 = 半音</li>
        <li>隔一品 = 全音</li>
        <li>12 个半音 = 一个八度，正好回到同名音（第 12 品是空弦的高八度）</li>
      </ul>
      <p>特例：<b>E–F 和 B–C 之间本身只差半音</b>，所以 E 和 B 后面没有升号音。这也是为什么钢琴上黑键是两个一组、三个一组。</p>`,
  },
  {
    id: 'scale', icon: '🪜', title: '大调音阶（为什么 C 调最好按）',
    html: `
      <p>大调音阶的公式是固定的：<b>全 全 半 全 全 全 半</b>（全=2 品，半=1 品）。</p>
      <p>从 C 开始套这个公式：C → D → E → F → G → A → B → C，正好全是白键，所以 <b>C 大调没有升降号</b>，是最好按的调，新手都从它开始。</p>
      <p>换成从 G 开始套，第七个音会变成 F#，这就是 G 调要升 F 的原因（见下一节调号）。</p>
      <p>在吉他上弹一遍：从 5 弦 3 品（C）开始，按 3-5-7 品、再上到 4 弦 2-3-5 品、3 弦 2-4-5 品，就是 C 大调音阶。</p>`,
  },
  {
    id: 'key', icon: '🔑', title: '调号速查',
    html: `
      <table class="thy">
        <tr><th>调</th><th>升降号</th><th>备注</th></tr>
        <tr><td>C</td><td>无</td><td>最常用，全是自然音</td></tr>
        <tr><td>G</td><td>F#</td><td>吉他上很好按，常用</td></tr>
        <tr><td>D</td><td>F# C#</td><td></td></tr>
        <tr><td>A</td><td>F# C# G#</td><td></td></tr>
        <tr><td>E</td><td>F# C# G# D#</td><td></td></tr>
        <tr><td>F</td><td>Bb（降一个）</td><td>要按大横按 F，新手先躲开</td></tr>
      </table>
      <p>规律：升号按 F-C-G-D-A-E-B 的顺序加，降号反过来。不用背，看谱时认开头标的升降号就行。</p>`,
  },
  {
    id: 'interval', icon: '📐', title: '音程：几个品＝什么关系',
    html: `
      <table class="thy">
        <tr><th>音程</th><th>品数</th><th>听感</th></tr>
        <tr><td>小二度</td><td>1 品</td><td>最刺，紧张</td></tr>
        <tr><td>大二度</td><td>2 品</td><td>相邻音，如 do-re</td></tr>
        <tr><td>小三度</td><td>3 品</td><td>忧郁（小三和弦的骨架）</td></tr>
        <tr><td>大三度</td><td>4 品</td><td>明亮（大三和弦的骨架）</td></tr>
        <tr><td>纯四度</td><td>5 品</td><td>开阔</td></tr>
        <tr><td>纯五度</td><td>7 品</td><td>空、稳，强力和弦就是它</td></tr>
        <tr><td>大六度</td><td>9 品</td><td>柔和</td></tr>
        <tr><td>大七度</td><td>11 品</td><td>悬着，想解决</td></tr>
        <tr><td>八度</td><td>12 品</td><td>同一个音的高八度</td></tr>
      </table>
      <p>这是同一根弦上的算法。跨弦时因为调弦不是纯四度（3 弦到 2 弦是大三度），要减一品，先记住同弦的就行。</p>`,
  },
  {
    id: 'chord', icon: '🎹', title: '和弦到底是什么',
    html: `
      <p><b>三个或以上的音同时响，就是和弦。</b>最基础的是三和弦：根音 + 三音 + 五音。</p>
      <ul>
        <li>C 和弦 = C + E + G</li>
        <li>Am 和弦 = A + C + E</li>
        <li>Em 和弦 = E + G + B</li>
      </ul>
      <p>决定「大还是小」的是中间那个三音：</p>
      <ul>
        <li><b>大三和弦</b>（C、G、D、A、E）：根音到三音是大三度（4 品），听着明亮</li>
        <li><b>小三和弦</b>（Am、Em、Dm）：根音到三音是小三度（3 品），听着忧郁</li>
      </ul>
      <p>所以 C 和 Cm 只差一个音：把 E 降成 Eb。在吉他上就是那个音退一品。</p>
      <p>和弦图怎么读：竖线是六根弦（左粗右细），横线是品，圆点是要按的位置，× 是不弹，○ 是空弦。</p>`,
  },
  {
    id: 'numeral', icon: '🔢', title: '级数与万能四和弦',
    html: `
      <p>把 C 大调的音排成级数：</p>
      <table class="thy">
        <tr><th>级数</th><td>I</td><td>ii</td><td>iii</td><td>IV</td><td>V</td><td>vi</td></tr>
        <tr><th>和弦</th><td>C</td><td>Dm</td><td>Em</td><td>F</td><td>G</td><td>Am</td></tr>
      </table>
      <p>大写是大三和弦，小写是小三和弦。流行歌里最常见的进行是 <b>I–V–vi–IV</b>，也就是 <b>C–G–Am–F</b>。</p>
      <p>这一个进行能套几百首歌（《童年》《平凡之路》《真的爱你》都是它）。把它练到能闭眼换，等于打通一大半弹唱。</p>
      <p>另外一个常见的是 <b>vi–IV–I–V</b>（Am–F–C–G），情绪更柔，慢歌多用。</p>`,
  },
  {
    id: 'rhythm', icon: '🥁', title: '拍号与音符时值',
    html: `
      <p><b>4/4</b> 读作「四四拍」：每小节 4 拍，以四分音符为一拍。绝大多数流行歌都是 4/4。</p>
      <table class="thy">
        <tr><th>音符</th><th>拍数</th><th>怎么数</th></tr>
        <tr><td>全音符</td><td>4 拍</td><td>1 - 2 - 3 - 4</td></tr>
        <tr><td>二分音符</td><td>2 拍</td><td>1 - 2</td></tr>
        <tr><td>四分音符</td><td>1 拍</td><td>1</td></tr>
        <tr><td>八分音符</td><td>半拍</td><td>1 和 2 和（「和」是半拍）</td></tr>
        <tr><td>十六分音符</td><td>1/4 拍</td><td>1 e 和 a</td></tr>
      </table>
      <p><b>附点</b>：音符右边加个点，时值 ×1.5。附点四分音符 = 1.5 拍。</p>
      <p>数拍子的时候嘴上要出声（1 2 3 4），手上动作跟嘴走，别跟着感觉走。</p>`,
  },
  {
    id: 'right', icon: '✋', title: '右手：分解与扫弦',
    html: `
      <p><b>分解和弦（指弹）</b>：拇指管 6、5、4 弦（低音），食指管 3 弦，中指管 2 弦，无名指管 1 弦。最常见的型是 5-3-2-3-1-3-2-3。</p>
      <p><b>扫弦</b>：靠手腕转，不是靠手臂甩。</p>
      <ul>
        <li>下扫：食指指甲背面（或拇指外侧）从 6 弦划到 1 弦</li>
        <li>上扫：拇指肚从 1 弦划回 6 弦，只扫上面两三根就够</li>
        <li>新手第一个型：<b>下　下上　上下上</b>（一拍一下，第三拍拆成两下）</li>
      </ul>
      <p>扫弦声音糊成一团，通常是手腕太僵或者拨片/指甲吃弦太深。轻一点、快一点反而清楚。</p>`,
  },
  {
    id: 'left', icon: '👈', title: '左手：按弦要领',
    html: `
      <ul>
        <li><b>按在品柱后面 2–3 毫米</b>，不要正压品丝上，也不要缩在品格中间（那是杂音和闷音的主要来源）</li>
        <li><b>指尖垂直</b>，指关节立起来，别让指腹躺到隔壁弦上</li>
        <li><b>拇指贴在琴颈后面中间</b>，不要整个握上来，也不要外翻</li>
        <li><b>力度刚好不出杂音就行</b>，按太狠音会偏高，手也更快累</li>
        <li>手腕不要塌，前臂和琴颈大致平行</li>
      </ul>
      <p>判断有没有按实：单弦拨一下，声音干净、能延音，就是按住了；发闷或者有「嗒」的杂音，就是没按实或者碰到隔壁弦。</p>`,
  },
  {
    id: 'practice', icon: '⏱️', title: '怎么练才有效',
    html: `
      <ul>
        <li><b>慢到能弹对，再加速。</b>用节拍器，弹干净了每次 +5 BPM，弹乱了就退回去。</li>
        <li><b>分段练。</b>一次只练 4 小节，别从头到尾过一遍就算练完。</li>
        <li><b>每天 15 分钟 &gt; 周末 2 小时。</b>手指的记忆靠频率，不靠时长。</li>
        <li><b>换和弦练「提前量」。</b>不要等这一拍到了才动手，上一拍打完就开始移下一和弦的手指。</li>
        <li><b>手疼是正常的</b>，指尖起茧就好；但如果是关节刺痛、手腕发麻，立刻停，那是姿势问题。</li>
        <li><b>录音回听。</b>自己弹的时候听不出问题，录下来一听全是问题。</li>
      </ul>`,
  },
  {
    id: 'glossary', icon: '📖', title: '术语速查',
    html: `
      <table class="thy">
        <tr><th>词</th><th>意思</th></tr>
        <tr><td>品 / 品丝</td><td>琴颈上的金属条；「第 3 品」指第 3 格</td></tr>
        <tr><td>空弦</td><td>左手不按，直接拨</td></tr>
        <tr><td>把位</td><td>左手所在的区域，如「第一把位」＝食指在 1 品附近</td></tr>
        <tr><td>横按</td><td>一根手指同时压多根弦，如 F 和弦</td></tr>
        <tr><td>闷音</td><td>手掌轻压琴桥附近，让声音变短变闷</td></tr>
        <tr><td>击弦 / 勾弦</td><td>不用右手拨，靠左手手指敲下去（击）或勾起来（勾）发声</td></tr>
        <tr><td>推弦</td><td>按弦后把弦往侧面推，让音升高</td></tr>
        <tr><td>泛音</td><td>手指轻碰弦（不压实）拨响，得到清亮的高音</td></tr>
        <tr><td>根音</td><td>和弦的名字来源，如 C 和弦的根音是 C</td></tr>
      </table>`,
  },
];

window.GT_DATA = { TUNING, OPEN_MIDI, CHORDS, STARTER_CHORDS, EASY_ORDER, MELODIES, SONGBOOK, LEVELS, THEORY, parseJianpu, midiToFret, jianpuToMidi };

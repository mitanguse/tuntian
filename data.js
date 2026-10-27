/* 《屯田》- 卡牌与配方数据
 * 所有平衡性数值集中在这里，调手感只改这个文件
 */

const CONFIG = {
  DAY_MS: 40000,        // 一天多少毫秒
  TOTAL_DAYS: 10,       // 守满多少天算胜利
  START_COINS: 8,
  PILE_MAX: 6,          // 一堆最多几张卡
  DROP_RADIUS: 105,     // 拖拽吸附半径
  CRAFT_MS: 620,        // 合成需要的时间（不是瞬间完成）
  HOLD_MS: 350,         // 按住多久算长按拆牌
  ENEMY_MOVE_MS: 1200,  // 贼寇多久挪一步
  ENEMY_STEP: 62,       // 一步走多远（px）
  ENEMY_RANGE: 130,      // 贴到多近开始咬（留出牌宽，不压住村民那张牌）
  ENEMY_BITE_MS: 1500,  // 咬一口的间隔
  ENEMY_BITE_DMG: 1,    // 一口掉多少血
};

const CARDS = {
  /* ---------- 单位 ---------- */
  villager: { name: '村民', glyph: '民', kind: 'unit', hp: 2, atk: 0, food: 1, tip: '能采集，不能作战' },
  militia:  { name: '民兵', glyph: '勇', kind: 'unit', hp: 3, atk: 1, food: 1, tip: '临时征召，比士兵弱' },
  soldier:  { name: '士兵', glyph: '兵', kind: 'unit', hp: 5, atk: 2, food: 1, tip: '基础战力' },
  spear:    { name: '枪兵', glyph: '枪', kind: 'unit', hp: 6, atk: 3, food: 1, tip: '克骑，攻高' },
  archer:   { name: '弓兵', glyph: '弓', kind: 'unit', hp: 5, atk: 3, food: 1, tip: '远程，先手' },
  ironspear:{ name: '铁枪兵', glyph: '铁', kind: 'unit', hp: 9, atk: 5, food: 1, tip: '重装精锐' },
  strongbow:{ name: '强弓手', glyph: '强', kind: 'unit', hp: 8, atk: 5, food: 1, tip: '百步穿杨' },

  /* ---------- 资源点（森林采不完，其余采完消失） ---------- */
  tree:  { name: '树木', glyph: '树', kind: 'node', tip: '民去砍成木材，或两张树木劈成木材' },
  forest:{ name: '森林', glyph: '森', kind: 'node', tip: '派村民去，随机采出树木或石头，森林不会消失' },
  stone: { name: '石头', glyph: '岩', kind: 'node', tip: '民去采成石料，或两张石头碎成石料' },
  farm:  { name: '农田', glyph: '田', kind: 'node', tip: '派村民去收，得粮草' },

  /* ---------- 资源卡（可卖钱） ---------- */
  wood:      { name: '木材', glyph: '木', kind: 'res', sell: 3 },
  stoneblock:{ name: '石料', glyph: '石', kind: 'res', sell: 3 },
  food:      { name: '粮草', glyph: '粮', kind: 'res', sell: 2 },

  /* ---------- 敌人 ---------- */
  bandit: { name: '山贼', glyph: '贼', kind: 'enemy', hp: 4, atk: 2, reward: 6, tip: '第 3 天出现' },
  yellow: { name: '黄巾', glyph: '巾', kind: 'enemy', hp: 7, atk: 3, reward: 10, tip: '第 7 天出现' },
  army:   { name: '敌军', glyph: '敌', kind: 'enemy', hp: 12, atk: 5, reward: 18, tip: '第 9 天出现' },
};

/* 配方：in 消耗，keep 保留在原料堆里，out 产出到新的一堆 */
const RECIPES = [
  { id: 'chop',  in: { villager: 1, tree: 1 },                  keep: {},                            out: { wood: 2 },        label: '伐木', labor: true },
  { id: 'quarry',in: { villager: 1, stone: 1 },                 keep: {},                            out: { stoneblock: 2 },  label: '采石', labor: true },
  { id: 'farm',  in: { villager: 1, farm: 1 },                  keep: { farm: 1 },                   out: { food: 3 },        label: '屯田', labor: true },
  { id: 'militia', in: { villager: 1, wood: 1 },     out: { militia: 1 },     label: '编民兵' },
  { id: 'forest', in: { villager: 1, forest: 1 },    keep: { forest: 1 },                 alt: [{ tree: 1 }, { stone: 1 }], label: '进林', labor: true },
  { id: 'splitwood', in: { tree: 2 },               out: { wood: 2 },        label: '劈木' },
  { id: 'splitstone', in: { stone: 2 },             out: { stoneblock: 2 },  label: '碎石' },
  { id: 'recruit',in:{ villager: 1, wood: 1, stoneblock: 1 },                                       out: { soldier: 1 },     label: '募兵' },
  { id: 'train', in: { militia: 1, stoneblock: 1 },                                         out: { soldier: 1 },     label: '练兵' },
  { id: 'bow',   in: { soldier: 1, wood: 1 },                                                       out: { archer: 1 },      label: '制弓' },
  { id: 'spear', in: { soldier: 1, stoneblock: 1 },                                                 out: { spear: 1 },       label: '锻枪' },
  { id: 'strongbow', in: { archer: 1, wood: 2 },                                                    out: { strongbow: 1 },   label: '强弓' },
  { id: 'ironspear', in: { spear: 1, stoneblock: 2 },                                               out: { ironspear: 1 },   label: '铁枪' },
];

/* 卡包 */
const PACKS = {
  recruitPack: {
    name: '招募令', cost: 10, n: 3,
    pool: ['villager', 'villager', 'tree', 'forest', 'stone', 'farm', 'wood', 'food'],
  },
  tacticPack: {
    name: '锦囊', cost: 18, n: 2,
    pool: ['soldier', 'archer', 'spear', 'food', 'stoneblock', 'food'],
  },
};

/* 敌人从哪个方向来：入口在牌桌边上，目标村中心 */
const DIRS = {
  east:  { name: '东', fx: 0.93, fy: 0.50 },
  south: { name: '南', fx: 0.50, fy: 0.92 },
  west:  { name: '西', fx: 0.07, fy: 0.50 },
  north: { name: '北', fx: 0.50, fy: 0.08 },
};

/* 敌人波次：第几天 -> 来什么、从哪边来 */
const WAVES = {
  3: { bandit: 1, dir: 'east' },
  5: { bandit: 2, dir: 'south' },
  7: { yellow: 1, dir: 'north' },
  9: { yellow: 1, bandit: 1, dir: 'east' },
};

/* 事件卡：每逢偶数天开头二选一，选完才继续走时间 */
const EVENTS = [
  {
    id: 'drought', name: '旱灾', line: '日头毒了半个月，田里裂开一指宽的缝。',
    options: [
      { text: '挖井引水', cost: { coins: 6 }, result: '水引过来了，今年的收成保住了。' },
      { text: '硬扛过去', effect: { foodHalf: true }, result: '粮草折了一半，村口有人开始啃树皮。' },
    ],
  },
  {
    id: 'refugee', name: '流民', line: '十几户流民跪在村口，大人孩子都瘦得脱了形。',
    options: [
      { text: '收留他们', cost: { food: 4 }, effect: { add: 'villager', n: 1 }, result: '多了一口人，也多了一双能下地的手。' },
      { text: '遣散出村', effect: { coins: 2 }, result: '他们留下几文买路钱，往南边去了。' },
    ],
  },
  {
    id: 'surrender', name: '招降', line: '一伙山贼在村外喊话，说愿意放下刀跟你干。',
    options: [
      { text: '收编入伙', cost: { coins: 8 }, effect: { add: 'militia', n: 1 }, result: '山贼换了旗号，成了你手下的民兵。' },
      { text: '斩首示众', effect: { coins: 4 }, result: '人头挂上村口老槐树，缴获四文铜钱。' },
    ],
  },
  {
    id: 'plague', name: '疫病', line: '营里有人发起热来，一夜之间倒下三个。',
    options: [
      { text: '请医买药', cost: { coins: 8 }, result: '药灌下去了，人挺过来了。' },
      { text: '封营隔离', effect: { hurtRandom: 1 }, result: '病是压住了，可有人落下了病根。' },
    ],
  },
];

if (typeof module !== 'undefined') module.exports = { CONFIG, CARDS, RECIPES, PACKS, WAVES, DIRS, EVENTS };

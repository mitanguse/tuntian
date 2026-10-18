/* 《屯田》- 卡牌与配方数据
 * 所有平衡性数值集中在这里，调手感只改这个文件
 */

const CONFIG = {
  DAY_MS: 40000,        // 一天多少毫秒
  TOTAL_DAYS: 10,       // 守满多少天算胜利
  START_COINS: 8,
  PILE_MAX: 6,          // 一堆最多几张卡
  DROP_RADIUS: 105,     // 拖拽吸附半径
};

const CARDS = {
  /* ---------- 单位 ---------- */
  villager: { name: '村民', glyph: '民', kind: 'unit', hp: 2, atk: 0, food: 1, tip: '能采集，不能作战' },
  soldier:  { name: '士兵', glyph: '兵', kind: 'unit', hp: 5, atk: 2, food: 1, tip: '基础战力' },
  spear:    { name: '枪兵', glyph: '枪', kind: 'unit', hp: 6, atk: 3, food: 1, tip: '克骑，攻高' },
  archer:   { name: '弓兵', glyph: '弓', kind: 'unit', hp: 5, atk: 3, food: 1, tip: '远程，先手' },
  ironspear:{ name: '铁枪兵', glyph: '鐵', kind: 'unit', hp: 9, atk: 5, food: 1, tip: '重装精锐' },
  strongbow:{ name: '强弓手', glyph: '彊', kind: 'unit', hp: 8, atk: 5, food: 1, tip: '百步穿杨' },

  /* ---------- 资源点（可采集，采集后消失） ---------- */
  tree:  { name: '树林', glyph: '林', kind: 'node', tip: '派村民去砍，得木材' },
  stone: { name: '石山', glyph: '山', kind: 'node', tip: '派村民去采，得石料' },
  farm:  { name: '农田', glyph: '田', kind: 'node', tip: '派村民去收，得粮草' },

  /* ---------- 资源卡（可卖钱） ---------- */
  wood:      { name: '木材', glyph: '木', kind: 'res', sell: 3 },
  stoneblock:{ name: '石料', glyph: '石', kind: 'res', sell: 3 },
  food:      { name: '粮草', glyph: '糧', kind: 'res', sell: 2 },

  /* ---------- 敌人 ---------- */
  bandit: { name: '山贼', glyph: '賊', kind: 'enemy', hp: 4, atk: 2, reward: 6, tip: '第 3 天出现' },
  yellow: { name: '黄巾', glyph: '巾', kind: 'enemy', hp: 7, atk: 3, reward: 10, tip: '第 7 天出现' },
  army:   { name: '敌军', glyph: '敵', kind: 'enemy', hp: 12, atk: 5, reward: 18, tip: '第 9 天出现' },
};

/* 配方：in 消耗，keep 保留在原料堆里，out 产出到新的一堆 */
const RECIPES = [
  { id: 'chop',  in: { villager: 1, tree: 1 },                  keep: { villager: 1 },              out: { wood: 2 },        label: '伐木' },
  { id: 'quarry',in: { villager: 1, stone: 1 },                 keep: { villager: 1 },              out: { stoneblock: 2 },  label: '采石' },
  { id: 'farm',  in: { villager: 1, farm: 1 },                  keep: { villager: 1, farm: 1 },     out: { food: 3 },        label: '屯田' },
  { id: 'recruit',in:{ villager: 1, wood: 1, stoneblock: 1 },                                       out: { soldier: 1 },     label: '募兵' },
  { id: 'bow',   in: { soldier: 1, wood: 1 },                                                       out: { archer: 1 },      label: '制弓' },
  { id: 'spear', in: { soldier: 1, stoneblock: 1 },                                                 out: { spear: 1 },       label: '锻枪' },
  { id: 'strongbow', in: { archer: 1, wood: 2 },                                                    out: { strongbow: 1 },   label: '强弓' },
  { id: 'ironspear', in: { spear: 1, stoneblock: 2 },                                               out: { ironspear: 1 },   label: '铁枪' },
];

/* 卡包 */
const PACKS = {
  recruitPack: {
    name: '招募令', cost: 10, n: 3,
    pool: ['villager', 'villager', 'tree', 'tree', 'stone', 'farm', 'wood', 'food'],
  },
  tacticPack: {
    name: '锦囊', cost: 18, n: 2,
    pool: ['soldier', 'archer', 'spear', 'food', 'stoneblock', 'food'],
  },
};

/* 敌人波次：第几天 -> 来什么 */
const WAVES = {
  3: { bandit: 1 },
  5: { bandit: 2 },
  7: { yellow: 1 },
  9: { yellow: 1, bandit: 1 },
};

if (typeof module !== 'undefined') module.exports = { CONFIG, CARDS, RECIPES, PACKS, WAVES };

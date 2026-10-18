/* 《屯田》主逻辑
 * 拖拽 → 堆叠 → 合成 → 屯粮 → 御敌 → 卖钱 → 开包
 */

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const boardEl = $('#piles');
  const marketEl = $('#market');

  const S = {
    piles: [],
    coins: CONFIG.START_COINS,
    day: 1,
    left: CONFIG.DAY_MS,
    running: false,
    paused: false,
    over: false,
    discovered: new Set(),
    stats: { crafted: 0, killed: 0, soldCoins: 0 },
    uid: 1,
    pid: 1,
    pop: [],
  };

  /* ---------------- 基础工具 ---------------- */
  const boardSize = () => ({ w: boardEl.clientWidth, h: boardEl.clientHeight });

  function makeCard(id) {
    const def = CARDS[id];
    return { uid: S.uid++, id, hp: def.hp || 0 };
  }

  function makePile(cards, x, y) {
    return { pid: S.pid++, x, y, cards };
  }

  const allCards = () => S.piles.flatMap((p) => p.cards);
  const countOf = (id) => allCards().filter((c) => c.id === id).length;
  const isFighter = (c) => CARDS[c.id].kind === 'unit' && CARDS[c.id].atk > 0;
  const isEnemy = (c) => CARDS[c.id].kind === 'enemy';
  const isUnit = (c) => CARDS[c.id].kind === 'unit';

  function toast(text, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 1900);
  }

  /* ---------------- 渲染 ---------------- */
  let dragging = false;

  function cardHTML(c, depth, badge) {
    const def = CARDS[c.id];
    let foot = '';
    if (def.kind === 'unit' || def.kind === 'enemy') foot = `攻${def.atk}·血${Math.max(c.hp, 0)}`;
    else if (def.sell) foot = `卖${def.sell}钱`;
    else if (def.kind === 'node') foot = '采集点';
    const cls = ['card', 'c-' + def.kind];
    if (depth > 0) cls.push(depth === 1 ? 'back' : depth >= 5 ? 'back5' : 'back' + depth);
    const badgeHTML = badge ? `<div class="cnum">×${badge}</div>` : '';
    return `<div class="${cls.join(' ')}" data-uid="${c.uid}" style="z-index:${10 - depth}">
      ${badgeHTML}
      <div class="cname">${def.name}</div>
      <div class="cglyph">${def.glyph}</div>
      <div class="cfoot">${foot}</div>
    </div>`;
  }

  function render() {
    if (dragging) return;
    const { w, h } = boardSize();
    let html = '';
    S.piles = S.piles.filter((p) => p.cards.length > 0);
    const sorted = [...S.piles].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      p.x = Math.min(Math.max(p.x, 4), Math.max(4, w - 100));
      p.y = Math.min(Math.max(p.y, 8), Math.max(8, h - 140));
      const n = p.cards.length;
      const counts = {};
      p.cards.forEach((c) => (counts[c.id] = (counts[c.id] || 0) + 1));
      const inner = p.cards
        .map((c, i) => {
          const depth = n - 1 - i;
          const badge = depth === 0 && counts[c.id] > 1 ? counts[c.id] : 0;
          return cardHTML(c, depth, badge);
        })
        .join('');
      html += `<div class="pile${p.busy ? ' crafting' : ''}${(S.pop || []).includes(p.pid) ? ' pop' : ''}" data-pid="${p.pid}" style="left:${p.x}px;top:${p.y}px;z-index:${Math.round(p.y / 4) + 2}">
        ${p.busy ? `<div class="craftTag">${p.craftLabel}中</div>` : ''}${inner}</div>`;
    }
    boardEl.innerHTML = html;
    if ((S.pop || []).length) {
      const pids = S.pop.slice();
      S.pop = [];
      pids.forEach((pid) => {
        const el = boardEl.querySelector(`.pile[data-pid="${pid}"]`);
        if (el) el.classList.add('pop');
      });
      setTimeout(() => {
        boardEl.querySelectorAll('.pile.pop').forEach((el) => el.classList.remove('pop'));
      }, 300);
    }
    updateHUD();
  }

  function updateHUD() {
    $('#coins').textContent = S.coins;
    $('#foodCount').textContent = countOf('food');
    $('#dayNum').textContent = Math.min(S.day, CONFIG.TOTAL_DAYS);
    $('#codex').textContent = `${S.discovered.size}/${RECIPES.length}`;
    const pct = Math.max(0, Math.min(100, (S.left / CONFIG.DAY_MS) * 100));
    $('#dayBar').style.width = pct + '%';
    $('#buyRecruit').disabled = S.coins < PACKS.recruitPack.cost;
    $('#buyTactic').disabled = S.coins < PACKS.tacticPack.cost;
  }

  /* ---------------- 拖拽 ---------------- */
  let drag = null;
  let holdTimer = null;
  let holdFired = false;

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  /* 从堆里拆出最上面一张，落到旁边空位——不然混堆了就再也分不开 */
  function splitOne(pile) {
    if (S.over || !S.running || S.paused || pile.busy) return false;
    if (pile.cards.length < 2) {
      shake(pile);
      return false;
    }
    const card = pile.cards.pop();
    const spot = freeSpot(pile.x, pile.y);
    const np = makePile([card], spot.x, spot.y);
    S.piles.push(np);
    S.pop.push(np.pid);
    shake(pile);
    render();
    toast(`拆出 ${CARDS[card.id].name}`, 'good');
    return true;
  }

  boardEl.addEventListener('pointerdown', (e) => {
    if (S.over || !S.running || S.paused) return;
    const pileEl = e.target.closest('.pile');
    if (!pileEl) return;
    const p = S.piles.find((x) => x.pid === +pileEl.dataset.pid);
    if (!p) return;
    if (p.busy) {
      shake(p);
      return;
    }
    const rect = boardEl.getBoundingClientRect();
    drag = {
      p,
      ox: e.clientX - rect.left - p.x,
      oy: e.clientY - rect.top - p.y,
      el: pileEl,
      moved: false,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
    };
    dragging = true;
    pileEl.classList.add('dragging');
    try { pileEl.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件不支持捕获，忽略 */ }

    // 长按拆一张（堆里至少 2 张才启动计时）
    clearHold();
    holdFired = false;
    if (p.cards.length >= 2) {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        holdFired = true;
        if (drag && drag.p === p) {
          drag.el.classList.remove('dragging');
          drag = null;
          dragging = false;
          marketEl.classList.remove('hot');
        }
        splitOne(p);
      }, CONFIG.HOLD_MS);
    }
  });

  boardEl.addEventListener('pointermove', (e) => {
    if (holdTimer && drag && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 8) clearHold();
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 3) drag.moved = true;
    const rect = boardEl.getBoundingClientRect();
    drag.p.x = e.clientX - rect.left - drag.ox;
    drag.p.y = e.clientY - rect.top - drag.oy;
    drag.el.style.left = drag.p.x + 'px';
    drag.el.style.top = drag.p.y + 'px';
    const mr = marketEl.getBoundingClientRect();
    const overMarket = e.clientX > mr.left && e.clientX < mr.right && e.clientY > mr.top && e.clientY < mr.bottom;
    marketEl.classList.toggle('hot', overMarket && drag.p.cards.some((c) => CARDS[c.id].sell));
  });

  boardEl.addEventListener('pointerup', (e) => {
    clearHold();
    if (holdFired) {
      holdFired = false;
      return;
    }
    if (!drag) return;
    const from = drag.p;
    const el = drag.el;
    const tap = performance.now() - drag.t0 < 400 &&
      Math.abs(e.clientX - drag.x0) < 8 && Math.abs(e.clientY - drag.y0) < 8 && !drag.moved;
    dragging = false;
    drag = null;
    el.classList.remove('dragging');
    marketEl.classList.remove('hot');

    // 轻点 = 拆一张（不分位置就能分开混堆）
    if (tap) {
      splitOne(from);
      return;
    }

    const mr = marketEl.getBoundingClientRect();
    const inMarket = e.clientX > mr.left && e.clientX < mr.right && e.clientY > mr.top && e.clientY < mr.bottom;

    if (inMarket) {
      doSell(from);
      render();
      return;
    }

    const target = nearestPile(from, e.clientX, e.clientY);
    if (target) tryMerge(from, target);
    else craft(from);
    render();
  });

  boardEl.addEventListener('pointercancel', () => {
    clearHold();
    holdFired = false;
    if (!drag) return;
    drag.el.classList.remove('dragging');
    drag = null;
    dragging = false;
    marketEl.classList.remove('hot');
    render();
  });

  function nearestPile(from, cx, cy) {
    let best = null;
    let bestD = CONFIG.DROP_RADIUS;
    const rect = boardEl.getBoundingClientRect();
    const px = cx - rect.left;
    const py = cy - rect.top;
    for (const p of S.piles) {
      if (p === from || p.cards.length === 0 || p.busy) continue;
      const el = boardEl.querySelector(`.pile[data-pid="${p.pid}"]`);
      const w = el ? el.offsetWidth : 94;
      const h = el ? el.offsetHeight : 132;
      // 到牌矩形（含 26px 容差）的距离，比只比中心点更适合手指
      const pad = 26;
      const dx = Math.max(p.x - pad - px, 0, px - (p.x + w + pad));
      const dy = Math.max(p.y - pad - py, 0, py - (p.y + h + pad));
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return bestD <= 0.1 ? best : null;
  }

  /* ---------------- 合并 / 战斗 ---------------- */
  function tryMerge(from, to) {
    const fromFighters = from.cards.filter(isFighter);
    const toFighters = to.cards.filter(isFighter);
    const fromEnemies = from.cards.filter(isEnemy);
    const toEnemies = to.cards.filter(isEnemy);

    // 打敌人
    if (fromEnemies.length && toFighters.length) return resolveCombat(to, from);
    if (toEnemies.length && fromFighters.length) return resolveCombat(from, to);
    if (fromEnemies.length || toEnemies.length) {
      shake(to);
      toast('敌人只能派兵去打', 'bad');
      return;
    }

    const merged = [...to.cards, ...from.cards];
    if (merged.length > CONFIG.PILE_MAX) {
      shake(to);
      toast(`一堆最多 ${CONFIG.PILE_MAX} 张`, 'bad');
      return;
    }
    to.cards = merged;
    S.piles = S.piles.filter((p) => p !== from);
    craft(to);
    checkLose();
  }

  function shake(pile) {
    const el = document.querySelector(`.pile[data-pid="${pile.pid}"]`);
    if (!el) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 300);
  }

  function bestFighter(cards) {
    return cards.filter(isFighter).sort((a, b) => CARDS[b.id].atk - CARDS[a.id].atk)[0];
  }
  function bestEnemy(cards) {
    return cards.filter(isEnemy).sort((a, b) => CARDS[b.id].atk - CARDS[a.id].atk)[0];
  }

  function resolveCombat(attackerPile, enemyPile) {
    const unit = bestFighter(attackerPile.cards);
    const enemy = bestEnemy(enemyPile.cards);
    if (!unit || !enemy) return;

    const uDef = CARDS[unit.id];
    const eDef = CARDS[enemy.id];
    const uEl = document.querySelector(`.card[data-uid="${unit.uid}"]`);
    const eEl = document.querySelector(`.card[data-uid="${enemy.uid}"]`);
    if (uEl) uEl.classList.add('hurt');
    if (eEl) eEl.classList.add('hurt');

    // 先手：弓兵系抢先一轮
    const firstStrike = unit.id === 'archer' || unit.id === 'strongbow';
    let uHp = unit.hp;
    let eHp = enemy.hp;
    let rounds = 0;
    while (uHp > 0 && eHp > 0 && rounds < 30) {
      if (rounds > 0 || firstStrike) eHp -= uDef.atk;
      if (eHp <= 0) break;
      uHp -= eDef.atk;
      rounds++;
    }
    unit.hp = uHp;
    enemy.hp = eHp;

    setTimeout(() => {
      // 结算死亡
      S.piles.forEach((p) => {
        p.cards = p.cards.filter((c) => {
          if (c === unit && uHp <= 0) return false;
          if (c === enemy && eHp <= 0) return false;
          return true;
        });
      });
      if (eHp <= 0) {
        S.coins += eDef.reward;
        S.stats.killed++;
        toast(`斩获 ${eDef.name}，+${eDef.reward} 铜钱`, 'good');
      }
      if (uHp <= 0) {
        toast(`${uDef.name} 战死`, 'bad');
      } else if (eHp > 0) {
        toast(`${eDef.name} 尚有 ${Math.max(eHp, 0)} 血`, 'bad');
      }
      checkLose();
      render();
    }, 320);
  }

  /* ---------------- 配方 ---------------- */
  function matchRecipe(cards) {
    const bag = {};
    cards.forEach((c) => (bag[c.id] = (bag[c.id] || 0) + 1));
    let best = null;
    let bestScore = 0;
    for (const r of RECIPES) {
      let ok = true;
      let score = 0;
      for (const [id, n] of Object.entries(r.in)) {
        if ((bag[id] || 0) < n) { ok = false; break; }
        score += n;
      }
      if (ok && score > bestScore) {
        best = r;
        bestScore = score;
      }
    }
    return best;
  }

  function takeFrom(pile, id, n) {
    for (let i = 0; i < n; i++) {
      const idx = pile.cards.findIndex((c) => c.id === id);
      if (idx >= 0) pile.cards.splice(idx, 1);
    }
  }

  /* 找一个不压在别的牌上的位置，avoid 新牌生成就叠成一堆看不见 */
  function freeSpot(x, y) {
    const { w, h } = boardSize();
    const clampX = (v) => Math.min(Math.max(v, 6), Math.max(6, w - 110));
    const clampY = (v) => Math.min(Math.max(v, 6), Math.max(6, h - 150));
    const cands = [
      [0, 0], [56, 46], [-56, 46], [56, -46], [-56, -46],
      [0, 96], [0, -96], [120, 0], [-120, 0],
      [120, 96], [-120, 96], [120, -96], [-120, -96],
      [0, 160], [0, -160], [190, 0], [-190, 0],
    ];
    for (const [dx, dy] of cands) {
      const nx = clampX(x + dx);
      const ny = clampY(y + dy);
      if (!S.piles.some((p) => Math.abs(p.x - nx) < 80 && Math.abs(p.y - ny) < 104)) {
        return { x: nx, y: ny };
      }
    }
    return { x: clampX(x + 40), y: clampY(y + 40) };
  }

  /* 每次拖放只加工一次，产出单独成堆，原料留下的部分不动 */
  /* 合成不是瞬间完成：先把这堆锁住，播一段“在忙”的动画，到点才出卡 */
  function craft(pile) {
    const r = matchRecipe(pile.cards);
    if (!r) return false;
    if (pile.busy) return false;
    pile.busy = true;
    pile.craftLabel = r.label;
    render();
    setTimeout(() => {
      pile.busy = false;
      pile.craftLabel = null;
      if (S.over) return render();
      if (!S.piles.includes(pile)) return render();
      for (const [id, n] of Object.entries(r.in)) takeFrom(pile, id, n);
      if (r.keep) {
        for (const [id, n] of Object.entries(r.keep)) {
          for (let i = 0; i < n; i++) pile.cards.push(makeCard(id));
        }
      }
      const outCards = [];
      // 森林这类配方是随机的：alt 里每个产物等概率抽一个
      const outMap = r.alt ? r.alt[Math.floor(Math.random() * r.alt.length)] : r.out;
      for (const [id, n] of Object.entries(outMap)) {
        for (let i = 0; i < n; i++) outCards.push(makeCard(id));
      }
      const spot = freeSpot(pile.x, pile.y);
      if (outCards.length) {
        const np = makePile(outCards, spot.x, spot.y);
        S.piles.push(np);
        S.pop.push(np.pid);
      }
      S.discovered.add(r.id);
      S.stats.crafted++;
      toast(`合成 · ${r.label}`, 'good');
      checkLose();
      render();
    }, CONFIG.CRAFT_MS);
    return true;
  }

  /* ---------------- 卖 / 买 ---------------- */
  function doSell(pile) {
    let gain = 0;
    const keep = [];
    for (const c of pile.cards) {
      const def = CARDS[c.id];
      if (def.sell) gain += def.sell;
      else keep.push(c);
    }
    if (gain === 0) {
      shake(pile);
      toast('这张卖不了', 'bad');
      pile.cards = keep;
      return;
    }
    S.coins += gain;
    S.stats.soldCoins += gain;
    pile.cards = keep;
    toast(`卖出 +${gain} 铜钱`, 'good');
  }

  function buyPack(key) {
    if (!S.running || S.over || S.paused) return;
    const pack = PACKS[key];
    if (S.coins < pack.cost) {
      toast('铜钱不够', 'bad');
      return;
    }
    S.coins -= pack.cost;
    const { w, h } = boardSize();
    for (let i = 0; i < pack.n; i++) {
      const id = pack.pool[Math.floor(Math.random() * pack.pool.length)];
      const spot = freeSpot(w / 2 - 60, h / 2 - 60);
      S.piles.push(makePile([makeCard(id)], spot.x, spot.y));
    }
    toast(`打开${pack.name}`, 'good');
    render();
    document.querySelectorAll('.pile').forEach((el) => el.classList.add('pop'));
    setTimeout(() => document.querySelectorAll('.pile').forEach((el) => el.classList.remove('pop')), 320);
  }

  /* ---------------- 天循环 ---------------- */
  let timerId = null;
  let lastTs = 0;

  function startClock() {
    S.left = CONFIG.DAY_MS;
    lastTs = performance.now();
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (!S.running || S.over) return;
      const now = performance.now();
      if (S.paused) {
        lastTs = now;
        return;
      }
      S.left -= now - lastTs;
      lastTs = now;
      if (S.left <= 0) endDay();
      updateHUD();
    }, 100);
  }

  /* ---------------- 暂停 ---------------- */
  function setPaused(on) {
    if (!S.running || S.over) return;
    S.paused = !!on;
    document.body.classList.toggle('paused', S.paused);
    const mask = $('#pauseMask');
    mask.classList.toggle('hidden', !S.paused);
    $('#btnPause').textContent = S.paused ? '继续' : '暂停';
    $('#btnPause').classList.toggle('on', S.paused);
    if (S.paused) {
      // 停下来的时候手里的牌应该放回去，不然会一直跟着手指
      clearHold();
      holdFired = false;
      if (drag) {
        drag.el.classList.remove('dragging');
        drag = null;
        dragging = false;
        marketEl.classList.remove('hot');
      }
      lastTs = performance.now();
    }
    lastTs = performance.now();
  }

  $('#btnPause').addEventListener('click', () => setPaused(!S.paused));
  $('#btnResume').addEventListener('click', () => setPaused(false));
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && S.running && !S.over) {
      e.preventDefault();
      setPaused(!S.paused);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.running && !S.over && !S.paused) setPaused(true);
  });

  function endDay() {
    // 1. 吃饭
    const mouths = allCards().filter((c) => CARDS[c.id].food);
    let foodCards = allCards().filter((c) => c.id === 'food');
    let shortage = mouths.length - foodCards.length;
    const eat = Math.min(mouths.length, foodCards.length);
    for (let i = 0; i < eat; i++) {
      const c = foodCards[i];
      const p = S.piles.find((pp) => pp.cards.includes(c));
      if (p) p.cards.splice(p.cards.indexOf(c), 1);
    }
    if (shortage > 0) {
      toast(`断粮！${shortage} 人没饭吃`, 'bad');
      for (let i = 0; i < shortage; i++) {
        const units = allCards().filter((c) => CARDS[c.id].food > 0);
        if (!units.length) break;
        const victim = units[Math.floor(Math.random() * units.length)];
        if (Math.random() < 0.45) {
          removeCard(victim);
          toast(`${CARDS[victim.id].name} 逃走了`, 'bad');
        } else {
          victim.hp = (victim.hp || 1) - 1;
          if (victim.hp <= 0) {
            removeCard(victim);
            toast(`${CARDS[victim.id].name} 饿死了`, 'bad');
          }
        }
      }
    }

    // 2. 敌人动手
    for (const p of S.piles.slice()) {
      for (const e of p.cards.filter(isEnemy)) {
        const def = CARDS[e.id];
        const units = allCards().filter((c) => isUnit(c));
        if (units.length) {
          // 敌人优先打血最厚的（士兵顶在前，村民才安全）
          units.sort((a, b) => (b.hp || 0) - (a.hp || 0));
          const v = units[0];
          v.hp -= def.atk;
          if (v.hp <= 0) {
            removeCard(v);
            toast(`${def.name} 斩杀了你的${CARDS[v.id].name}`, 'bad');
          } else {
            toast(`${def.name} 袭击了你的${CARDS[v.id].name}`, 'bad');
          }
        } else if (S.coins > 0) {
          S.coins = Math.max(0, S.coins - 4);
          toast(`${def.name} 抢走 4 铜钱`, 'bad');
        }
      }
    }

    if (checkLose()) return;

    // 3. 进入下一天
    S.day++;
    if (S.day > CONFIG.TOTAL_DAYS) {
      win();
      return;
    }
    const wave = WAVES[S.day];
    if (wave) {
      spawnWave(wave);
      toast(`第 ${S.day} 天：敌袭！`, 'bad');
    } else {
      toast(`第 ${S.day} 天`, '');
    }
    S.left = CONFIG.DAY_MS;
    render();
  }

  function removeCard(card) {
    for (const p of S.piles) {
      const i = p.cards.indexOf(card);
      if (i >= 0) {
        p.cards.splice(i, 1);
        return;
      }
    }
  }

  function spawnWave(wave) {
    const { w, h } = boardSize();
    for (const [id, n] of Object.entries(wave)) {
      for (let i = 0; i < n; i++) {
        const spot = freeSpot(Math.min(w - 120, w * 0.66), 60 + Math.random() * (h - 220));
        S.piles.push(makePile([makeCard(id)], spot.x, spot.y));
      }
    }
  }

  function checkLose() {
    if (S.over) return true;
    const units = allCards().filter(isUnit);
    if (units.length === 0 && S.running) {
      S.over = true;
      S.running = false;
      clearInterval(timerId);
      showEnd(false);
      return true;
    }
    return false;
  }

  function win() {
    S.over = true;
    S.running = false;
    clearInterval(timerId);
    render();
    showEnd(true);
  }

  /* ---------------- 结算界面 ---------------- */
  function showEnd(won) {
    $('#endTitle').textContent = won ? '守 住 了' : '村 子 没 了';
    $('#endSub').textContent = won
      ? `你在乱世里撑过了 ${CONFIG.TOTAL_DAYS} 天`
      : `你在第 ${Math.min(S.day, CONFIG.TOTAL_DAYS)} 天失去了最后一个人`;
    $('#endStats').innerHTML = `
      <div class="stat"><span class="n">${Math.min(S.day, CONFIG.TOTAL_DAYS)}</span><span class="l">存活天数</span></div>
      <div class="stat"><span class="n">${S.stats.crafted}</span><span class="l">合成次数</span></div>
      <div class="stat"><span class="n">${S.stats.killed}</span><span class="l">斩敌</span></div>
      <div class="stat"><span class="n">${S.discovered.size}/${RECIPES.length}</span><span class="l">图鉴</span></div>
      <div class="stat"><span class="n">${S.coins}</span><span class="l">结余铜钱</span></div>
      <div class="stat"><span class="n">${S.stats.soldCoins}</span><span class="l">卖货收入</span></div>`;
    $('#panelStart').classList.add('hidden');
    $('#panelHelp').classList.add('hidden');
    $('#panelEnd').classList.remove('hidden');
    $('#overlay').classList.add('show');
    S.paused = false;
    document.body.classList.remove('paused');
    $('#pauseMask').classList.add('hidden');
  }

  /* ---------------- 图鉴 / 帮助 ---------------- */
  function recipeLine(r) {
    const fmt = (obj) => Object.entries(obj).map(([id, n]) => CARDS[id].name + (n > 1 ? '×' + n : '')).join(' + ');
    const outTxt = r.alt ? r.alt.map(fmt).join(' 或 ') : fmt(r.out);
    // 采集点永远不会被采没：把「不消耗」标出来，省得玩家以为要省着用
    const keptNodes = Object.keys(r.keep || {}).filter((id) => CARDS[id].kind === 'node');
    const keepTxt = keptNodes.length ? `<i class="keepTip">${keptNodes.map((id) => CARDS[id].name).join('、')}不消耗</i>` : '';
    return `<div class="help-row"><b>${r.label}</b>　${fmt(r.in)}<span class="arrow">→</span>${outTxt}${keepTxt}</div>`;
  }

  function buildHelp() {
    const rows = RECIPES.map((r) =>
      S.discovered.has(r.id)
        ? recipeLine(r)
        : `<div class="help-row" style="opacity:.45"><b>???</b>　尚未发现</div>`
    ).join('');
    $('#helpGrid').innerHTML = rows + `<div class="help-row" style="grid-column:1/-1;opacity:.75">
      把资源拖进右下角市集卖钱；铜钱买卡包开新卡。同一堆牌拖一次就能再加工一次（比如村民 + 农田反复收粮）。每 2 天左右来一波敌人，派兵拖到敌人身上开打。</div>`;
  }

  /* ---------------- 开局 ---------------- */
  function reset() {
    S.piles = [];
    S.coins = CONFIG.START_COINS;
    S.day = 1;
    S.left = CONFIG.DAY_MS;
    S.over = false;
    S.running = false;
    S.paused = false;
    document.body.classList.remove('paused');
    $('#pauseMask').classList.add('hidden');
    $('#btnPause').textContent = '暂停';
    $('#btnPause').classList.remove('on');
    S.discovered = new Set();
    S.stats = { crafted: 0, killed: 0, soldCoins: 0 };
    S.uid = 1;
    S.pid = 1;

    const { w, h } = boardSize();
    const at = (fx, fy) => [w * fx - 47, h * fy - 66];
    const layout = w < 560
      ? [
          // 手机：3×3 网格，卡牌窄屏也不会叠在一起
          ['villager', 10, 12], ['villager', 96, 12], ['villager', 182, 12],
          ['tree', 10, 124], ['forest', 96, 124], ['stone', 182, 124],
          ['farm', 10, 236], ['food', 96, 236], ['food', 182, 236],
        ]
      : [
          ['villager', ...at(0.15, 0.30)],
          ['villager', ...at(0.15, 0.62)],
          ['villager', ...at(0.32, 0.62)],
          ['tree', ...at(0.42, 0.22)],
          ['forest', ...at(0.90, 0.22)],
          ['stone', ...at(0.58, 0.22)],
          ['farm', ...at(0.74, 0.22)],
          ['food', ...at(0.42, 0.74)],
          ['food', ...at(0.58, 0.74)],
        ];
    for (const [id, x, y] of layout) {
      S.piles.push(makePile([makeCard(id)], Math.max(14, x), Math.max(14, y)));
    }
  }

  function startGame() {
    $('#overlay').classList.remove('show');
    reset();
    S.running = true;
    render();
    startClock();
    toast('第 1 天 · 先派人去砍树', '');
  }

  /* ---------------- 事件绑定 ---------------- */
  $('#btnStart').addEventListener('click', startGame);
  $('#btnAgain').addEventListener('click', startGame);
  $('#buyRecruit').addEventListener('click', () => buyPack('recruitPack'));
  $('#buyTactic').addEventListener('click', () => buyPack('tacticPack'));
  $('#btnHelp').addEventListener('click', () => {
    buildHelp();
    $('#panelStart').classList.add('hidden');
    $('#panelEnd').classList.add('hidden');
    $('#panelHelp').classList.remove('hidden');
    $('#overlay').classList.add('show');
  });
  $('#btnCloseHelp').addEventListener('click', () => {
    $('#panelHelp').classList.add('hidden');
    if (!S.running) {
      $('#panelStart').classList.remove('hidden');
    } else {
      $('#overlay').classList.remove('show');
    }
  });

  window.addEventListener('resize', () => render());

  // 调试接口（方便自动化验收）
  window.__td = {
    S,
    start: startGame,
    endDay,
    render,
    buy: buyPack,
    sell: doSell,
    merge: tryMerge,
    craft,
  };

  render();
})();

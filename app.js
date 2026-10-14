const SAVE_KEY = 'seoa-rift-loop-v1';

class LocalSaveService {
  load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch { return null; }
  }
  save(state) { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  clear() { localStorage.removeItem(SAVE_KEY); }
}

const saveService = new LocalSaveService();

const baseState = () => ({
  gold: 0,
  wave: 1,
  bestWave: 0,
  attackLevel: 1,
  autoLevel: 1,
  baseAttack: 10,
  autoDps: 2,
  roundTime: 20,
  timeLeft: 20,
  enemyHp: 50,
  enemyHpMax: 50,
  inventory: [],
  equippedId: null,
  logs: ['균열이 열렸다. 첫 웨이브 시작.'],
  lastTick: Date.now(),
});

let state = Object.assign(baseState(), saveService.load() || {});

const el = id => document.getElementById(id);
const goldEl = el('gold'), powerEl = el('power'), bestWaveEl = el('bestWave');
const waveEl = el('wave'), timerEl = el('timer'), hpEl = el('enemyHp'), hpMaxEl = el('enemyHpMax');
const hpFill = el('enemyHpFill'), lootList = el('lootList'), logEl = el('log'), equippedEl = el('equipped');

function equipmentPower() {
  const item = state.inventory.find(x => x.id === state.equippedId);
  return item ? item.power : 0;
}
function totalAttack() { return state.baseAttack + (state.attackLevel - 1) * 2 + equipmentPower(); }
function totalAutoDps() { return state.autoDps + (state.autoLevel - 1) * 0.5 + equipmentPower() * 0.12; }
function atkCost() { return Math.floor(25 * Math.pow(1.55, state.attackLevel - 1)); }
function autoCost() { return Math.floor(40 * Math.pow(1.6, state.autoLevel - 1)); }
function enemyHpForWave(wave) { return Math.floor(50 * Math.pow(1.18, wave - 1)); }
function rewardForWave(wave) { return 12 + Math.floor(wave * 5.5); }

function addLog(text) {
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, 30);
}

function rarityForWave(wave) {
  const roll = Math.random();
  const luck = Math.min(0.18, wave * 0.003);
  if (roll < 0.03 + luck * .25) return ['전설', 2.3];
  if (roll < 0.12 + luck * .5) return ['영웅', 1.7];
  if (roll < 0.35 + luck) return ['희귀', 1.3];
  return ['일반', 1];
}

function makeLoot() {
  const [rarity, mult] = rarityForWave(state.wave);
  const types = ['균열검', '충격 장갑', '파동 코어', '헌터 링'];
  const type = types[Math.floor(Math.random() * types.length)];
  const base = Math.max(1, Math.floor((state.wave + Math.random() * 3) * mult));
  const options = [];
  const pool = ['치명타', '공격속도', '골드획득', '추가피해', '자동공격'];
  const count = rarity === '전설' ? 3 : rarity === '영웅' ? 2 : 1;
  for (let i=0;i<count;i++) options.push(pool[Math.floor(Math.random()*pool.length)] + ' +' + (2 + Math.floor(Math.random()*7)) + '%');
  return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), rarity, name:`${rarity} ${type}`, power:base, options };
}

function dropLootChance() {
  const chance = Math.min(.55, .2 + state.wave * .01);
  if (Math.random() <= chance) {
    const item = makeLoot();
    state.inventory.unshift(item);
    state.inventory = state.inventory.slice(0, 12);
    addLog(`장비 획득: ${item.name} (전투력 +${item.power})`);
  }
}

function killEnemy() {
  const reward = rewardForWave(state.wave);
  state.gold += reward;
  dropLootChance();
  addLog(`웨이브 ${state.wave} 클리어 · +${reward}G`);
  state.bestWave = Math.max(state.bestWave, state.wave);
  state.wave += 1;
  state.timeLeft = state.roundTime;
  state.enemyHpMax = enemyHpForWave(state.wave);
  state.enemyHp = state.enemyHpMax;
  persist();
}

function failWave() {
  addLog(`웨이브 ${state.wave} 실패 · 한 단계 후퇴`);
  state.wave = Math.max(1, state.wave - 1);
  state.timeLeft = state.roundTime;
  state.enemyHpMax = enemyHpForWave(state.wave);
  state.enemyHp = state.enemyHpMax;
  persist();
}

function damage(amount) {
  state.enemyHp = Math.max(0, state.enemyHp - amount);
  if (state.enemyHp <= 0) killEnemy();
}

el('attackBtn').addEventListener('click', () => damage(totalAttack()));
el('upgradeAtk').addEventListener('click', () => {
  const cost = atkCost();
  if (state.gold < cost) return addLog('골드가 부족해.');
  state.gold -= cost; state.attackLevel++; addLog(`공격력 강화 Lv.${state.attackLevel}`); persist(); render();
});
el('upgradeAuto').addEventListener('click', () => {
  const cost = autoCost();
  if (state.gold < cost) return addLog('골드가 부족해.');
  state.gold -= cost; state.autoLevel++; addLog(`자동공격 강화 Lv.${state.autoLevel}`); persist(); render();
});
el('equipBestBtn').addEventListener('click', () => {
  if (!state.inventory.length) return addLog('장비가 없어.');
  const best = [...state.inventory].sort((a,b)=>b.power-a.power)[0];
  state.equippedId = best.id; addLog(`${best.name} 장착`); persist(); render();
});
el('resetBtn').addEventListener('click', () => {
  if (!confirm('프로토타입 저장 데이터를 초기화할까?')) return;
  saveService.clear(); state = baseState(); persist(); render();
});

function persist() { saveService.save(state); }

function render() {
  goldEl.textContent = Math.floor(state.gold).toLocaleString();
  powerEl.textContent = Math.floor(totalAttack()).toLocaleString();
  bestWaveEl.textContent = state.bestWave;
  waveEl.textContent = state.wave;
  timerEl.textContent = state.timeLeft.toFixed(1);
  hpEl.textContent = Math.ceil(state.enemyHp);
  hpMaxEl.textContent = state.enemyHpMax;
  hpFill.style.width = `${Math.max(0, state.enemyHp/state.enemyHpMax*100)}%`;
  el('atkCost').textContent = `${atkCost()} G`;
  el('autoCost').textContent = `${autoCost()} G`;

  const equipped = state.inventory.find(x=>x.id===state.equippedId);
  equippedEl.innerHTML = equipped
    ? `<div class="loot-name">${equipped.name}</div><div class="loot-meta">${equipped.options.join(' · ')}</div><div class="loot-power">전투력 +${equipped.power}</div>`
    : '장착 장비 없음';

  lootList.innerHTML = state.inventory.length ? state.inventory.slice(0,6).map(item => `
    <div class="loot-item">
      <div><div class="loot-name">${item.name}</div><div class="loot-meta">${item.options.join(' · ')}</div></div>
      <div class="loot-power">+${item.power}</div>
    </div>`).join('') : '<div class="equipment-empty">아직 드랍된 장비가 없어.</div>';

  logEl.innerHTML = state.logs.map(x=>`<div>${x}</div>`).join('');
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now-last)/1000); last = now;
  state.timeLeft -= dt;
  damage(totalAutoDps() * dt);
  if (state.timeLeft <= 0 && state.enemyHp > 0) failWave();
  render();
  requestAnimationFrame(loop);
}

state.enemyHpMax = state.enemyHpMax || enemyHpForWave(state.wave);
state.enemyHp = Math.min(state.enemyHp || state.enemyHpMax, state.enemyHpMax);
render();
setInterval(persist, 1500);
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

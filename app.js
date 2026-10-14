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
  pendingLoot: [],
  equippedId: null,
  logs: ['균열이 열렸다. 첫 웨이브 시작.'],
  lastTick: Date.now(),
});

let state = Object.assign(baseState(), saveService.load() || {});
if (!Array.isArray(state.pendingLoot)) state.pendingLoot = [];
let selectedId = null;
let lootRevision = 0;
let renderedLootRevision = -1;
let comparisonKey = '';
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

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
  el('status').textContent = text;
  lootRevision++;
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
    state.pendingLoot.push(item);
    addLog(`장비 획득: ${item.name} (전투력 +${item.power})`);
    if (!el('lootDialog').open) openComparison(item.id);
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

el('attackBtn').addEventListener('click', () => { damage(totalAttack()); render(); });
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
  selectedId = null; comparisonKey = ''; lootRevision++;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  el('status').textContent = state.logs[0]; render();
});

function persist() { saveService.save(state); }

function itemMarkup(item) {
  if (!item) return '<div class="muted">장착 장비 없음</div><div class="loot-power">전투력 +0</div>';
  const rarity = ['일반','희귀','영웅','전설'].includes(item.rarity) ? item.rarity : '일반';
  return `<div class="loot-name rarity-${rarity}">${escapeHtml(item.name)}</div><div class="loot-power">전투력 +${escapeHtml(item.power)}</div><div class="loot-meta">${item.options.map(escapeHtml).join('<br>')}</div>`;
}
function selectedItem() { return [...state.pendingLoot, ...state.inventory].find(item => item.id === selectedId); }
function openComparison(id) {
  selectedId = id;
  comparisonKey = '';
  renderComparison();
  if (selectedItem() && !el('lootDialog').open) el('lootDialog').showModal();
}
function renderComparison() {
  const item = selectedItem();
  if (!item) return;
  const equipped = state.inventory.find(item => item.id === state.equippedId);
  const pending = state.pendingLoot.some(x => x.id === item.id);
  const full = pending && state.inventory.length >= 12;
  const key = JSON.stringify([item.id, state.equippedId, state.inventory.length, pending, state.pendingLoot.length]);
  if (key === comparisonKey) return;
  comparisonKey = key;
  el('currentItem').innerHTML = itemMarkup(equipped);
  el('newItem').innerHTML = itemMarkup(item);
  el('lootContext').textContent = pending ? `NEW DROP · 대기 ${state.pendingLoot.length}개` : 'INVENTORY';
  el('newItemTitle').textContent = pending ? '새 장비' : '선택한 장비';
  const delta = item.power - (equipped ? equipped.power : 0);
  const sign = delta > 0 ? '+' : '';
  el('comparison').innerHTML = `<div class="${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">장착 시 공격력 ${sign}${delta} / 회<br>자동 피해 ${sign}${(delta * .12).toFixed(2)} / 초</div>`;
  el('capacityNote').textContent = full ? '보관함이 가득 찼어. 닫기 → 인벤토리에서 장비를 분해하면 선택할 수 있어. 새 장비는 대기에 남아.' : '';
  el('equipItem').disabled = full || item.id === state.equippedId;
  el('equipItem').textContent = item.id === state.equippedId ? '장착 중' : '장착';
  el('storeItem').disabled = full;
  el('storeItem').textContent = pending ? '보관' : '닫기';
}
function resolveItem(action) {
  const item = selectedItem();
  if (!item) return;
  const pending = state.pendingLoot.some(x => x.id === item.id);
  if (action !== 'dismantle' && pending && state.inventory.length >= 12) return;
  if (action === 'dismantle') {
    if (!confirm(`${item.name}을(를) 분해할까? 장비가 사라지고 보상은 없어.`)) return;
    state.inventory = state.inventory.filter(x => x.id !== item.id);
    if (state.equippedId === item.id) state.equippedId = null;
  } else {
    if (pending) state.inventory.unshift(item);
    if (action === 'equip') state.equippedId = item.id;
  }
  state.pendingLoot = state.pendingLoot.filter(x => x.id !== item.id);
  addLog(`${item.name} · ${action === 'equip' ? '장착' : action === 'store' ? '보관' : '분해'}`);
  selectedId = null;
  persist(); render(); el('lootDialog').close();
  if (pending && state.pendingLoot.length) openComparison(state.pendingLoot[0].id);
}
el('equipItem').addEventListener('click', () => resolveItem('equip'));
el('storeItem').addEventListener('click', () => {
  if (state.pendingLoot.some(x => x.id === selectedId)) resolveItem('store');
  else el('lootDialog').close();
});
el('dismantleItem').addEventListener('click', () => resolveItem('dismantle'));
el('closeLoot').addEventListener('click', () => el('lootDialog').close());
el('inventoryBtn').addEventListener('click', () => el('inventoryDialog').showModal());
el('closeInventory').addEventListener('click', () => el('inventoryDialog').close());
el('pendingBtn').addEventListener('click', () => {
  if (state.pendingLoot.length) openComparison(state.pendingLoot[0].id);
});
el('equipped').addEventListener('click', () => {
  if (state.equippedId) openComparison(state.equippedId);
  else el('inventoryDialog').showModal();
});
el('logBtn').addEventListener('click', () => el('logDialog').showModal());
el('closeLog').addEventListener('click', () => el('logDialog').close());

const tabSheet = el('tabSheet');
const tabTitle = el('tabTitle');
const tabLabels = {stats:'스탯', equipment:'장비', upgrade:'업그레이드'};
let activeTab = 'stats';
function setTab(name, forceOpen=true) {
  activeTab = name;
  document.querySelectorAll('[data-tab-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.tabPanel === name));
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  tabTitle.textContent = tabLabels[name] || '';
  if (forceOpen) tabSheet.classList.add('open');
}
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  const same = activeTab === button.dataset.tab && tabSheet.classList.contains('open');
  if (same && matchMedia('(max-width:700px)').matches) tabSheet.classList.remove('open');
  else setTab(button.dataset.tab, true);
}));
el('closeTab').addEventListener('click', () => tabSheet.classList.remove('open'));
setTab('stats', !matchMedia('(max-width:700px)').matches);

lootList.addEventListener('click', event => {
  const button = event.target.closest('[data-item-id]');
  if (button) openComparison(button.dataset.itemId);
});
el('lootDialog').addEventListener('close', () => { if (!el('lootDialog').open) selectedId = null; });

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
  el('autoDps').textContent = totalAutoDps().toFixed(2);
  el('equipmentPower').textContent = `+${equipmentPower()}`;
  el('attackAmount').textContent = totalAttack();
  el('dropChance').textContent = `${(Math.min(.55, .2 + state.wave * .01) * 100).toFixed(0)}%`;
  el('attackLevel').textContent = `Lv.${state.attackLevel} · +2`;
  el('autoLevel').textContent = `Lv.${state.autoLevel} · +0.5/초`;
  el('upgradeAtk').disabled = state.gold < atkCost();
  el('upgradeAuto').disabled = state.gold < autoCost();
  el('inventoryCount').textContent = state.inventory.length;
  el('pendingCount').textContent = state.pendingLoot.length;
  el('pendingBtn').disabled = !state.pendingLoot.length;
  el('navPower').textContent = `ATK ${Math.floor(totalAttack()).toLocaleString()}`;
  const equippedSummary = state.inventory.find(x => x.id === state.equippedId);
  el('navEquipment').textContent = equippedSummary ? `+${equippedSummary.power}` : '미장착';
  renderComparison();
  if (renderedLootRevision === lootRevision) return;
  renderedLootRevision = lootRevision;

  const equipped = state.inventory.find(x=>x.id===state.equippedId);
  equippedEl.innerHTML = equipped
    ? itemMarkup(equipped)
    : '장착 장비 없음';

  lootList.innerHTML = state.inventory.length ? state.inventory.map(item => `
    <button class="loot-item" data-item-id="${escapeHtml(item.id)}">
      <div>${itemMarkup(item)}</div><span class="pill">${item.id === state.equippedId ? '장착 중' : '비교'}</span>
    </button>`).join('') : '<div class="muted">보관한 장비가 없어.</div>';

  logEl.innerHTML = state.logs.map(x=>`<div>${escapeHtml(x)}</div>`).join('');
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
el('status').textContent = state.logs[0] || '진행 중';
if (state.pendingLoot.length) openComparison(state.pendingLoot[0].id);
setInterval(persist, 1500);
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

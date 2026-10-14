const saveService = new LocalSaveService();

const freshRunStats = startWave => ({
  startWave,
  kills: 0,
  gold: 0,
  xp: 0,
  items: 0,
  checkpointAtStart: 1,
});

const baseState = () => ({
  gold: 0,
  wave: 1,
  bestWave: 0,
  highestCheckpoint: 1,
  waveEnemyTotal: 0,
  waveEnemyIndex: 0,
  runStatus: 'idle',
  runEndReason: null,
  resultPending: false,
  selectedStartWave: 1,
  stamina: 0,
  runStats: freshRunStats(1),
  attackLevel: 1,
  critLevel: 1,
  autoLevel: 1,
  baseAttack: 10,
  autoDps: 2,
  level: 1,
  xp: 0,
  skillPoints: 0,
  skills: { power: 0, crit: 0, growth: 0, stamina: 0 },
  enemyHp: 50,
  enemyHpMax: 50,
  inventory: [],
  pendingLoot: [],
  equippedId: null,
  logs: ['정비 후 첫 전투를 시작해.'],
  lastTick: Date.now(),
  runSystemVersion: 1,
});

let state = Object.assign(baseState(), saveService.load() || {});
if (!Array.isArray(state.pendingLoot)) state.pendingLoot = [];
if (!Array.isArray(state.inventory)) state.inventory = [];
if (!Array.isArray(state.logs)) state.logs = [];
if (!state.skills || typeof state.skills !== 'object') state.skills = {};
state.skills = Object.assign({ power: 0, crit: 0, growth: 0, stamina: 0 }, state.skills);
state.level = Math.max(1, Number(state.level) || 1);
state.xp = Math.max(0, Number(state.xp) || 0);
state.skillPoints = Math.max(0, Number(state.skillPoints) || 0);
state.critLevel = Math.max(1, Number(state.critLevel) || 1);

if (state.runSystemVersion !== 1) {
  state.wave = 1;
  state.bestWave = 0;
  state.highestCheckpoint = 1;
  state.waveEnemyTotal = 0;
  state.waveEnemyIndex = 0;
  state.runStatus = 'idle';
  state.runEndReason = null;
  state.resultPending = false;
  state.selectedStartWave = 1;
  state.stamina = 0;
  state.runStats = freshRunStats(1);
  state.runSystemVersion = 1;
}
if (!state.runStats || typeof state.runStats !== 'object') state.runStats = freshRunStats(1);
state.runStats = Object.assign(freshRunStats(state.selectedStartWave || 1), state.runStats);
state.highestCheckpoint = Math.max(1, Number(state.highestCheckpoint) || 1);
state.selectedStartWave = Math.max(1, Number(state.selectedStartWave) || 1);

let selectedId = null;
let lootRevision = 0;
let renderedLootRevision = -1;
let comparisonKey = '';

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const el = id => document.getElementById(id);
const goldEl = el('gold'), powerEl = el('power'), bestWaveEl = el('bestWave');
const waveEl = el('wave'), hpEl = el('enemyHp'), hpMaxEl = el('enemyHpMax');
const hpFill = el('enemyHpFill'), lootList = el('lootList'), logEl = el('log'), equippedEl = el('equipped');

function equipmentPower() {
  const item = state.inventory.find(x => x.id === state.equippedId);
  return item ? item.power : 0;
}
function powerMultiplier() { return 1 + state.skills.power * 0.03; }
function critChance() { return Math.min(0.75, 0.05 + (state.critLevel - 1) * 0.005 + state.skills.crit * 0.005); }
function xpMultiplier() { return 1 + state.skills.growth * 0.05; }
function maxStamina() { return Math.floor(100 * (1 + state.skills.stamina * 0.05)); }
function totalAttack() { return (state.baseAttack + (state.attackLevel - 1) * 2 + equipmentPower()) * powerMultiplier(); }
function totalAutoDps() {
  const raw = (state.autoDps + (state.autoLevel - 1) * 0.5 + equipmentPower() * 0.12) * powerMultiplier();
  return raw * (1 + critChance());
}
function atkCost() { return Math.floor(25 * Math.pow(1.55, state.attackLevel - 1)); }
function critCost() { return Math.floor(35 * Math.pow(1.58, state.critLevel - 1)); }
function autoCost() { return Math.floor(40 * Math.pow(1.6, state.autoLevel - 1)); }
function xpForNextLevel(level = state.level) { return Math.floor(100 * Math.pow(1.35, level - 1)); }
function enemyHpForWave(wave) { return Math.floor(50 * Math.pow(1.12, wave - 1)); }
function goldRewardForKill(wave) { return 3 + Math.floor(wave * 0.9); }
function xpRewardForKill(wave) { return Math.floor((2 + wave * 0.6) * xpMultiplier()); }
function dropChanceForWave(wave) { return Math.min(0.12, 0.04 + wave * 0.001); }
function enemiesForWave() { return 5 + Math.floor(Math.random() * 6); }

function gainXp(amount) {
  state.xp += amount;
  let leveled = 0;
  while (state.xp >= xpForNextLevel()) {
    state.xp -= xpForNextLevel();
    state.level += 1;
    state.skillPoints += 1;
    leveled += 1;
  }
  if (leveled) addLog(`레벨 업! Lv.${state.level} · 스킬 포인트 +${leveled}`);
}

function addLog(text) {
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, 40);
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
  for (let i=0; i<count; i++) options.push(pool[Math.floor(Math.random()*pool.length)] + ' +' + (2 + Math.floor(Math.random()*7)) + '%');
  return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), rarity, name:`${rarity} ${type}`, power:base, options };
}

function rollLootForKill() {
  if (Math.random() > dropChanceForWave(state.wave)) return null;
  const item = makeLoot();
  state.pendingLoot.push(item);
  state.runStats.items += 1;
  addLog(`장비 획득: ${item.name} (전투력 +${item.power})`);
  return item;
}

function setupWave(wave) {
  state.wave = wave;
  state.waveEnemyTotal = enemiesForWave();
  state.waveEnemyIndex = 0;
  state.enemyHpMax = enemyHpForWave(wave);
  state.enemyHp = state.enemyHpMax;
}

function availableCheckpoints() {
  const points = [1];
  for (let wave = 10; wave <= state.highestCheckpoint; wave += 10) points.push(wave);
  return points;
}

function normalizeSelectedStartWave() {
  const points = availableCheckpoints();
  if (!points.includes(state.selectedStartWave)) state.selectedStartWave = points[points.length - 1];
}

function startRun() {
  if (state.runStatus === 'running') return;
  normalizeSelectedStartWave();
  state.runStatus = 'running';
  state.runEndReason = null;
  state.resultPending = false;
  state.stamina = maxStamina();
  state.runStats = freshRunStats(state.selectedStartWave);
  state.runStats.checkpointAtStart = state.highestCheckpoint;
  setupWave(state.selectedStartWave);
  addLog(`${state.selectedStartWave}웨이브부터 전투 시작 · 활동력 ${state.stamina}`);
  persist();
  render();
}

function unlockCheckpoint(clearedWave) {
  if (clearedWave < 10 || clearedWave % 10 !== 0) return;
  if (clearedWave <= state.highestCheckpoint) return;
  state.highestCheckpoint = clearedWave;
  addLog(`체크포인트 해금: ${clearedWave}웨이브`);
}

function completeWave() {
  const clearedWave = state.wave;
  state.bestWave = Math.max(state.bestWave, clearedWave);
  unlockCheckpoint(clearedWave);
  setupWave(clearedWave + 1);
}

function runEndReason() {
  if (state.stamina <= 0) return 'stamina';
  // 추후 사냥 체력 시스템이 들어오면 playerHp <= 0 조건을 여기에 추가한다.
  return null;
}

function endRun(reason) {
  if (state.runStatus !== 'running') return;
  state.runStatus = 'ended';
  state.runEndReason = reason;
  state.resultPending = true;
  state.stamina = Math.max(0, state.stamina);
  addLog(reason === 'stamina' ? '활동력을 모두 사용해서 한 판 종료.' : '한 판 종료.');
  persist();
  render();
  showResultDialog();
}

function killEnemy() {
  if (state.runStatus !== 'running') return;

  const killedWave = state.wave;
  const goldReward = goldRewardForKill(killedWave);
  const xpReward = xpRewardForKill(killedWave);

  state.gold += goldReward;
  gainXp(xpReward);
  state.runStats.kills += 1;
  state.runStats.gold += goldReward;
  state.runStats.xp += xpReward;
  rollLootForKill();

  state.stamina = Math.max(0, state.stamina - 1);
  state.waveEnemyIndex += 1;

  const completedWave = state.waveEnemyIndex >= state.waveEnemyTotal;
  if (completedWave) completeWave();
  else {
    state.enemyHpMax = enemyHpForWave(state.wave);
    state.enemyHp = state.enemyHpMax;
  }

  const reason = runEndReason();
  if (reason) {
    endRun(reason);
    return;
  }

  const progressText = completedWave
    ? `${killedWave}웨이브 클리어`
    : `${killedWave}웨이브 ${state.waveEnemyIndex}/${state.waveEnemyTotal}`;
  addLog(`${progressText} · +${goldReward}G · +${xpReward}XP`);
  persist();
}

function damage(amount) {
  if (state.runStatus !== 'running') return;
  state.enemyHp = Math.max(0, state.enemyHp - amount);
  if (state.enemyHp <= 0) killEnemy();
}

el('attackBtn').addEventListener('click', () => {
  if (state.runStatus !== 'running') return;
  const critical = Math.random() < critChance();
  const amount = totalAttack() * (critical ? 2 : 1);
  damage(amount);
  if (critical && state.runStatus === 'running') el('status').textContent = `치명타! ${Math.floor(amount).toLocaleString()} 피해`;
  render();
});

el('startRunBtn').addEventListener('click', startRun);
el('startWave').addEventListener('change', event => {
  const value = Number(event.target.value);
  if (availableCheckpoints().includes(value)) {
    state.selectedStartWave = value;
    persist();
    render();
  }
});

el('upgradeAtk').addEventListener('click', () => {
  const cost = atkCost();
  if (state.gold < cost) return addLog('골드가 부족해.');
  state.gold -= cost; state.attackLevel++; addLog(`공격력 강화 Lv.${state.attackLevel}`); persist(); render();
});
el('upgradeCrit').addEventListener('click', () => {
  const cost = critCost();
  if (state.gold < cost) return addLog('골드가 부족해.');
  state.gold -= cost; state.critLevel++; addLog(`치명타 강화 Lv.${state.critLevel}`); persist(); render();
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
  saveService.clear();
  state = baseState();
  selectedId = null;
  comparisonKey = '';
  lootRevision++;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  persist();
  render();
  el('status').textContent = state.logs[0];
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
  el('capacityNote').textContent = full ? '보관함이 가득 찼어. 인벤토리에서 장비를 분해한 뒤 다시 선택해.' : '';
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
const tabLabels = {stats:'스탯', equipment:'장비', home:'홈', upgrade:'업그레이드', more:'기타'};
let activeTab = 'home';
function setTab(name) {
  activeTab = name;
  document.querySelectorAll('[data-tab-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.tabPanel === name));
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  tabTitle.textContent = tabLabels[name] || '';
  tabSheet.classList.add('open');
}
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
setTab('home');

let activeUpgradeView = 'gold';
function setUpgradeView(name) {
  activeUpgradeView = name;
  document.querySelectorAll('[data-upgrade-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.upgradePanel === name));
  document.querySelectorAll('[data-upgrade-view]').forEach(button => button.classList.toggle('active', button.dataset.upgradeView === name));
}
document.querySelectorAll('[data-upgrade-view]').forEach(button => button.addEventListener('click', () => setUpgradeView(button.dataset.upgradeView)));
setUpgradeView('gold');

document.querySelectorAll('[data-skill]').forEach(button => button.addEventListener('click', () => {
  const skill = button.dataset.skill;
  if (!(skill in state.skills)) return;
  if (state.skillPoints <= 0) return addLog('사용할 수 있는 스킬 포인트가 없어.');
  if (state.skills[skill] >= 20) return addLog('이 패시브는 현재 최대 레벨이야.');
  state.skillPoints -= 1;
  state.skills[skill] += 1;
  const names = {power:'전투 감각', crit:'정밀 타격', growth:'성장 가속', stamina:'지구력'};
  addLog(`${names[skill]} Lv.${state.skills[skill]}`);
  persist();
  render();
}));

lootList.addEventListener('click', event => {
  const button = event.target.closest('[data-item-id]');
  if (button) openComparison(button.dataset.itemId);
});
el('lootDialog').addEventListener('close', () => { if (!el('lootDialog').open) selectedId = null; });

function showResultDialog() {
  const stats = state.runStats;
  el('resultReason').textContent = state.runEndReason === 'stamina' ? '활동력을 모두 사용했어.' : '한 판이 종료됐어.';
  el('resultStartWave').textContent = `${stats.startWave}W`;
  el('resultEndWave').textContent = `${state.wave}W · ${state.waveEnemyIndex}/${state.waveEnemyTotal}`;
  el('resultKills').textContent = stats.kills.toLocaleString();
  el('resultGold').textContent = `${stats.gold.toLocaleString()} G`;
  el('resultXp').textContent = `${stats.xp.toLocaleString()} XP`;
  el('resultItems').textContent = `${stats.items}개`;
  const unlocked = state.highestCheckpoint > stats.checkpointAtStart;
  el('resultCheckpoint').textContent = unlocked
    ? `새 체크포인트 해금 · ${state.highestCheckpoint}웨이브부터 시작 가능`
    : `현재 최고 체크포인트 · ${state.highestCheckpoint}웨이브`;
  if (!el('resultDialog').open) el('resultDialog').showModal();
}

el('closeResult').addEventListener('click', () => {
  state.resultPending = false;
  state.runStatus = 'idle';
  state.runEndReason = null;
  el('resultDialog').close();
  persist();
  render();
  setTab('equipment');
});

function renderStartWaveOptions() {
  normalizeSelectedStartWave();
  const select = el('startWave');
  const points = availableCheckpoints();
  const signature = points.join(',');
  if (select.dataset.signature !== signature) {
    select.innerHTML = points.map(w => `<option value="${w}">${w}웨이브</option>`).join('');
    select.dataset.signature = signature;
  }
  select.value = String(state.selectedStartWave);
}

function render() {
  const running = state.runStatus === 'running';

  goldEl.textContent = Math.floor(state.gold).toLocaleString();
  powerEl.textContent = Math.floor(totalAttack()).toLocaleString();
  bestWaveEl.textContent = state.bestWave;
  waveEl.textContent = state.wave;
  el('enemyProgress').textContent = `${Math.min(state.waveEnemyIndex + (running ? 1 : 0), state.waveEnemyTotal)} / ${state.waveEnemyTotal}`;
  el('stamina').textContent = state.stamina;
  el('maxStamina').textContent = maxStamina();
  el('statMaxStamina').textContent = maxStamina();
  el('highestCheckpoint').textContent = state.highestCheckpoint;

  el('runPrep').hidden = running;
  el('runArena').hidden = !running;
  el('runStatePill').textContent = running ? '자동 진행 중' : '대기 중';
  el('navRunState').textContent = running ? `활동력 ${state.stamina}` : '준비';
  el('checkpointBadge').textContent = `체크포인트 ${state.highestCheckpoint}`;
  renderStartWaveOptions();

  el('arenaWave').textContent = state.wave;
  el('arenaEnemyProgress').textContent = running ? `${state.waveEnemyIndex + 1} / ${state.waveEnemyTotal}` : '0 / 0';
  hpEl.textContent = Math.ceil(state.enemyHp);
  hpMaxEl.textContent = state.enemyHpMax;
  hpFill.style.width = `${state.enemyHpMax ? Math.max(0, state.enemyHp/state.enemyHpMax*100) : 0}%`;
  el('attackBtn').disabled = !running;

  el('atkCost').textContent = `${atkCost()} G`;
  el('critCost').textContent = `${critCost()} G`;
  el('autoCost').textContent = `${autoCost()} G`;
  el('autoDps').textContent = totalAutoDps().toFixed(2);
  el('equipmentPower').textContent = `+${equipmentPower()}`;
  el('attackAmount').textContent = Math.floor(totalAttack()).toLocaleString();
  el('critChance').textContent = `${(critChance() * 100).toFixed(1)}%`;
  el('playerLevel').textContent = `Lv.${state.level}`;
  el('playerXp').textContent = `${Math.floor(state.xp).toLocaleString()} / ${xpForNextLevel().toLocaleString()}`;
  el('skillPoints').textContent = state.skillPoints;
  el('dropChance').textContent = `${(dropChanceForWave(state.wave) * 100).toFixed(1)}%`;
  el('attackLevel').textContent = `Lv.${state.attackLevel} · +2 / 회`;
  el('critLevel').textContent = `Lv.${state.critLevel} · +0.5%`;
  el('autoLevel').textContent = `Lv.${state.autoLevel} · +0.5/초`;
  el('upgradeAtk').disabled = state.gold < atkCost();
  el('upgradeCrit').disabled = state.gold < critCost();
  el('upgradeAuto').disabled = state.gold < autoCost();
  el('upgradeGold').textContent = Math.floor(state.gold).toLocaleString();

  el('skillTreeLevel').textContent = `Lv.${state.level}`;
  el('skillTreePoints').textContent = state.skillPoints;
  el('xpText').textContent = `${Math.floor(state.xp).toLocaleString()} / ${xpForNextLevel().toLocaleString()} XP`;
  el('xpFill').style.width = `${Math.min(100, state.xp / xpForNextLevel() * 100)}%`;
  el('skillPowerLevel').textContent = state.skills.power;
  el('skillCritLevel').textContent = state.skills.crit;
  el('skillGrowthLevel').textContent = state.skills.growth;
  el('skillStaminaLevel').textContent = state.skills.stamina;
  document.querySelectorAll('[data-skill]').forEach(button => {
    const skill = button.dataset.skill;
    button.disabled = state.skillPoints <= 0 || state.skills[skill] >= 20;
  });

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
  equippedEl.innerHTML = equipped ? itemMarkup(equipped) : '장착 장비 없음';

  lootList.innerHTML = state.inventory.length ? state.inventory.map(item => `
    <button class="loot-item" data-item-id="${escapeHtml(item.id)}">
      <div>${itemMarkup(item)}</div><span class="pill">${item.id === state.equippedId ? '장착 중' : '비교'}</span>
    </button>`).join('') : '<div class="muted">보관한 장비가 없어.</div>';

  logEl.innerHTML = state.logs.map(x=>`<div>${escapeHtml(x)}</div>`).join('');
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now-last)/1000);
  last = now;
  if (state.runStatus === 'running') damage(totalAutoDps() * dt);
  render();
  requestAnimationFrame(loop);
}

if (state.runStatus === 'running') {
  if (!state.waveEnemyTotal) state.waveEnemyTotal = enemiesForWave();
  if (!state.enemyHpMax) state.enemyHpMax = enemyHpForWave(state.wave);
  state.enemyHp = Math.min(state.enemyHp || state.enemyHpMax, state.enemyHpMax);
} else {
  state.stamina = Math.max(0, state.stamina || 0);
}
normalizeSelectedStartWave();
persist();
render();
el('status').textContent = state.logs[0] || '정비 후 전투를 시작해.';
if (state.resultPending) showResultDialog();
setInterval(persist, 1500);
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

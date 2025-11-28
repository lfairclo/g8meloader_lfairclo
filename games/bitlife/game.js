// game.js — MiniLife (mobile-style BitLife clone)
// Updated: Tabs (Life/Jobs/Achievements/Settings) and full Relationships system

(() => {
  // --- Utilities ---
  const $ = id => document.getElementById(id);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const now = () => Date.now();
  const uid = () => now() + '-' + Math.random().toString(36).slice(2, 9);

  // --- Default State ---
  const DEFAULT_STATE = {
    name: 'Player',
    age: 0,
    happiness: 60,
    health: 70,
    smarts: 50,
    looks: 50,
    money: 100,
    log: [],
    job: null,
    alive: true,
    people: [], // relationship objects
    achievements: {},
    settings: {theme: 'dark', autosave: true},
    seed: Date.now()
  };

  // --- Game Data ---
  const jobs = [
    {id: 'intern', title: 'Intern', pay: 100},
    {id: 'cashier', title: 'Cashier', pay: 200},
    {id: 'developer', title: 'Web Developer', pay: 1000, requiresSmarts: 60},
    {id: 'doctor', title: 'Doctor', pay: 2000, requiresSmarts: 85}
  ];

  const activities = [
    {id: 'read', title: 'Read a Book', happiness: 1, smarts: 2, desc: 'You read and gained smarts.'},
    {id: 'jog', title: 'Go for a Jog', happiness: 2, health: 3, desc: 'Fresh air! Health increased.'},
    {id: 'party', title: 'Throw a Party', happiness: 8, health: -2, money: -50, desc: 'It was wild. Fun but expensive.'},
    {id: 'study', title: 'Study Hard', happiness: -2, smarts: 4, desc: 'Long nights paying off.'}
  ];

  const randomEvents = [
    age => ({text: `You had a quiet year.`, delta: {}}),
    age => ({text: `You got a promotion at ${age} years old!`, delta: {money: +rand(100, 800)}}),
    age => ({text: `You got sick for a while.`, delta: {health: -rand(5, 18), happiness: -rand(1, 5)}}),
    age => ({text: `You fell in love.`, delta: {happiness: +rand(5, 15)}}),
    age => ({text: `You were scammed and lost money.`, delta: {money: -rand(20, 200)}})
  ];

  // --- State ---
  let state = loadState() || {...DEFAULT_STATE};
  ensureStateDefaults();

  // --- DOM Refs ---
  const refs = {
    age: $('stat-age'),
    happiness: $('stat-happiness'),
    health: $('stat-health'),
    smarts: $('stat-smarts'),
    looks: $('stat-looks'),
    money: $('stat-money'),
    log: $('log'),
    subtitle: $('subtitle'),
    btnAge: $('btn-age'),
    btnActivities: $('btn-activities'),
    btnWork: $('btn-work'),
    btnRelationship: $('btn-relationship'),
    btnSave: $('btn-save'),
    btnLoad: $('btn-load'),
    btnExport: $('btn-export'),
    btnImport: $('btn-import'),
    importFile: $('import-file'),
    modal: $('modal'),
    modalBody: $('modal-body'),
    modalClose: $('modal-close'),
    navPanel: document.querySelectorAll('.nav-btn')
  };

  // --- Initialization ---
  bindButtons();
  renderAll();
  if (state.people.length === 0) generateFamily();
  addLog('You were born.');

  // --- Functions ---
  function bindButtons() {
    refs.btnAge.addEventListener('click', ageUp);
    refs.btnActivities.addEventListener('click', showActivities);
    refs.btnWork.addEventListener('click', showJobs);
    refs.btnRelationship.addEventListener('click', () => openTab('life')); // main relationships quick

    refs.btnSave.addEventListener('click', () => { saveState(); toast('Saved locally'); });
    refs.btnLoad.addEventListener('click', () => { const s = loadState(); if (s) { state = s; ensureStateDefaults(); renderAll(); toast('Loaded'); } else toast('No save found'); });
    refs.btnExport.addEventListener('click', exportState);
    refs.btnImport.addEventListener('click', () => refs.importFile.click());
    refs.importFile.addEventListener('change', handleImportFile);
    refs.modalClose.addEventListener('click', closeModal);
    refs.modal.addEventListener('click', (e) => { if (e.target === refs.modal) closeModal(); });

    refs.navPanel.forEach(btn => btn.addEventListener('click', (e) => {
      const tab = btn.dataset.tab;
      openTab(tab);
    }));
  }

  function openTab(tab) {
    if (tab === 'life') return showLifePanel();
    if (tab === 'jobs') return showJobsPanel();
    if (tab === 'achieve') return showAchievementsPanel();
    if (tab === 'settings') return showSettingsPanel();
  }

  // --- Tabs Implementation (modals act as panels) ---
  function showLifePanel() {
    const html = `
      <h3>Life Summary</h3>
      <p><strong>Age:</strong> ${state.age} &nbsp;&nbsp; <strong>Job:</strong> ${state.job ? state.job.title : 'Unemployed'}</p>
      <p><strong>Money:</strong> $${state.money}</p>
      <hr>
      <h4>Relationships</h4>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto">${state.people.map(p=>`<div class='person-row' data-id='${p.id}' style='padding:8px;background:rgba(255,255,255,0.02);border-radius:8px;cursor:pointer'>${escapeHtml(p.name)} — ${p.relation} — <small>Relation: ${p.relationLevel}</small></div>`).join('')}</div>
      <hr>
      <h4>Recent Events</h4>
      <div style='max-height:200px;overflow:auto'>${state.log.slice(-30).reverse().map(l=>`<div style='padding:6px;border-bottom:1px solid rgba(255,255,255,0.02)'><small>Age ${l.age}:</small> ${escapeHtml(l.text)}</div>`).join('')}</div>
    `;
    openModal(html);
    document.querySelectorAll('.person-row').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.id; openPersonPanel(id);
    }));
  }

  function showJobsPanel() {
    const html = `
      <h3>Jobs</h3>
      <div style='display:grid;grid-template-columns:1fr;gap:8px'>${jobs.map(j=>`<div class='job-row' data-id='${j.id}' style='padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer'><strong>${j.title}</strong><br><small>$${j.pay}/yr</small></div>`).join('')}</div>
    `;
    openModal(html);
    document.querySelectorAll('.job-row').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.id; applyForJob(id); closeModal();
    }));
  }

  function showAchievementsPanel() {
    const unlocked = Object.keys(state.achievements).filter(k => state.achievements[k]);
    const html = `<h3>Achievements</h3><div style='display:grid;gap:8px'>${unlocked.length?unlocked.map(k=>`<div style='padding:8px;background:rgba(255,255,255,0.02);border-radius:8px'>${escapeHtml(k)}</div>`).join(''):`<div style='padding:8px;color:var(--muted)'>No achievements yet.</div>`}</div>`;
    openModal(html);
  }

  function showSettingsPanel() {
    const html = `
      <h3>Settings</h3>
      <div style='display:flex;flex-direction:column;gap:8px'>
        <label><input type='checkbox' id='chk-autosave' ${state.settings.autosave? 'checked':''}> Autosave</label>
        <label>Theme: <select id='sel-theme'><option value='dark'>Dark</option><option value='light'>Light</option></select></label>
        <button id='btn-reset'>Reset Save</button>
      </div>
    `;
    openModal(html);
    $('#sel-theme').value = state.settings.theme || 'dark';
    $('#sel-theme').addEventListener('change', (e) => { state.settings.theme = e.target.value; applyTheme(); saveState(); });
    $('#chk-autosave').addEventListener('change', (e) => { state.settings.autosave = e.target.checked; saveState(); });
    $('#btn-reset').addEventListener('click', () => { if (confirm('Reset save and start fresh?')) { state = {...DEFAULT_STATE}; ensureStateDefaults(); saveState(); renderAll(); closeModal(); } });
  }

  // --- Relationships System ---
  function generateFamily() {
    // Strategy: generate parents, 0-4 siblings, and some extended family
    const people = [];
    const genders = ['male','female'];

    // parents
    const mom = createPerson('Mom', 'parent', 'female');
    const dad = createPerson('Dad', 'parent', 'male');
    people.push(mom, dad);

    // siblings
    const sibCount = rand(0,4);
    for (let i = 0; i < sibCount; i++) {
      people.push(createPerson(`Sibling ${i+1}`, 'sibling', genders[rand(0,1)]));
    }

    // grandparents
    const gpCount = rand(0,2);
    for (let i = 0; i < gpCount; i++) people.push(createPerson(`Grandparent ${i+1}`, 'grandparent', genders[rand(0,1)]));

    // some friends
    const friendCount = rand(1,4);
    for (let i = 0; i < friendCount; i++) people.push(createPerson(`Friend ${i+1}`, 'friend', genders[rand(0,1)]));

    state.people = people;
    saveState();
  }

  function createPerson(name, relation = 'friend', gender = 'female') {
    return {
      id: uid(),
      name: name,
      relation: relation,
      relationLevel: rand(30, 80), // 0-100 closeness
      happinessBoost: rand(-5, 5),
      age: Math.max(0, state.age + rand(-30, 30)),
      gender: gender,
      history: []
    };
  }

  function openPersonPanel(personId) {
    const p = state.people.find(x => x.id === personId);
    if (!p) return;
    const html = `
      <h3>${escapeHtml(p.name)} <small>(${escapeHtml(p.relation)})</small></h3>
      <p>Age: ${p.age} • Relation: ${p.relationLevel}</p>
      <div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px'>
        <button class='person-action' data-action='talk'>Talk</button>
        <button class='person-action' data-action='compliment'>Compliment</button>
        <button class='person-action' data-action='gift'>Gift</button>
        <button class='person-action' data-action='spendtime'>Spend Time</button>
        <button class='person-action' data-action='insult'>Insult</button>
        <button class='person-action' data-action='askmoney'>Ask for Money</button>
      </div>
      <hr>
      <h4>Interaction History</h4>
      <div style='max-height:180px;overflow:auto'>${p.history.slice().reverse().map(h=>`<div style='padding:6px;border-bottom:1px solid rgba(255,255,255,0.02)'>${escapeHtml(h)}</div>`).join('')}</div>
    `;

    openModal(html);
    document.querySelectorAll('.person-action').forEach(el => el.addEventListener('click', () => {
      const action = el.dataset.action;
      performPersonAction(p.id, action);
      renderAll();
      closeModal();
    }));
  }

  function performPersonAction(personId, action) {
    const p = state.people.find(x => x.id === personId);
    if (!p) return;
    let text = '';
    switch (action) {
      case 'talk':
        text = `You had a chat with ${p.name}.`;
        p.relationLevel = clamp(p.relationLevel + rand(1, 4));
        state.happiness = clamp(state.happiness + rand(0, 2));
        break;
      case 'compliment':
        text = `You complimented ${p.name}. They liked it.`;
        p.relationLevel = clamp(p.relationLevel + rand(3, 8));
        state.happiness = clamp(state.happiness + rand(1, 3));
        break;
      case 'gift':
        text = `You gave ${p.name} a gift.`;
        p.relationLevel = clamp(p.relationLevel + rand(4, 10));
        const cost = rand(5, 80);
        state.money -= cost;
        state.happiness = clamp(state.happiness + rand(1, 4));
        break;
      case 'spendtime':
        text = `You spent time with ${p.name}.`;
        p.relationLevel = clamp(p.relationLevel + rand(5, 12));
        state.happiness = clamp(state.happiness + rand(2, 6));
        break;
      case 'insult':
        text = `You insulted ${p.name}. It hurt your relationship.`;
        p.relationLevel = clamp(p.relationLevel - rand(6, 20));
        state.happiness = clamp(state.happiness - rand(1, 4));
        break;
      case 'askmoney':
        if (Math.random() < (p.relationLevel / 150)) {
          const gift = rand(10, 200);
          state.money += gift;
          text = `${p.name} gave you $${gift}.`;
        } else {
          text = `${p.name} refused to lend you money.`;
          p.relationLevel = clamp(p.relationLevel - rand(1, 6));
        }
        break;
      default:
        text = `You interacted with ${p.name}.`;
    }
    p.history.push(`${text} (Age ${state.age})`);
    addLog(text);
    checkAchievements();
    if (state.settings.autosave) saveState();
  }

  // --- Core gameplay functions ---
  function ageUp() {
    if (!state.alive) return toast("You're no longer alive.");
    state.age += 1;

    // natural stat shifts with age
    state.happiness = clamp(state.happiness + rand(-2, 3));
    state.health = clamp(state.health + rand(-4, 2));
    state.smarts = clamp(state.smarts + rand(0, 2));
    state.looks = clamp(state.looks + rand(-2, 1));

    // job salary if employed
    if (state.job) {
      const pay = state.job.pay;
      state.money += pay;
      addLog(`Worked as ${state.job.title} and earned $${pay}.`);
    }

    // random event
    if (Math.random() < 0.7) {
      const ev = randomEvents[Math.floor(Math.random() * randomEvents.length)](state.age);
      applyDelta(ev.delta || {});
      addLog(ev.text);
    }

    // relationships drift
    state.people.forEach(p => {
      // small natural drift
      p.relationLevel = clamp(p.relationLevel + rand(-1, 2));
      // age them slightly
      p.age += 1;
      // chance someone dies if old
      if (p.age > 80 && Math.random() < (p.age - 75) / 200) {
        p.history.push(`Died at age ${p.age}`);
        addLog(`${p.name} died at age ${p.age}.`);
        // lower player's happiness
        state.happiness = clamp(state.happiness - rand(3, 10));
      }
    });

    // age-based deaths (simple)
    if (state.age > 85 && Math.random() < (state.age - 80) / 200) {
      die(`At ${state.age}, your body gave out.`);
    }

    // small chance of bankruptcy
    if (state.money < -5000) die('You bankrupted and left no way forward.');

    checkAchievements();
    renderAll();
    if (state.settings.autosave) saveState();
  }

  function showActivities() {
    const html = `<h3>Activities</h3><div class='activity-list'>${activities.map(a=>`<div class='activity-item' data-id='${a.id}'>${escapeHtml(a.title)}<br><small>${escapeHtml(a.desc)}</small></div>`).join('')}</div>`;
    openModal(html);
    document.querySelectorAll('.activity-item').forEach(el=>el.addEventListener('click', ()=>{ performActivity(el.dataset.id); closeModal(); }));
  }

  function performActivity(id) {
    const a = activities.find(x=>x.id===id);
    if(!a) return;
    applyDelta({happiness: a.happiness||0, health: a.health||0, smarts: a.smarts||0, money: a.money||0});
    addLog(a.desc || `You did ${a.title}.`);
    checkAchievements();
    renderAll();
    if (state.settings.autosave) saveState();
  }

  function showJobs() {
    const html = `<h3>Jobs</h3><div style='display:grid;gap:8px'>${jobs.map(j=>`<div class='job-row' data-id='${j.id}' style='padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer'><strong>${escapeHtml(j.title)}</strong><div><small>$${j.pay}/yr ${j.requiresSmarts?`• Requires Smarts ${j.requiresSmarts}`:''}</small></div></div>`).join('')}</div>`;
    openModal(html);
    document.querySelectorAll('.job-row').forEach(el=>el.addEventListener('click', ()=>{ applyForJob(el.dataset.id); closeModal(); }));
  }

  function applyForJob(jobId){
    const j = jobs.find(x=>x.id===jobId);
    if(!j) return;
    if(j.requiresSmarts && state.smarts < j.requiresSmarts){ addLog(`You failed to qualify for ${j.title}.`); toast('You lack the smarts for that job.'); return; }
    state.job = j;
    addLog(`You got a job as ${j.title}.`);
    renderAll();
    if (state.settings.autosave) saveState();
  }

  // --- Achievements ---
  function checkAchievements(){
    if(!state.achievements['Age 18'] && state.age >= 18) grantAchievement('Age 18');
    if(!state.achievements['First Job'] && state.job) grantAchievement('First Job');
    if(!state.achievements['Wealthy'] && state.money >= 10000) grantAchievement('Wealthy');
  }
  function grantAchievement(key){ state.achievements[key]=true; addLog(`Achievement unlocked: ${key}`); }

  // --- Helpers: apply deltas, logging, rendering ---
  function applyDelta(delta){ if(!delta) return; if(delta.happiness) state.happiness = clamp(state.happiness + delta.happiness); if(delta.health) state.health = clamp(state.health + delta.health); if(delta.smarts) state.smarts = clamp(state.smarts + delta.smarts); if(delta.looks) state.looks = clamp(state.looks + delta.looks); if(delta.money) state.money = state.money + delta.money; }

  function addLog(text){ const entry = {id: uid(), text, age: state.age, ts: now()}; state.log.push(entry); if(state.log.length>500) state.log.shift(); renderLog(); }

  function renderStats(){ refs.age.textContent = state.age; refs.happiness.textContent = state.happiness; refs.health.textContent = state.health; refs.smarts.textContent = state.smarts; refs.looks.textContent = state.looks; refs.money.textContent = `$${state.money}`; refs.subtitle.textContent = state.alive ? `Age ${state.age} • ${state.job ? state.job.title : 'Unemployed'}` : `Deceased at ${state.age}`; }

  function renderLog(){ refs.log.innerHTML = ''; const items = state.log.slice(-60).reverse(); for(const e of items){ const d = document.createElement('div'); d.className = 'log-entry'; d.innerHTML = `<strong>Age ${e.age}:</strong> ${escapeHtml(e.text)}`; refs.log.appendChild(d); } }

  function renderAll(){ renderStats(); renderLog(); applyTheme(); }

  function die(reason){ state.alive=false; addLog(`Death: ${reason}`); renderAll(); if(state.settings.autosave) saveState(); }

  // --- Save/Load/Export/Import ---
  function saveState(){ localStorage.setItem('minilife_save', JSON.stringify(state)); }
  function loadState(){ try{ const json = localStorage.getItem('minilife_save'); if(!json) return null; return JSON.parse(json); }catch(e){ console.error(e); return null; } }
  function exportState(){ const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'minilife-save.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
  function handleImportFile(ev){ const f = ev.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = ()=>{ try{ const obj = JSON.parse(reader.result); state = obj; ensureStateDefaults(); renderAll(); toast('Imported save file'); }catch(e){ toast('Invalid file'); } }; reader.readAsText(f); ev.target.value = ''; }

  // --- Modal UI ---
  function openModal(html){ refs.modalBody.innerHTML = html; refs.modal.classList.remove('hidden'); }
  function closeModal(){ refs.modal.classList.add('hidden'); refs.modalBody.innerHTML = ''; }

  // --- Misc UI helpers ---
  function toast(msg){ const t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:28px;background:#0b1220;color:#e6eef6;padding:8px 12px;border-radius:999px;box-shadow:0 6px 18px rgba(2,6,23,0.6);z-index:60'; document.body.appendChild(t); setTimeout(()=> t.style.opacity = '0.0', 1400); setTimeout(()=> t.remove(), 2000); }

  function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function ensureStateDefaults(){ state = Object.assign({}, DEFAULT_STATE, state); if(!Array.isArray(state.log)) state.log = []; if(!Array.isArray(state.people)) state.people = []; if(!state.achievements) state.achievements = {}; if(!state.settings) state.settings = DEFAULT_STATE.settings; }

  // --- Expose minimal API for debugging ---
  window.MINILIFE = { getState: ()=>state, save: ()=>{ saveState(); toast('Saved'); }, load: ()=>{ const s=loadState(); if(s){ state=s; ensureStateDefaults(); renderAll(); toast('Loaded'); } else toast('No save'); } };

})();

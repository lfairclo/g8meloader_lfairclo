// game.js — MiniLife (mobile-style BitLife clone)
// Full features: tabs, relationships, icons, bars, randomized names, age-aware events.

(() => {
  // --- Utilities ---
  const $ = id => document.getElementById(id);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const now = () => Date.now();
  const uid = () => now() + '-' + Math.random().toString(36).slice(2, 9);

  // --- Default State ---
  const DEFAULT_STATE = {
    name: '',
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
    settings: { theme: 'dark', autosave: true },
    seed: Date.now()
  };

  // --- Game Data ---
  const jobs = [
    { id: 'intern', title: 'Intern', pay: 100 },
    { id: 'cashier', title: 'Cashier', pay: 200 },
    { id: 'developer', title: 'Web Developer', pay: 1000, requiresSmarts: 60 },
    { id: 'doctor', title: 'Doctor', pay: 2000, requiresSmarts: 85 }
  ];

  const activities = [
    { id: 'read', title: 'Read a Book', happiness: 1, smarts: 2, desc: 'You read and gained smarts.' },
    { id: 'jog', title: 'Go for a Jog', happiness: 2, health: 3, desc: 'Fresh air! Health increased.' },
    { id: 'party', title: 'Throw a Party', happiness: 8, health: -2, money: -50, desc: 'It was wild. Fun but expensive.' },
    { id: 'study', title: 'Study Hard', happiness: -2, smarts: 4, desc: 'Long nights paying off.' }
  ];

  // names for randomization
  const nameList = ["Liam","Noah","Oliver","Elijah","James","William","Benjamin","Lucas","Henry","Alexander","Olivia","Emma","Ava","Sophia","Isabella","Mia","Charlotte","Amelia","Harper","Evelyn"];
  function randomName(){ return nameList[Math.floor(Math.random()*nameList.length)]; }

  // age-restrictions
  function canDoWork(age){ return age >= 16; }
  function canGoToSchool(age){ return age >= 4; }
  function canGetPromoted(age){ return age >= 18; }
  function isEventAllowed(event, age){
    if(event === "promotion") return canGetPromoted(age);
    if(event === "job") return canDoWork(age);
    if(event === "school") return canGoToSchool(age);
    return true;
  }

  // better event generator -> selects from age-appropriate pool
  function pickRandomEvent(age){
    const pool = [];
    if(age <= 3){
      pool.push( () => ({text: 'A peaceful year passed.', delta:{}}) );
    } else if(age <= 12){
      pool.push( () => ({text: 'You learned something new at school.', delta:{smarts:+1}}) );
      pool.push( () => ({text: 'You made a childhood friend.', delta:{happiness:+2}}) );
    } else if(age <= 15){
      pool.push( () => ({text: 'You joined an after-school club.', delta:{smarts:+1, happiness:+1}}) );
      pool.push( () => ({text: 'You had a minor injury while playing.', delta:{health:-2}}) );
    } else if(age <= 17){
      pool.push( () => ({text: 'You got a part-time job.', delta:{money:+rand(20,80)}, tag:'job'} ) );
      pool.push( () => ({text: 'You finished a big exam.', delta:{smarts:+2}}) );
    } else { // adult
      pool.push( () => ({text: 'You had a quiet year.', delta:{} }) );
      pool.push( () => ({text: 'You got a promotion!', delta:{money:+rand(200,1000)}, tag:'promotion'} ) );
      pool.push( () => ({text: 'You fell in love.', delta:{happiness:+rand(5,15)}}) );
      pool.push( () => ({text: 'You were scammed and lost money.', delta:{money:-rand(20,200)}}) );
      pool.push( () => ({text: 'You changed jobs.', delta:{} , tag:'job'} ) );
    }
    const candidate = pool[Math.floor(Math.random()*pool.length)]();
    // validate by tag
    if(candidate.tag && !isEventAllowed(candidate.tag, age)){
      return {text: 'A quiet year passed.', delta:{}};
    }
    return candidate;
  }

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

  // --- Init ---
  bindButtons();
  if(!state.name) state.name = randomName();
  if(state.people.length === 0) state.people = generateFamily();
  addLog('You were born.');
  renderAll();

  // --- Buttons & Tabs ---
  function bindButtons(){
    refs.btnAge.addEventListener('click', ageUp);
    refs.btnActivities.addEventListener('click', showActivities);
    refs.btnWork.addEventListener('click', showJobs);
    refs.btnRelationship.addEventListener('click', () => openTab('life'));

    refs.btnSave.addEventListener('click', ()=>{ saveState(); toast('Saved locally'); });
    refs.btnLoad.addEventListener('click', ()=>{ const s = loadState(); if(s){ state = s; ensureStateDefaults(); renderAll(); toast('Loaded'); } else toast('No save found'); });
    refs.btnExport.addEventListener('click', exportState);
    refs.btnImport.addEventListener('click', ()=> refs.importFile.click());
    refs.importFile.addEventListener('change', handleImportFile);
    refs.modalClose.addEventListener('click', closeModal);
    refs.modal.addEventListener('click', (e)=>{ if(e.target === refs.modal) closeModal(); });

    refs.navPanel.forEach(btn => btn.addEventListener('click', (e) => {
      const tab = btn.dataset.tab;
      openTab(tab);
    }));
  }

  function openTab(tab){
    if(tab === 'life') return showLifePanel();
    if(tab === 'jobs') return showJobsPanel();
    if(tab === 'achieve') return showAchievementsPanel();
    if(tab === 'settings') return showSettingsPanel();
  }

  // --- Panels ---
  function showLifePanel(){
    const peopleHtml = state.people.map(p => `
      <div class="person-row" data-id="${p.id}">
        <div class="person-icon">${p.icon||'🙂'}</div>
        <div class="person-info">
          <div class="person-name">${escapeHtml(p.name)} <small style="color:var(--muted)">(${escapeHtml(p.relation)})</small></div>
          <div class="person-rel">Age ${p.age} • Relation ${p.relationship}</div>
          <div class="rel-bar"><div class="rel-fill" style="width:${clamp(p.relationship,0,100)}%"></div></div>
        </div>
      </div>
    `).join('');

    const html = `
      <h3>Life Summary</h3>
      <p><strong>${escapeHtml(state.name)}</strong> — Age: ${state.age} &nbsp; ${state.job? `• ${escapeHtml(state.job.title)}` : '• Unemployed'}</p>
      <p><strong>Money:</strong> $${state.money}</p>
      <hr>
      <h4>People</h4>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto">${peopleHtml}</div>
      <hr>
      <h4>Recent Events</h4>
      <div style='max-height:200px;overflow:auto'>${state.log.slice(-40).reverse().map(l=>`<div style='padding:6px;border-bottom:1px solid rgba(255,255,255,0.02)'><small>Age ${l.age}:</small> ${escapeHtml(l.text)}</div>`).join('')}</div>
    `;
    openModal(html);
    document.querySelectorAll('.person-row').forEach(el => el.addEventListener('click', ()=> openPersonPanel(el.dataset.id)));
  }

  function showJobsPanel(){
    const html = `
      <h3>Jobs</h3>
      <div style='display:grid;gap:8px'>${jobs.map(j=>`<div class='job-row' data-id='${j.id}'><div><strong>${escapeHtml(j.title)}</strong><div style="font-size:12px;color:var(--muted)">${j.requiresSmarts?`Requires smarts ${j.requiresSmarts}`:''}</div></div><div><small>$${j.pay}/yr</small></div></div>`).join('')}</div>
    `;
    openModal(html);
    document.querySelectorAll('.job-row').forEach(el => el.addEventListener('click', ()=>{ applyForJob(el.dataset.id); closeModal(); }));
  }

  function showAchievementsPanel(){
    const unlocked = Object.keys(state.achievements).filter(k => state.achievements[k]);
    const html = `<h3>Achievements</h3><div style='display:grid;gap:8px'>${unlocked.length ? unlocked.map(k=>`<div style='padding:8px;background:var(--glass);border-radius:8px'>🏆 ${escapeHtml(k)}</div>`).join('') : `<div style='padding:8px;color:var(--muted)'>No achievements yet.</div>`}</div>`;
    openModal(html);
  }

  function showSettingsPanel(){
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
    $('#btn-reset').addEventListener('click', () => { if(confirm('Reset save and start fresh?')){ state = {...DEFAULT_STATE}; state.name = randomName(); state.people = generateFamily(); ensureStateDefaults(); saveState(); renderAll(); closeModal(); }});
  }

  // --- Relationships System ---
  function createPerson(role){
    const icon = role === 'parent' ? '👨‍👩‍👧' : role === 'sibling' ? '👦' : role === 'grandparent' ? '👵' : '🙂';
    return {
      id: uid(),
      name: randomName(),
      relation: role,
      relationship: rand(30,80),
      age: Math.max(1, Math.floor(Math.random()*70)),
      icon,
      history: []
    };
  }

  function generateFamily(){
    const people = [];
    // parents
    people.push(createPerson('parent'));
    people.push(createPerson('parent'));
    // siblings 0-3
    for(let i=0;i<rand(0,3);i++) people.push(createPerson('sibling'));
    // grandparents 0-2
    for(let i=0;i<rand(0,2);i++) people.push(createPerson('grandparent'));
    // friends 1-3
    for(let i=0;i<rand(1,3);i++) people.push(createPerson('friend'));
    return people;
  }

  function openPersonPanel(personId){
    const p = state.people.find(x => x.id === personId);
    if(!p) return;
    const html = `
      <h3>${escapeHtml(p.name)} <small style="color:var(--muted)">(${escapeHtml(p.relation)})</small></h3>
      <p>Age: ${p.age} • Relation: ${p.relationship}</p>
      <div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px'>
        <button class='person-action' data-action='talk'>Talk</button>
        <button class='person-action' data-action='compliment'>Compliment</button>
        <button class='person-action' data-action='gift'>Gift</button>
        <button class='person-action' data-action='spendtime'>Spend Time</button>
        <button class='person-action negative' data-action='insult'>Insult</button>
        <button class='person-action' data-action='askmoney'>Ask for Money</button>
      </div>
      <hr>
      <h4>Interaction History</h4>
      <div style='max-height:180px;overflow:auto'>${p.history.slice().reverse().map(h=>`<div style='padding:6px;border-bottom:1px solid rgba(255,255,255,0.02)'>${escapeHtml(h)}</div>`).join('')}</div>
    `;
    openModal(html);
    document.querySelectorAll('.person-action').forEach(el => el.addEventListener('click', ()=>{
      performPersonAction(p.id, el.dataset.action);
      closeModal();
      renderAll();
    }));
  }

  function performPersonAction(personId, action){
    const p = state.people.find(x => x.id === personId);
    if(!p) return;
    let text = '';
    switch(action){
      case 'talk':
        text = `You had a chat with ${p.name}.`;
        p.relationship = clamp(p.relationship + rand(1,4));
        state.happiness = clamp(state.happiness + rand(0,2));
        break;
      case 'compliment':
        text = `You complimented ${p.name}. They appreciated it.`;
        p.relationship = clamp(p.relationship + rand(3,8));
        state.happiness = clamp(state.happiness + rand(1,3));
        break;
      case 'gift':
        {
          const cost = rand(5,80);
          if(state.money >= cost){
            state.money -= cost;
            text = `You gave ${p.name} a gift ($${cost}).`;
            p.relationship = clamp(p.relationship + rand(4,10));
            state.happiness = clamp(state.happiness + rand(1,4));
          } else {
            text = `You couldn't afford a gift for ${p.name}.`;
            p.relationship = clamp(p.relationship - rand(1,4));
          }
        }
        break;
      case 'spendtime':
        text = `You spent quality time with ${p.name}.`;
        p.relationship = clamp(p.relationship + rand(5,12));
        state.happiness = clamp(state.happiness + rand(2,6));
        break;
      case 'insult':
        text = `You insulted ${p.name}. Ouch.`;
        p.relationship = clamp(p.relationship - rand(6,20));
        state.happiness = clamp(state.happiness - rand(1,4));
        break;
      case 'askmoney':
        if(Math.random() < (p.relationship/150)){
          const gift = rand(10,200);
          state.money += gift;
          text = `${p.name} gave you $${gift}.`;
        } else {
          text = `${p.name} refused to lend you money.`;
          p.relationship = clamp(p.relationship - rand(1,6));
        }
        break;
      default:
        text = `You interacted with ${p.name}.`;
    }
    p.history.push(`${text} (Age ${state.age})`);
    addLog(text);
    checkAchievements();
    if(state.settings.autosave) saveState();
  }

  // --- Core gameplay functions ---
  function ageUp(){
    if(!state.alive) return toast("You're no longer alive.");
    state.age += 1;

    // small natural drift and aging effects
    state.happiness = clamp(state.happiness + rand(-2,3));
    state.health = clamp(state.health + rand(-4,2));
    state.smarts = clamp(state.smarts + rand(0,2));
    state.looks = clamp(state.looks + rand(-1,1));

    // job pay if employed
    if(state.job){
      const pay = state.job.pay;
      state.money += pay;
      addLog(`Worked as ${state.job.title} and earned $${pay}.`);
    }

    // random age-appropriate event
    if(Math.random() < 0.8){
      const ev = pickRandomEvent(state.age);
      if(ev && ev.text){
        applyDelta(ev.delta || {});
        addLog(ev.text);
      }
    }

    // relationship drift
    state.people.forEach(p => {
      p.relationship = clamp(p.relationship + rand(-1,2));
      p.age = Math.max(1, p.age + rand(0,1));
      if(p.age > 80 && Math.random() < (p.age - 75)/200){
        p.history.push(`Died at age ${p.age}`);
        addLog(`${p.name} died at age ${p.age}.`);
        state.happiness = clamp(state.happiness - rand(3,10));
      }
    });

    // death checks
    if(state.age > 85 && Math.random() < (state.age - 80)/200){
      die(`At ${state.age}, your body gave out.`);
    }
    if(state.money < -5000) die('You bankrupted and left no way forward.');

    checkAchievements();
    renderAll();
    if(state.settings.autosave) saveState();
  }

  function showActivities(){
    const html = `<h3>Activities</h3><div class='activity-list'>${activities.map(a=>`<div class='activity-item' data-id='${a.id}'>${escapeHtml(a.title)}<br><small>${escapeHtml(a.desc)}</small></div>`).join('')}</div>`;
    openModal(html);
    document.querySelectorAll('.activity-item').forEach(el => el.addEventListener('click', ()=>{ performActivity(el.dataset.id); closeModal(); }));
  }

  function performActivity(id){
    const a = activities.find(x=>x.id===id);
    if(!a) return;
    applyDelta({happiness:a.happiness||0, health:a.health||0, smarts:a.smarts||0, money:a.money||0});
    addLog(a.desc || `You did ${a.title}.`);
    checkAchievements();
    renderAll();
    if(state.settings.autosave) saveState();
  }

  function showJobs(){ openTab('jobs'); }

  function applyForJob(jobId){
    const j = jobs.find(x=>x.id===jobId);
    if(!j) return;
    if(j.requiresSmarts && state.smarts < j.requiresSmarts){
      addLog(`You failed to qualify for ${j.title}.`);
      toast('You lack the smarts for that job.');
      return;
    }
    if(!canDoWork(state.age)){
      addLog(`You are too young for ${j.title}.`);
      toast('Too young to work.');
      return;
    }
    state.job = j;
    addLog(`You got a job as ${j.title}.`);
    checkAchievements();
    renderAll();
    if(state.settings.autosave) saveState();
  }

  // --- Achievements ---
  function checkAchievements(){
    if(!state.achievements['Age 18'] && state.age >= 18) grantAchievement('Age 18');
    if(!state.achievements['First Job'] && state.job) grantAchievement('First Job');
    if(!state.achievements['Wealthy'] && state.money >= 10000) grantAchievement('Wealthy');
  }
  function grantAchievement(key){ state.achievements[key] = true; addLog(`Achievement unlocked: ${key}`); }

  // --- Helpers ---
  function applyDelta(delta){
    if(!delta) return;
    if('happiness' in delta) state.happiness = clamp(state.happiness + delta.happiness);
    if('health' in delta) state.health = clamp(state.health + delta.health);
    if('smarts' in delta) state.smarts = clamp(state.smarts + delta.smarts);
    if('looks' in delta) state.looks = clamp(state.looks + delta.looks);
    if('money' in delta) state.money = state.money + delta.money;
  }

  function addLog(text){
    const entry = { id: uid(), text, age: state.age, ts: now() };
    state.log.push(entry);
    if(state.log.length > 600) state.log.shift();
    renderLog();
  }

  function renderStats(){
    refs.age.textContent = state.age;
    refs.happiness.textContent = state.happiness;
    refs.health.textContent = state.health;
    refs.smarts.textContent = state.smarts;
    refs.looks.textContent = state.looks;
    refs.money.textContent = `$${state.money}`;
    refs.subtitle.textContent = state.alive ? `Age ${state.age} • ${state.job ? state.job.title : 'Unemployed'}` : `Deceased at ${state.age}`;
  }

  function renderLog(){
    refs.log.innerHTML = '';
    const items = state.log.slice(-60).reverse();
    for(const e of items){
      const d = document.createElement('div');
      d.className = 'log-entry';
      d.innerHTML = `<strong>Age ${e.age}:</strong> ${escapeHtml(e.text)}`;
      refs.log.appendChild(d);
    }
  }

  function renderAll(){
    renderStats();
    renderLog();
    applyTheme();
  }

  function die(reason){
    state.alive = false;
    addLog(`Death: ${reason}`);
    renderAll();
    if(state.settings.autosave) saveState();
  }

  // --- Save / Load / Export / Import ---
  function saveState(){ localStorage.setItem('minilife_save', JSON.stringify(state)); }
  function loadState(){ try{ const json = localStorage.getItem('minilife_save'); if(!json) return null; return JSON.parse(json); }catch(e){ console.error(e); return null; } }
  function exportState(){ const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'minilife-save.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
  function handleImportFile(ev){ const f = ev.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = ()=>{ try{ const obj = JSON.parse(reader.result); state = obj; ensureStateDefaults(); renderAll(); toast('Imported save file'); }catch(e){ toast('Invalid file'); } }; reader.readAsText(f); ev.target.value = ''; }

  // --- Modal UI ---
  function openModal(html){ refs.modalBody.innerHTML = html; refs.modal.classList.remove('hidden'); }
  function closeModal(){ refs.modal.classList.add('hidden'); refs.modalBody.innerHTML = ''; }

  // --- UI helpers ---
  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:28px;background:#0b1220;color:#e6eef6;padding:8px 12px;border-radius:999px;box-shadow:0 6px 18px rgba(2,6,23,0.6);z-index:60';
    document.body.appendChild(t);
    setTimeout(()=> t.style.opacity = '0.0', 1400);
    setTimeout(()=> t.remove(), 2000);
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function ensureStateDefaults(){ state = Object.assign({}, DEFAULT_STATE, state); if(!Array.isArray(state.log)) state.log = []; if(!Array.isArray(state.people)) state.people = []; if(!state.achievements) state.achievements = {}; if(!state.settings) state.settings = DEFAULT_STATE.settings; }

  // --- Theme / visual helpers ---
  function applyTheme(){
    if(state.settings.theme === 'light'){
      document.documentElement.style.setProperty('--bg','#f7fafc');
      document.documentElement.style.setProperty('--panel','#ffffff');
      document.documentElement.style.setProperty('--muted','#475569');
    } else {
      document.documentElement.style.setProperty('--bg','#071021');
      document.documentElement.style.setProperty('--panel','#0b1220');
      document.documentElement.style.setProperty('--muted','#9aa4b2');
    }
  }

  // Expose for debugging
  window.MINILIFE = {
    getState: ()=>state,
    save: ()=>{ saveState(); toast('Saved'); },
    load: ()=>{ const s = loadState(); if(s){ state = s; ensureStateDefaults(); renderAll(); toast('Loaded'); } else toast('No save'); }
  };

})();

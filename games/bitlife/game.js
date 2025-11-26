// game.js — MiniLife (mobile-style BitLife clone)
// Single-file game engine. Save/load via localStorage. Easy to expand.

(() => {
  // --- Game State ---
  const DEFAULT_STATE = {
    name: "Player",
    age: 0,
    happiness: 60,
    health: 70,
    smarts: 50,
    looks: 50,
    money: 100,
    log: [],
    job: null,
    alive: true,
    seed: Date.now()
  };

  let state = loadState() || {...DEFAULT_STATE};

  // --- Utilities ---
  const $ = id => document.getElementById(id);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp = (v, a=0, b=100) => Math.max(a, Math.min(b, v));

  // --- DOM refs ---
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
    modalClose: $('modal-close')
  };

  // --- Sample data ---
  const jobs = [
    {id:'intern', title:'Intern', pay: 100, stamina:-2, smarts:+1},
    {id:'cashier', title:'Cashier', pay: 200, stamina:-1, smarts:0},
    {id:'developer', title:'Web Developer', pay: 1000, stamina:-3, smarts:+2, requiresSmarts:60},
    {id:'doctor', title:'Doctor', pay: 2000, stamina:-4, smarts:+3, requiresSmarts:85}
  ];

  const activities = [
    {id:'read', title:'Read a Book', happiness:+1, smarts:+2, health:0, money:0, desc:'You read and gained smarts.'},
    {id:'jog', title:'Go for a Jog', happiness:+2, health:+3, smarts:0, money:0, desc:'Fresh air! Health increased.'},
    {id:'party', title:'Throw a Party', happiness:+8, health:-2, money:-50, desc:'It was wild. Fun but expensive.'},
    {id:'study', title:'Study Hard', happiness:-2, smarts:+4, money:0, desc:'Long nights paying off.'}
  ];

  const randomEvents = [
    age => ({text:`You had a quiet year.`, delta:{happiness:+0}}),
    age => ({text:`You got a promotion at ${age} years old!`, delta:{money:+rand(100,800)}}),
    age => ({text:`You got sick for a while.`, delta:{health:-rand(5,18), happiness:-rand(1,5)}}),
    age => ({text:`You fell in love.`, delta:{happiness:+rand(5,15)}}),
    age => ({text:`You were scammed and lost money.`, delta:{money:-rand(20,200)}}),
  ];

  // --- Init ---
  bindButtons();
  renderAll();
  addLog("You were born.");

  // --- Functions ---
  function bindButtons(){
    refs.btnAge.addEventListener('click', ageUp);
    refs.btnActivities.addEventListener('click', showActivities);
    refs.btnWork.addEventListener('click', showJobs);
    refs.btnRelationship.addEventListener('click', showRelationships);
    refs.btnSave.addEventListener('click', ()=>{ saveState(); toast('Saved locally'); });
    refs.btnLoad.addEventListener('click', ()=>{ const s = loadState(); if(s){ state = s; renderAll(); toast('Loaded'); } else toast('No save found'); });
    refs.btnExport.addEventListener('click', exportState);
    refs.btnImport.addEventListener('click', ()=> refs.importFile.click());
    refs.importFile.addEventListener('change', handleImportFile);
    refs.modalClose.addEventListener('click', closeModal);
    refs.modal.addEventListener('click', (e)=>{ if(e.target===refs.modal) closeModal(); });
  }

  function ageUp(){
    if(!state.alive) return toast("You're no longer alive.");
    state.age += 1;

    // natural stat shifts with age
    state.happiness = clamp(state.happiness + rand(-2,3));
    state.health = clamp(state.health + rand(-4,2));
    state.smarts = clamp(state.smarts + rand(0,2));
    state.looks = clamp(state.looks + rand(-2,1));

    // job salary if employed
    if(state.job){
      const pay = state.job.pay;
      state.money += pay;
      addLog(`Worked as ${state.job.title} and earned $${pay}.`);
    }

    // random event
    if(Math.random() < 0.7){
      const ev = randomEvents[Math.floor(Math.random()*randomEvents.length)](state.age);
      applyDelta(ev.delta || {});
      addLog(ev.text);
    }

    // age-based deaths (random simple model)
    if(state.age > 85 && Math.random() < (state.age - 80)/200){
      die(`At ${state.age}, your body gave out.`);
    }

    // small chance of bankruptcy
    if(state.money < -5000) die("You bankrupted and left no way forward.");

    renderAll();
  }

  function showActivities(){
    openModal(`<h3>Choose an activity</h3><div class="activity-list">${activities.map(a=>`<div class="activity-item" data-id="${a.id}">${a.title}</div>`).join('')}</div>`);
    document.querySelectorAll('.activity-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.dataset.id;
        performActivity(id);
        closeModal();
      });
    });
  }

  function performActivity(id){
    const a = activities.find(x=>x.id===id);
    if(!a) return;
    applyDelta({happiness: a.happiness || 0, health: a.health || 0, smarts: a.smarts || 0, money: a.money || 0});
    addLog(a.desc || `You did ${a.title}.`);
    renderAll();
  }

  function showJobs(){
    openModal(`<h3>Jobs</h3><div class="activity-list">${jobs.map(j=>`<div class="activity-item" data-id="${j.id}">${j.title}<br><small>$${j.pay}/yr</small></div>`).join('')}</div>`);
    document.querySelectorAll('.activity-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        const jobId = el.dataset.id;
        applyForJob(jobId);
        closeModal();
      });
    });
  }

  function applyForJob(jobId){
    const j = jobs.find(x=>x.id===jobId);
    if(!j) return;
    if(j.requiresSmarts && state.smarts < j.requiresSmarts){
      addLog(`You failed to qualify for ${j.title}.`);
      toast('You lack the smarts for that job.');
      return;
    }
    state.job = j;
    addLog(`You got a job as ${j.title}.`);
    renderAll();
  }

  function showRelationships(){
    // simple relationship event
    openModal(`<h3>Relationships</h3>
      <div class="activity-list">
        <div class="activity-item" data-id="date">Go on a date</div>
        <div class="activity-item" data-id="marry">Try to get married</div>
        <div class="activity-item" data-id="break">Break up</div>
      </div>`);
    document.querySelectorAll('.activity-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.dataset.id;
        if(id==='date') {
          const success = Math.random() < 0.7;
          if(success){ applyDelta({happiness: +6}); addLog('You had a lovely date!'); }
          else { applyDelta({happiness: -2}); addLog('The date was awkward.'); }
        } else if(id==='marry'){
          if(Math.random() < 0.2){ applyDelta({happiness:+20}); addLog('You got married!'); }
          else { addLog('Marriage didn\'t work out.'); }
        } else if(id==='break'){
          applyDelta({happiness:-8}); addLog('You had a breakup.'); 
        }
        closeModal();
        renderAll();
      });
    });
  }

  // Apply stat deltas
  function applyDelta(delta){
    if(!delta) return;
    if(delta.happiness) state.happiness = clamp(state.happiness + delta.happiness);
    if(delta.health) state.health = clamp(state.health + delta.health);
    if(delta.smarts) state.smarts = clamp(state.smarts + delta.smarts);
    if(delta.looks) state.looks = clamp(state.looks + delta.looks);
    if(delta.money) state.money = state.money + delta.money;
    if(delta.seed) state.seed = delta.seed;
  }

  // Add log entry (appears top)
  function addLog(text){
    const entry = {id: Date.now() + '-' + Math.random().toString(36).slice(2), text, age: state.age};
    state.log.push(entry);
    // keep log length reasonable
    if(state.log.length > 200) state.log.shift();
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
    // show last 60 entries (reverse order)
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
    // small visual cues
    document.body.style.background = state.alive ? '' : 'linear-gradient(180deg,#220a0a,#100404)';
  }

  function die(reason){
    state.alive = false;
    addLog(`Death: ${reason}`);
    renderAll();
  }

  // --- Save / Load / Export / Import ---
  function saveState(){
    const json = JSON.stringify(state);
    localStorage.setItem('minilife_save', json);
  }

  function loadState(){
    try{
      const json = localStorage.getItem('minilife_save');
      if(!json) return null;
      return JSON.parse(json);
    }catch(e){ console.error(e); return null; }
  }

  function exportState(){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'minilife-save.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(ev){
    const f = ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const obj = JSON.parse(reader.result);
        state = obj;
        renderAll();
        toast('Imported save file');
      }catch(e){ toast('Invalid file'); }
    };
    reader.readAsText(f);
    ev.target.value = '';
  }

  // --- Modal UI ---
  function openModal(html){
    refs.modalBody.innerHTML = html;
    refs.modal.classList.remove('hidden');
  }
  function closeModal(){ refs.modal.classList.add('hidden'); refs.modalBody.innerHTML = ''; }

  // --- Small helpers ---
  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:28px;background:#0b1220;color:#e6eef6;padding:8px 12px;border-radius:999px;box-shadow:0 6px 18px rgba(2,6,23,0.6);z-index:60';
    document.body.appendChild(t);
    setTimeout(()=> t.style.opacity = '0.0', 1400);
    setTimeout(()=> t.remove(), 2000);
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // --- Init helpers ---
  function loadStateOrDefault(){
    const s = loadState();
    if(s) return s;
    return {...DEFAULT_STATE};
  }

  // At first load, ensure state fields exist (backwards compat)
  function ensureStateDefaults(){
    state = Object.assign({}, DEFAULT_STATE, state);
    if(!Array.isArray(state.log)) state.log = [];
  }

  // run once to normalize
  ensureStateDefaults();

  // expose save on window for debugging
  window.MINILIFE = {
    getState: () => state,
    save: () => { saveState(); toast('Saved'); },
    load: () => { const s = loadState(); if(s){ state = s; renderAll(); toast('Loaded'); } else toast('No save'); }
  };

})();

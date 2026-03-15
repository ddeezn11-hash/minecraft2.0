'use strict';
//  ENGINE TAB
// ══════════════════════════════════════════════════
const customItems={};      // id -> block def
const worldPerms={};       // worldName -> {flags, whitelist, banlist}

// ── Sub-tab switching ──
function enTab(id,el){
  document.querySelectorAll('.en-stab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.en-panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('enp-'+id).classList.add('on');
  if(id==='blk')renderBlockList();
  if(id==='prm')renderPermPanel();
  if(id==='srv')renderSrvPanel();
  if(id==='itm')renderCustomItemList();
  if(id==='cmd'||id==='prm')populateWorldSelects();
}

// ── switchTab — 6 tabs ──
function switchTab(id){
  const ids=['sp','sv','fr','ac','st','en'];
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('on',ids[i]===id));
  document.querySelectorAll('.tp').forEach((p,i)=>p.classList.toggle('on','tab-'+ids[i]==='tab-'+id));
  if(id==='en'){populateWorldSelects();renderBlockList();renderCustomItemList();renderPermPanel();renderSrvPanel();}
  if(id==='sv'){renderMySrvList();renderServerList();}
  if(id==='fr'){renderFriends();renderOnlinePlayers();}
  if(id==='ac'){renderAccount();}
  if(id==='sp'){renderWorldList();}
}

// ── Server sub-tabs ──
function svTab(id,el){
  document.querySelectorAll('.mpt2').forEach(t=>t.classList.remove('on'));el.classList.add('on');
  document.querySelectorAll('.mp2p').forEach(p=>p.classList.remove('on'));
  document.getElementById('sv-'+id).classList.add('on');
}

// ── My Servers (managed configs) ──
function getMySrvs(){try{return JSON.parse(localStorage.getItem('vc_mysrvs')||'[]');}catch{return[];}}
function saveMySrvs(s){localStorage.setItem('vc_mysrvs',JSON.stringify(s));}
let selectedSrv=null;
function showCreateSrv(){document.getElementById('create-srv-form').style.display='block';}
function saveNewSrv(){
  const name=document.getElementById('nsrv-name').value.trim();
  const url=document.getElementById('nsrv-url').value.trim();
  const desc=document.getElementById('nsrv-desc').value.trim();
  const maxp=parseInt(document.getElementById('nsrv-maxp').value)||20;
  const pw=document.getElementById('nsrv-pw').value;
  if(!name){showMsg('Enter a server name',700);return;}
  const srvs=getMySrvs();
  srvs.push({id:Date.now(),name,url,desc,maxp,pw:pw?btoa(pw):'',created:Date.now(),players:[]});
  saveMySrvs(srvs);
  document.getElementById('create-srv-form').style.display='none';
  ['nsrv-name','nsrv-url','nsrv-desc','nsrv-pw'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('nsrv-maxp').value='20';
  renderMySrvList();
}
function renderMySrvList(){
  const srvs=getMySrvs();
  const el=document.getElementById('my-srv-list');
  if(!el)return;
  el.innerHTML=srvs.length?srvs.map((s,i)=>`
    <div class="srv-card${selectedSrv===s.id?' active':''}" onclick="selectSrv(${s.id})">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="srv-status-dot" style="background:${s.url?'#4CAF50':'#333'}"></span>
        <span class="srv-title">${s.name}</span>
        <span style="flex:1"></span>
        <span style="font-size:8px;color:#1a3a1a;">${s.url||'no url'}</span>
        <button class="mb r" style="font-size:7px;padding:2px 6px;" onclick="event.stopPropagation();deleteMySrv(${s.id})">✕</button>
      </div>
      <div class="srv-meta">${s.desc||'No description'} · max ${s.maxp} players${s.pw?' · 🔒 password':''}</div>
    </div>`).join(''):'<div class="empty-w" style="padding:20px;">No servers yet.<br>Create a config above.</div>';
}
function selectSrv(id){
  selectedSrv=id;
  const srvs=getMySrvs();const s=srvs.find(x=>x.id===id);if(!s)return;
  renderMySrvList();
  const onlinePeers=Object.values(otherPlayers);
  const panel=document.getElementById('srv-detail');
  panel.classList.add('show');
  panel.querySelector('#srv-detail-inner')??(panel.innerHTML='<div id="srv-detail-inner"></div>');
  document.getElementById('srv-detail-inner').innerHTML=`
    <div style="font-size:9px;color:#4CAF50;letter-spacing:2px;margin-bottom:8px;">${s.name}</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${onlinePeers.length}</div><div class="stat-lbl">ONLINE</div></div>
      <div class="stat-box"><div class="stat-num">${s.maxp}</div><div class="stat-lbl">MAX</div></div>
    </div>
    <div style="font-size:9px;color:#2a5a2a;margin-bottom:8px;">${s.url||'No URL configured'}</div>
    ${onlinePeers.length?'<div style="font-size:8px;color:#1a3a1a;margin-bottom:4px;">CONNECTED PLAYERS</div>'+onlinePeers.map(p=>`<div class="ppl-row"><div class="ppl-nm">${p.uname}</div><div class="ppl-role" style="color:#4CAF50">ONLINE</div></div>`).join(''):'<div style="font-size:9px;color:#1a3a1a;">No players connected</div>'}
    <div class="brow" style="margin-top:8px;">
      <button class="mb g" onclick="connectSrv(${s.id})">Connect</button>
      <button class="mb d" onclick="srvBroadcast()">Broadcast</button>
    </div>`;
}
function connectSrv(id){
  const s=getMySrvs().find(x=>x.id===id);if(!s||!s.url)return;
  document.getElementById('srv-url').value=s.url;
  connectWS();
}
function deleteMySrv(id){const srvs=getMySrvs().filter(s=>s.id!==id);saveMySrvs(srvs);if(selectedSrv===id){selectedSrv=null;document.getElementById('srv-detail').classList.remove('show');}renderMySrvList();}

// ── World Preview ──
function generateWorldPreview(seed,worldName){
  const prevSeed=_worldSeed;_worldSeed=seed; // temporarily set seed for sfbm
  const canvas=document.getElementById('preview-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=96,H=96;const imageData=ctx.createImageData(W,H);const px=imageData.data;
  const COLORS={
    [B_PLAINS]:[103,194,105],[B_FOREST]:[46,128,46],[B_DESERT]:[210,190,100],
    [B_SNOWY]:[220,235,240],[B_OCEAN]:[30,100,180],[B_MOUNTAINS]:[130,130,130],
    [B_SWAMP]:[70,100,70],[B_MESA]:[180,100,60]
  };
  const SCALE=3;
  for(let py=0;py<H;py++) for(let px2=0;px2<W;px2++){
    const wx=(px2-W/2)*SCALE,wz=(py-H/2)*SCALE;
    const biome=getBiome(wx,wz);
    const c=COLORS[biome]||[128,128,128];
    const h=sfbm(wx,wz);const shade=Math.floor(h*25);
    const idx=(py*W+px2)*4;
    px[idx]=Math.max(0,Math.min(255,c[0]+shade));px[idx+1]=Math.max(0,Math.min(255,c[1]+shade));px[idx+2]=Math.max(0,Math.min(255,c[2]+shade));px[idx+3]=255;
  }
  ctx.putImageData(imageData,0,0);
  ctx.fillStyle='#f44336';ctx.fillRect(W/2-2,H/2-2,4,4);
  _worldSeed=prevSeed; // restore
  const save=JSON.parse(localStorage.getItem('vc_save_'+worldName)||'null');
  const changes=save?.changes?.length||0;
  const infoEl=document.getElementById('preview-info');
  if(infoEl)infoEl.innerHTML=
    `<div>Seed: <span style="color:#a5d6a7">${seed}</span></div>`+
    `<div>Edits: <span style="color:#a5d6a7">${changes}</span></div>`+
    `<div>Pos: <span style="color:#a5d6a7">${save?.pos?save.pos.map(v=>Math.round(v)).join(', '):'unknown'}</span></div>`+
    `<div>Mode: <span style="color:#a5d6a7">${save?.mode||'survival'}</span></div>`;
}

// ── Friends System ──
function getFriends(){try{return JSON.parse(localStorage.getItem('vc_friends')||'{"list":[],"requests":[],"dms":{}}');}catch{return{list:[],requests:[],dms:{}};}}
function saveFriends(f){localStorage.setItem('vc_friends',JSON.stringify(f));}
let activeDM=null;
function frTab(id,el){
  document.querySelectorAll('.frt').forEach(t=>t.classList.remove('on'));el.classList.add('on');
  document.querySelectorAll('.fr-p').forEach(p=>p.classList.remove('on'));
  document.getElementById('fr-'+id).classList.add('on');
  if(id==='list')renderFriends();
  if(id==='req')renderFriendReqs();
  if(id==='dm')renderDMList();
  if(id==='online')renderOnlinePlayers();
}
function addFriend(){
  const name=document.getElementById('fr-add-inp').value.trim();if(!name)return;
  const f=getFriends();
  if(f.list.includes(name)||f.requests.includes(name)){showMsg('Already added',600);return;}
  // Send request via network if connected
  if(mpConnected)sendNet({t:'fr_req',from:ST.uname,to:name});
  f.list.push(name);saveFriends(f);
  document.getElementById('fr-add-inp').value='';
  renderFriends();showMsg('Added '+name,600);
}
function removeFriend(name){const f=getFriends();f.list=f.list.filter(n=>n!==name);saveFriends(f);renderFriends();}
function renderFriends(){
  const f=getFriends();const online=Object.values(otherPlayers).map(p=>p.uname);
  const el=document.getElementById('fr-list-el');if(!el)return;
  el.innerHTML=f.list.length?f.list.map(name=>{
    const isOnline=online.includes(name)||name===ST.uname;
    return`<div class="fr-row">
      <div class="fr-av" style="background:${isOnline?'#0a2a0a':'#0a0a0a'}">${name[0]?.toUpperCase()||'?'}</div>
      <div style="flex:1;"><div class="fr-nm">${name}</div><div class="fr-st ${isOnline?'fr-online':''}">${isOnline?'● Online':'○ Offline'}</div></div>
      <button class="mb g" style="font-size:7px;padding:2px 6px;" onclick="openDM('${name}')">DM</button>
      <button class="mb r" style="font-size:7px;padding:2px 6px;" onclick="removeFriend('${name}')">✕</button>
    </div>`;}).join(''):'<div style="color:#1a3a1a;font-size:9px;padding:10px 0;">No friends yet — add some!</div>';
}
function renderFriendReqs(){
  const f=getFriends();const el=document.getElementById('fr-req-el');if(!el)return;
  el.innerHTML=f.requests?.length?f.requests.map(name=>`<div class="fr-row">
    <div class="fr-av" style="background:#0a1a2a">${name[0]?.toUpperCase()||'?'}</div>
    <div class="fr-nm" style="flex:1;">${name} wants to be friends</div>
    <button class="mb g" style="font-size:7px;padding:2px 6px;" onclick="acceptFriend('${name}')">Accept</button>
    <button class="mb r" style="font-size:7px;padding:2px 6px;" onclick="declineFriend('${name}')">Decline</button>
  </div>`).join(''):'<div style="color:#1a3a1a;font-size:9px;padding:10px 0;">No pending requests</div>';
}
function acceptFriend(name){const f=getFriends();f.requests=f.requests.filter(n=>n!==name);if(!f.list.includes(name))f.list.push(name);saveFriends(f);renderFriendReqs();renderFriends();}
function declineFriend(name){const f=getFriends();f.requests=f.requests.filter(n=>n!==name);saveFriends(f);renderFriendReqs();}
function openDM(name){
  activeDM=name;
  // Switch to DM tab
  frTab('dm',document.querySelector('.frt:nth-child(3)'));
}
function renderDMList(){
  const f=getFriends();
  const el=document.getElementById('dm-friend-list');if(!el)return;
  el.innerHTML=f.list.map(name=>`<button class="mb ${activeDM===name?'g':'d'}" style="font-size:8px;padding:3px 8px;" onclick="activeDM='${name}';renderDMList();renderDMThread()">${name}</button>`).join('');
  renderDMThread();
}
function renderDMThread(){
  if(!activeDM)return;
  const f=getFriends();const msgs=f.dms[activeDM]||[];
  const el=document.getElementById('dm-thread');if(!el)return;
  el.innerHTML=msgs.length?msgs.map(m=>`<div class="dm-msg ${m.from===ST.uname?'dm-mine':'dm-them'}">
    <div class="dm-who">${m.from} · ${new Date(m.ts).toLocaleTimeString()}</div>
    <div>${m.text}</div>
  </div>`).join(''):'<div style="color:#1a3a1a;font-size:9px;text-align:center;margin-top:40px;">No messages yet</div>';
  el.scrollTop=el.scrollHeight;
}
function sendDM(){
  const text=document.getElementById('dm-inp').value.trim();if(!text||!activeDM)return;
  const f=getFriends();if(!f.dms[activeDM])f.dms[activeDM]=[];
  const msg={from:ST.uname,to:activeDM,text,ts:Date.now()};
  f.dms[activeDM].push(msg);saveFriends(f);
  // Relay via network
  if(mpConnected)sendNet({t:'dm',from:ST.uname,to:activeDM,text,ts:msg.ts});
  document.getElementById('dm-inp').value='';
  renderDMThread();
}
function renderOnlinePlayers(){
  const el=document.getElementById('fr-online-list');if(!el)return;
  const ops=Object.values(otherPlayers);
  const self=[{uname:ST.uname,self:true}];
  const all=[...self,...ops];
  el.innerHTML=all.map(p=>`<div class="fr-row">
    <div class="fr-av" style="background:#0a2a0a">${(p.uname||'?')[0].toUpperCase()}</div>
    <div style="flex:1;"><div class="fr-nm">${p.uname}${p.self?' (you)':''}</div><div class="fr-st fr-online">● In-game</div></div>
    ${!p.self?`<button class="mb g" style="font-size:7px;padding:2px 6px;" onclick="openDM('${p.uname}')">DM</button>`:''}
  </div>`).join('');
}

// Handle DM network messages
const _origHandle2=handleNet;
function handleNet(msg,from){
  _origHandle2(msg,from);
  if(msg?.t==='dm'&&msg.to===ST.uname){
    const f=getFriends();
    if(!f.dms[msg.from])f.dms[msg.from]=[];
    f.dms[msg.from].push({from:msg.from,to:msg.to,text:msg.text,ts:msg.ts||Date.now()});
    saveFriends(f);
    if(activeDM===msg.from)renderDMThread();
    addChat('📨',msg.from+': '+msg.text);
  }
  if(msg?.t==='fr_req'){
    const f=getFriends();if(!f.requests)f.requests=[];
    if(!f.requests.includes(msg.from))f.requests.push(msg.from);
    saveFriends(f);addChat('👥',msg.from+' sent you a friend request');
  }
}

// ── Account System ──
function getAccounts(){try{return JSON.parse(localStorage.getItem('vc_accounts')||'{}');}catch{return{};}}
function saveAccounts(a){localStorage.setItem('vc_accounts',JSON.stringify(a));}
function getCurrentAcc(){return localStorage.getItem('vc_current_acc')||null;}
function authTab(id,el){document.querySelectorAll('.atb').forEach(t=>t.classList.remove('on'));el.classList.add('on');document.getElementById('auth-login').style.display=id==='login'?'block':'none';document.getElementById('auth-signup').style.display=id==='signup'?'block':'none';}
function doLogin(){
  const u=document.getElementById('auth-username').value.trim();
  const p=document.getElementById('auth-password').value;
  if(!u||!p){showMsg('Fill all fields',700);return;}
  const accs=getAccounts();
  if(!accs[u]){showMsg('Account not found',800);return;}
  if(accs[u].pw!==btoa(p)){showMsg('Wrong password',800);return;}
  localStorage.setItem('vc_current_acc',u);
  accs[u].lastLogin=Date.now();saveAccounts(accs);
  ST.uname=u;saveST&&saveST();
  document.getElementById('st-uname').value=u;
  renderAccount();showMsg('Welcome back, '+u+'!',900);
}
function doSignup(){
  const u=document.getElementById('su-username').value.trim();
  const p=document.getElementById('su-password').value;
  const c=document.getElementById('su-confirm').value;
  const e=document.getElementById('su-email').value.trim();
  if(!u||!p){showMsg('Fill required fields',700);return;}
  if(p.length<6){showMsg('Password min 6 chars',700);return;}
  if(p!==c){showMsg('Passwords do not match',700);return;}
  const accs=getAccounts();
  if(accs[u]){showMsg('Username taken',700);return;}
  accs[u]={pw:btoa(p),email:e,created:Date.now(),lastLogin:Date.now(),worlds:0,playtime:0};
  saveAccounts(accs);localStorage.setItem('vc_current_acc',u);
  ST.uname=u;document.getElementById('st-uname').value=u;
  renderAccount();showMsg('Account created! Welcome, '+u,1000);
}
function doLogout(){localStorage.removeItem('vc_current_acc');renderAccount();}
function showAccEdit(){const u=getCurrentAcc();if(!u)return;const np=prompt('New username (leave blank to keep):')?.trim();if(np&&np!==u){const accs=getAccounts();if(accs[np]){showMsg('Username taken',700);return;}accs[np]=accs[u];delete accs[u];saveAccounts(accs);localStorage.setItem('vc_current_acc',np);ST.uname=np;renderAccount();}}
function renderAccount(){
  const u=getCurrentAcc();
  document.getElementById('acc-logged-out').style.display=u?'none':'block';
  document.getElementById('acc-logged-in').style.display=u?'block':'none';
  if(!u)return;
  const accs=getAccounts();const acc=accs[u]||{};
  document.getElementById('acc-name-lbl').textContent=u;
  document.getElementById('acc-avatar').textContent=u[0]?.toUpperCase()||'?';
  const daysOld=Math.floor((Date.now()-(acc.created||Date.now()))/(1000*60*60*24));
  document.getElementById('acc-badge').textContent=daysOld>30?'VETERAN':daysOld>7?'REGULAR':'NEW PLAYER';
  const ws=getWorlds();
  document.getElementById('acc-stats').innerHTML=`
    <div class="acc-stat"><span class="acc-sk">Worlds</span><span class="acc-sv">${ws.length}</span></div>
    <div class="acc-stat"><span class="acc-sk">Account Age</span><span class="acc-sv">${daysOld}d</span></div>
    <div class="acc-stat"><span class="acc-sk">Email</span><span class="acc-sv">${acc.email||'not set'}</span></div>
    <div class="acc-stat"><span class="acc-sk">Last Login</span><span class="acc-sv">${acc.lastLogin?new Date(acc.lastLogin).toLocaleDateString():'now'}</span></div>
    <div style="font-size:8px;color:#1a3a1a;margin-top:8px;line-height:1.8;">Account stored locally. For cross-device sync,<br>a backend server with JWT auth is needed.</div>`;
}

// ── Update renderWorldList to show preview on hover ──
function renderWorldList(){
  const ws=getWorlds().sort((a,b)=>b.created-a.created);
  const last=JSON.parse(localStorage.getItem('vc_last')||'null');
  const lastW=last?.type==='world'?last.name:null;
  const el=document.getElementById('wlist');
  el.innerHTML=ws.length?ws.map(w=>{
    const s=w.name.replace(/'/g,"\\'");
    const d=new Date(w.created).toLocaleDateString();
    const save=JSON.parse(localStorage.getItem('vc_save_'+w.name)||'null');
    const changes=save?.changes?.length||0;
    return`<div class="wcard${w.name===lastW?' last':''}" onmouseenter="previewWorld('${s}',${w.seed})" onmouseleave="">
      <div class="wico">${w.mode==='creative'?'✏':'🌍'}</div>
      <div class="wmeta">
        <div class="wname2">${w.name}</div>
        <div class="wdate">${w.mode||'survival'} · ${d} · ${changes} edits</div>
      </div>
      <div class="wbtns">
        <button class="mb g" onclick="enterWorld('${s}',${w.seed},'${w.mode||'survival'}')">▶</button>
        <button class="mb r" onclick="event.stopPropagation();delWorld('${s}')">✕</button>
      </div>
    </div>`;}).join(''):'<div class="empty-w">No worlds.<br>Create one!</div>';
  // Continue button
  const cw=document.getElementById('continue-wrap'),cb=document.getElementById('continue-btn');
  if(last?.type==='world'&&ws.find(w=>w.name===last.name)){
    cw.style.display='block';cb.textContent='▶  Continue: '+last.name;
    const lw=ws.find(w=>w.name===last.name);
    cb.onclick=()=>enterWorld(lw.name,lw.seed,lw.mode||'survival');
  } else if(last?.type==='server'){
    cw.style.display='block';cb.textContent='⚡  Reconnect: '+last.url;
    cb.onclick=()=>{document.getElementById('srv-url').value=last.url;switchTab('sv');svTab('join',document.querySelector('.mpt2'));connectWS();};
  } else cw.style.display='none';
}
let previewDebounce=null;
function previewWorld(name,seed){
  clearTimeout(previewDebounce);
  previewDebounce=setTimeout(()=>{
    document.getElementById('world-preview-panel').style.display='block';
    generateWorldPreview(seed,name);
  },200);
}

// ── showMain update ──
function showMain(){
  document.getElementById('mainmenu').style.display='flex';
  document.getElementById('nwscr').style.display='none';
  loadST();applyST();renderWorldList();renderServerList();renderMySrvList();renderAccount();
  // Auto-apply saved account username
  const u=getCurrentAcc();if(u){ST.uname=u;document.getElementById('st-uname').value=u;}
}

function populateWorldSelects(){
  const ws=getWorlds();const opts=ws.map(w=>`<option value="${w.name}">${w.name}</option>`).join('');
  ['cmd-world','prm-world'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts||'<option value="">No worlds</option>';});
  if(ws.length&&document.getElementById('prm-world'))renderPermPanel();
}

// ── Command Console ──
function cmdLog(msg,col='#4CAF50'){
  const el=document.getElementById('cmd-log');
  el.innerHTML+=`<div style="color:${col}">> ${msg}</div>`;el.scrollTop=el.scrollHeight;
}
function runCmd(){
  const raw=document.getElementById('cmd-inp').value.trim();
  if(!raw)return;
  document.getElementById('cmd-inp').value='';
  cmdLog(raw,'#888');
  const parts=raw.replace(/^\//,'').split(/\s+/);
  const cmd=parts[0].toLowerCase();
  const targetWorld=document.getElementById('cmd-world').value;
  // Commands work whether game is running or not
  // If game not running, load world data temporarily
  const inGame=gameStarted&&curWorld===targetWorld;

  try{
    if(cmd==='setblock'){
      const[,x,y,z,blk]=parts;const btype=resolveBlockName(blk);
      if(btype===null){cmdLog('Unknown block: '+blk,'#f44336');return;}
      if(inGame)setB(+x,+y,+z,btype);
      else applyChangeToSave(targetWorld,+x,+y,+z,btype);
      cmdLog(`Set block ${blk}(${btype}) at ${x},${y},${z}`);
    }
    else if(cmd==='fill'){
      const[,x1,y1,z1,x2,y2,z2,blk]=parts;const btype=resolveBlockName(blk);
      if(btype===null){cmdLog('Unknown block: '+blk,'#f44336');return;}
      let count=0;
      for(let x=Math.min(+x1,+x2);x<=Math.max(+x1,+x2);x++)
      for(let y=Math.min(+y1,+y2);y<=Math.max(+y1,+y2);y++)
      for(let z=Math.min(+z1,+z2);z<=Math.max(+z1,+z2);z++){
        if(inGame)setB(x,y,z,btype);else applyChangeToSave(targetWorld,x,y,z,btype);count++;
      }
      cmdLog(`Filled ${count} blocks with ${blk}`);
    }
    else if(cmd==='tp'){
      const[,x,y,z]=parts;
      if(inGame){player.pos.set(+x,+y,+z);cmdLog(`Teleported to ${x},${y},${z}`);}
      else cmdLog('Teleport: enter world first','#FF9800');
    }
    else if(cmd==='spawn'){
      const[,type,x,y,z]=parts;
      if(inGame){
        const sx=x?+x:player.pos.x+2,sy=y?+y:player.pos.y,sz=z?+z:player.pos.z+2;
        if(MOB_TYPES[type]){spawnMob(type,sx,sy,sz);cmdLog(`Spawned ${type} at ${sx.toFixed(1)},${sy.toFixed(1)},${sz.toFixed(1)}`);}
        else cmdLog('Unknown mob: '+type,'#f44336');
      } else cmdLog('Enter world first','#FF9800');
    }
    else if(cmd==='give'){
      const[,blk,cnt]=parts;const btype=resolveBlockName(blk);
      if(btype===null){cmdLog('Unknown item: '+blk,'#f44336');return;}
      if(inGame){invAdd(btype,+(cnt||1));renderHotbar();cmdLog(`Given ${cnt||1}x ${blk}`);}
      else cmdLog('Enter world first','#FF9800');
    }
    else if(cmd==='heal'){if(inGame){player.hp=player.maxHp;renderHUD();cmdLog('Player healed');}else cmdLog('Enter world first','#FF9800');}
    else if(cmd==='kill'){if(inGame){respawn();cmdLog('Player killed (respawned)');}else cmdLog('Enter world first','#FF9800');}
    else if(cmd==='clear'){if(inGame){inventory=new Array(36).fill(null);renderHotbar();cmdLog('Inventory cleared');}else cmdLog('Enter world first','#FF9800');}
    else if(cmd==='time'){
      cmdLog('Time: visual not implemented — use /fill to change environment','#FF9800');
    }
    else if(cmd==='help'){
      ['setblock x y z <block>','fill x1 y1 z1 x2 y2 z2 <block>','tp x y z','spawn <zombie|skeleton|slime|spider> [x y z]','give <block> [count]','heal','kill','clear'].forEach(h=>cmdLog(h,'#888'));
    }
    else cmdLog('Unknown command: '+cmd+' (try /help)','#f44336');
  }catch(e){cmdLog('Error: '+e.message,'#f44336');}
}
document.addEventListener('keydown',e=>{if(e.code==='Enter'&&document.activeElement===document.getElementById('cmd-inp'))runCmd();});

function resolveBlockName(name){
  if(!name)return null;
  const n=name.toLowerCase();
  const map={air:AIR,grass:GRASS,dirt:DIRT,stone:STONE,sand:SAND,wood:WOOD,leaves:LEAVES,snow:SNOW,water:WATER,gravel:GRAVEL,clay:CLAY,glass:GLASS,iron:IRON,gold:GOLD,engine:ENGINE_B,cobble:COBBLE,cobblestone:COBBLE,plank:PLANK,planks:PLANK,stick:STICK,rock:ROCK,leaf_pile:LEAF_PILE,leafpile:LEAF_PILE,cactus:CACTUS,red_sand:RED_SAND,redsand:RED_SAND,ice:ICE,moss:MOSS,coal:COAL_B,torch:TORCH};
  if(map[n]!==undefined)return map[n];
  // Check custom items
  for(const id in customItems){if(id===n)return customItems[id]._typeId;}
  const num=parseInt(n);if(!isNaN(num))return num;
  return null;
}

// Apply block change to a saved world without loading it into the game
function applyChangeToSave(worldName,x,y,z,type){
  const raw=localStorage.getItem('vc_save_'+worldName);
  const data=raw?JSON.parse(raw):{changes:[]};
  if(!data.changes)data.changes=[];
  // Remove existing entry for this coord
  data.changes=data.changes.filter(([k])=>k!==`${x},${y},${z}`);
  data.changes.push([`${x},${y},${z}`,type]);
  localStorage.setItem('vc_save_'+worldName,JSON.stringify(data));
  cmdLog(`Saved change to ${worldName} (${x},${y},${z})→${type}`,'#2a5a2a');
}

// ── Scripting ──
const VC={
  setBlock:(x,y,z,blk)=>{const t=resolveBlockName(String(blk));if(t===null)throw new Error('Unknown block: '+blk);if(gameStarted)setB(x,y,z,t);else{const w=document.getElementById('cmd-world').value;applyChangeToSave(w,x,y,z,t);}},
  getBlock:(x,y,z)=>{if(!gameStarted)return 0;return getB(x,y,z);},
  spawn:(type,x,y,z)=>{if(!gameStarted){scrLog('spawn requires entering world','#FF9800');return;}if(!MOB_TYPES[type]){scrLog('Unknown mob: '+type,'#f44336');return;}spawnMob(type,x??player.pos.x+2,y??player.pos.y,z??player.pos.z+2);},
  give:(blk,cnt=1)=>{if(!gameStarted){scrLog('give requires entering world','#FF9800');return;}const t=resolveBlockName(String(blk));if(t===null)throw new Error('Unknown item: '+blk);invAdd(t,cnt);renderHotbar();},
  tp:(x,y,z)=>{if(!gameStarted){scrLog('tp requires entering world','#FF9800');return;}player.pos.set(x,y,z);},
  log:(msg)=>scrLog(String(msg)),
  world:()=>curWorld,
  pos:()=>({x:player.pos.x,y:player.pos.y,z:player.pos.z}),
  BD, MOB_TYPES, inventory,
};
function scrLog(msg,col='#4CAF50'){const el=document.getElementById('scr-log');el.innerHTML+=`<div style="color:${col}">${msg}</div>`;el.scrollTop=el.scrollHeight;}
function runScript(){
  const code=document.getElementById('scr-code').value;
  document.getElementById('scr-log').innerHTML='';
  try{const fn=new Function('VC',code);fn(VC);scrLog('Script completed ✓');}
  catch(e){scrLog('Error: '+e.message,'#f44336');}
}
function saveScript(){const name=prompt('Script name:');if(!name)return;localStorage.setItem('vc_script_'+name,document.getElementById('scr-code').value);scrLog('Saved as: '+name);}
function loadScript(){const name=prompt('Script name to load:');if(!name)return;const c=localStorage.getItem('vc_script_'+name);if(c){document.getElementById('scr-code').value=c;scrLog('Loaded: '+name);}else scrLog('Not found: '+name,'#f44336');}
function clearScriptLog(){document.getElementById('scr-log').innerHTML='';}

// ── Custom Items ──
let _nextCustomId=100;
function registerCustomItem(){
  const id=document.getElementById('itm-id').value.trim().toLowerCase();
  const name=document.getElementById('itm-name').value.trim();
  const top=parseInt(document.getElementById('itm-top').value.slice(1),16);
  const side=parseInt(document.getElementById('itm-side').value.slice(1),16);
  const mass=parseFloat(document.getElementById('itm-mass').value)||1;
  const buoy=parseFloat(document.getElementById('itm-buoy').value)||0;
  if(!id||!name){alert('ID and Name required');return;}
  const typeId=_nextCustomId++;
  BD[typeId]={name,top,side,bot:side,mass,buoy};
  customItems[id]={_typeId:typeId,id,name,top,side,mass,buoy};
  // Persist
  const all=JSON.parse(localStorage.getItem('vc_custom_items')||'{}');
  all[id]={typeId,name,top:top.toString(16),side:side.toString(16),mass,buoy};
  localStorage.setItem('vc_custom_items',JSON.stringify(all));
  renderCustomItemList();renderBlockList();
  showMsg('Item "'+name+'" registered (ID '+typeId+')',900);
}
function renderCustomItemList(){
  const el=document.getElementById('custom-item-list');
  const items=Object.values(customItems);
  el.innerHTML=items.length?items.map(it=>`<div class="cit-row">
    <div class="cit-sw" style="background:#${it.top.toString(16).padStart(6,'0')}"></div>
    <span style="flex:1;color:#a5d6a7;">${it.name}</span>
    <span style="color:#1a3a1a;font-size:8px;">${it.id}</span>
    <button class="mb r" style="font-size:7px;padding:2px 5px;" onclick="removeCustomItem('${it.id}')">✕</button>
  </div>`).join(''):'<div style="color:#1a3a1a;font-size:9px;padding:6px 0;">No custom items yet</div>';
}
function removeCustomItem(id){
  if(customItems[id]){delete BD[customItems[id]._typeId];delete customItems[id];}
  const all=JSON.parse(localStorage.getItem('vc_custom_items')||'{}');delete all[id];
  localStorage.setItem('vc_custom_items',JSON.stringify(all));
  renderCustomItemList();renderBlockList();
}
function loadCustomItems(){
  const all=JSON.parse(localStorage.getItem('vc_custom_items')||'{}');
  for(const id in all){
    const it=all[id];const typeId=it.typeId||_nextCustomId++;
    const top=parseInt(it.top,16),side=parseInt(it.side,16);
    BD[typeId]={name:it.name,top,side,bot:side,mass:it.mass||1,buoy:it.buoy||0};
    customItems[id]={_typeId:typeId,id,name:it.name,top,side,mass:it.mass||1,buoy:it.buoy||0};
    if(typeId>=_nextCustomId)_nextCustomId=typeId+1;
  }
}

// ── Permissions ──
function getPerms(world){
  if(!worldPerms[world])worldPerms[world]=JSON.parse(localStorage.getItem('vc_perms_'+world)||'{"flags":{"pvp":true,"build":true,"mobs":true,"whitelist":false},"whitelist":[],"banlist":[]}');
  return worldPerms[world];
}
function savePerms(world){localStorage.setItem('vc_perms_'+world,JSON.stringify(worldPerms[world]));}
function renderPermPanel(){
  const world=document.getElementById('prm-world')?.value;if(!world)return;
  const p=getPerms(world);
  const flagDefs=[
    {key:'pvp',label:'PVP Enabled'},
    {key:'build',label:'Players Can Build'},
    {key:'mobs',label:'Mobs Spawn'},
    {key:'whitelist',label:'Whitelist Only'},
  ];
  document.getElementById('perm-flags').innerHTML=flagDefs.map(f=>`
    <div class="perm-flag">
      <input type="checkbox" id="pf-${f.key}" ${p.flags[f.key]?'checked':''} onchange="setPermFlag('${world}','${f.key}',this.checked)">
      <label for="pf-${f.key}" style="cursor:pointer;">${f.label}</label>
    </div>`).join('');
  const allP=[...p.whitelist.map(n=>({n,role:'allowed'})),...p.banlist.map(n=>({n,role:'banned'}))];
  document.getElementById('perm-players').innerHTML=allP.length?allP.map(({n,role})=>`<div class="ppl-row">
    <div class="ppl-nm">${n}</div>
    <div class="ppl-role" style="color:${role==='banned'?'#f44336':'#4CAF50'}">${role.toUpperCase()}</div>
    <button class="mb r" style="font-size:7px;padding:2px 5px;" onclick="removePermPlayer('${world}','${n}')">✕</button>
  </div>`).join(''):'<div style="color:#1a3a1a;font-size:9px;padding:4px 0;">No players added</div>';
}
document.getElementById('prm-world')?.addEventListener('change',renderPermPanel);
function setPermFlag(world,key,val){const p=getPerms(world);p.flags[key]=val;savePerms(world);}
function permitPlayer(){
  const world=document.getElementById('prm-world').value;const name=document.getElementById('prm-player').value.trim();if(!name)return;
  const p=getPerms(world);if(!p.whitelist.includes(name))p.whitelist.push(name);p.banlist=p.banlist.filter(n=>n!==name);
  document.getElementById('prm-player').value='';savePerms(world);renderPermPanel();
}
function banPlayer(){
  const world=document.getElementById('prm-world').value;const name=document.getElementById('prm-player').value.trim();if(!name)return;
  const p=getPerms(world);if(!p.banlist.includes(name))p.banlist.push(name);p.whitelist=p.whitelist.filter(n=>n!==name);
  document.getElementById('prm-player').value='';savePerms(world);renderPermPanel();
}
function removePermPlayer(world,name){const p=getPerms(world);p.whitelist=p.whitelist.filter(n=>n!==name);p.banlist=p.banlist.filter(n=>n!==name);savePerms(world);renderPermPanel();}

// Apply perms in-game (called on join/pvp)
function checkPerms(world,action){const p=getPerms(world);return p.flags[action]!==false;}

// ── Server Panel ──
const SERVER_CODE=`// VoxelCraft Relay Server (Node.js)
// npm install ws && node server.js
const {WebSocketServer} = require('ws');
const wss = new WebSocketServer({ port: 8080 });
const clients = new Map(); // ws -> {id, uname}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2);
  clients.set(ws, { id, uname: 'unknown' });
  console.log('[+] Client', id, '—', clients.size, 'online');

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.t === 'join') clients.get(ws).uname = msg.u;
      // Relay to all other clients with sender id
      msg.id = id;
      const j = JSON.stringify(msg);
      wss.clients.forEach(c => {
        if (c !== ws && c.readyState === 1) c.send(j);
      });
    } catch {}
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    const bye = JSON.stringify({t:'bye', id, u: info?.uname});
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(bye); });
    clients.delete(ws);
    console.log('[-] Client', id, '—', clients.size, 'online');
  });
});
console.log('VoxelCraft server listening on ws://localhost:8080');`;

function renderSrvPanel(){
  document.getElementById('srv-code').value=SERVER_CODE;
  const connected=mpConnected;
  document.getElementById('srv-status').textContent=connected?'◉ Connected to server':'○ Not connected';
  document.getElementById('srv-status').style.color=connected?'#4CAF50':'#2a5a2a';
  const pnames=Object.values(otherPlayers).map(op=>`<div class="ppl-row"><div class="ppl-nm">${op.uname}</div><div class="ppl-role" style="color:#4CAF50">ONLINE</div></div>`).join('');
  document.getElementById('srv-players').innerHTML=pnames||'<div style="color:#1a3a1a;font-size:9px;padding:4px 0;">No players connected</div>';
}
function copySrvCode(){navigator.clipboard?.writeText(SERVER_CODE).then(()=>showMsg('Server code copied!',700));}
function srvBroadcast(){
  const m=document.getElementById('srv-msg').value.trim();if(!m)return;
  sendNet({t:'chat',u:'[SERVER]',m});addChat('[SERVER]',m);
  document.getElementById('srv-msg').value='';
}

// ── Block Registry Panel ──
function renderBlockList(){
  const el=document.getElementById('blk-list');
  const all=Object.entries(BD).map(([id,def])=>`<div class="blk-row">
    <div class="blk-swatch" style="background:#${def.top.toString(16).padStart(6,'0')}"></div>
    <div class="blk-swatch" style="background:#${def.side.toString(16).padStart(6,'0')}"></div>
    <span class="blk-nm">${def.name}</span>
    <span class="blk-id">id=${id}  mass=${def.mass??'—'}  buoy=${def.buoy??'—'}</span>
  </div>`).join('');
  el.innerHTML=all;
}

// ── Enforce Perms in game ──
// Wrap pvpHit to check pvp perm
const _origHandleNet=handleNet;
function handleNet(msg,from){
  _origHandleNet(msg,from);
  // Already handled, but if pvpHit received and pvp is off, reverse damage
  if(msg?.t==='pvpHit'&&msg.target===myId&&gameStarted&&!checkPerms(curWorld,'pvp')){
    // Restore HP (permission blocked)
    player.hp=Math.min(player.maxHp,player.hp+msg.dmg);renderHUD();
  }
}

// INIT
loadST();loadCustomItems();showMain();initPeerJS();

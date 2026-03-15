'use strict';
//  SETTINGS
// ══════════════════════════════════════════════════
let ST={rd:3,fov:75,sens:1.0,uname:'Player'};
function loadST(){try{Object.assign(ST,JSON.parse(localStorage.getItem('vc_st')||'{}'));}catch{}}
function saveST(){
  ST.rd=+document.getElementById('st-rd').value;
  ST.fov=+document.getElementById('st-fov').value;
  ST.sens=+document.getElementById('st-sens').value;
  ST.uname=document.getElementById('st-uname').value.trim()||'Player';
  localStorage.setItem('vc_st',JSON.stringify(ST));
  showMsg('Settings saved',700);
}
function stCh(){
  document.getElementById('sv-rd').textContent=document.getElementById('st-rd').value;
  document.getElementById('sv-fov').textContent=document.getElementById('st-fov').value+'°';
  document.getElementById('sv-sens').textContent=(+document.getElementById('st-sens').value).toFixed(1);
}
function applyST(){
  RD=ST.rd;camera.fov=ST.fov;camera.updateProjectionMatrix();
  document.getElementById('st-rd').value=ST.rd;
  document.getElementById('st-fov').value=ST.fov;
  document.getElementById('st-sens').value=ST.sens;
  document.getElementById('st-uname').value=ST.uname;
  stCh();
}
let newWorldMode='survival';
function setNewMode(m){newWorldMode=m;document.getElementById('mode-survival').classList.toggle('on',m==='survival');document.getElementById('mode-creative').classList.toggle('on',m==='creative');}

// ══════════════════════════════════════════════════
//  INVENTORY  (36 slots, 0-8 = hotbar)
// ══════════════════════════════════════════════════
let inventory=new Array(36).fill(null); // {type, count, rot}
const HS=9;
// rot: 0,1,2,3 = 0°,90°,180°,270° around Y
function invAdd(type,n=1){
  for(let i=0;i<36;i++){if(inventory[i]?.type===type&&inventory[i].count<64){inventory[i].count+=n;return i;}}
  for(let i=0;i<36;i++){if(!inventory[i]){inventory[i]={type,count:n,rot:0};return i;}}
  return -1;
}
function invRem(slot,n=1){if(!inventory[slot])return false;inventory[slot].count-=n;if(inventory[slot].count<=0)inventory[slot]=null;return true;}
function held(){return inventory[selSlot];}
function rotateSlot(slot){if(inventory[slot])inventory[slot].rot=((inventory[slot].rot||0)+1)%4;}

// ══════════════════════════════════════════════════
//  WORLD SAVE — saves chunk diffs (only changed blocks)
// ══════════════════════════════════════════════════
let curWorld='',gameMode='survival',gameStarted=false;
let spawnPos=new THREE.Vector3(8,SL+20,8);
// blockChanges: Map of "x,y,z" -> blockType — only blocks different from gen
const blockChanges=new Map();

function getWorlds(){try{return JSON.parse(localStorage.getItem('vc_worlds')||'[]');}catch{return[];}}
function saveWorldMeta(n,s,mode){
  const ws=getWorlds();
  const existing=ws.find(w=>w.name===n);
  if(existing){existing.mode=mode||'survival';}
  else ws.push({name:n,seed:s,mode:mode||'survival',created:Date.now()});
  localStorage.setItem('vc_worlds',JSON.stringify(ws));
}
function delWorld(n){
  localStorage.setItem('vc_worlds',JSON.stringify(getWorlds().filter(w=>w.name!==n)));
  localStorage.removeItem('vc_save_'+n);renderWorldList();
}
function saveGame(){
  if(!curWorld)return;
  // Convert blockChanges to array for storage
  const changes=[];blockChanges.forEach((v,k)=>changes.push([k,v]));
  const data={
    pos:player.pos.toArray(),yaw:player.yaw,pitch:player.pitch,
    inv:inventory,hp:player.hp,mode:gameMode,
    changes // THE FIX: save all block changes
  };
  localStorage.setItem('vc_save_'+curWorld,JSON.stringify(data));
  localStorage.setItem('vc_last',JSON.stringify({type:'world',name:curWorld}));
}
function loadGameSave(name){
  const raw=localStorage.getItem('vc_save_'+name);
  if(!raw)return false;
  const s=JSON.parse(raw);
  player.pos.fromArray(s.pos||[8,SL+5,8]);
  player.yaw=s.yaw||0;player.pitch=s.pitch||0;
  inventory=s.inv||new Array(36).fill(null);
  player.hp=s.hp||20;
  gameMode=s.mode||'survival';
  // Replay block changes
  blockChanges.clear();
  if(s.changes)s.changes.forEach(([k,v])=>{
    blockChanges.set(k,v);
    const[x,y,z]=k.split(',').map(Number);
    _applyBlock(x,y,z,v); // apply to chunk data
  });
  return true;
}
window.addEventListener('beforeunload',saveGame);

// ══════════════════════════════════════════════════

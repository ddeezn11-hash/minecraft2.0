'use strict';
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

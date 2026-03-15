'use strict';
function updateWeather(dt){
  weatherTimer+=dt;
  // Cycle weather every 90-200 seconds
  if(weatherTimer>weatherDuration){
    weatherTimer=0;weatherDuration=90+Math.random()*120;
    const types=['clear','clear','clear','rain','storm','snow'];
    weatherType=types[Math.floor(Math.random()*types.length)];
    initRain();
    if(weatherType==='storm'){windSpeed=3+Math.random()*2;}
    else if(weatherType==='clear'){windSpeed=0.5+Math.random()*0.8;}
  }
  weatherT+=dt;
  // Animate rain/snow particles
  if(rainPS){
    const pos=rainGeo.attributes.position.array;
    const spd=weatherType==='snow'?1.5:8;
    for(let i=0;i<RAIN_COUNT;i++){
      pos[i*3+1]-=spd*dt;
      if(pos[i*3+1]<player.pos.y-5){
        pos[i*3]=player.pos.x+(Math.random()-0.5)*40;
        pos[i*3+1]=player.pos.y+20;
        pos[i*3+2]=player.pos.z+(Math.random()-0.5)*40;
      }
    }
    rainGeo.attributes.position.needsUpdate=true;
    rainPS.position.set(0,0,0);
    // Snow drifts with wind
    if(weatherType==='snow'){for(let i=0;i<RAIN_COUNT;i++){pos[i*3]+=wind.x*0.3*dt;pos[i*3+2]+=wind.z*0.3*dt;}}
  }
  // Storm: sky darkens
  const stormFactor=weatherType==='storm'?0.4:weatherType==='rain'?0.65:1.0;
  renderer.setClearColor(new THREE.Color(0x90CAF9).multiplyScalar(stormFactor));
  scene.fog.color.setHex(weatherType==='storm'?0x4a5a6a:weatherType==='rain'?0x607080:0x90CAF9);

  // Wind leaves drop sticks from trees
  if((weatherType==='storm'||windSpeed>2.5)&&Math.random()<windSpeed*0.008*dt){
    const px=player.pos.x+(Math.random()-0.5)*16,pz=player.pos.z+(Math.random()-0.5)*16;
    // Check for leaves nearby
    for(let dy=2;dy<10;dy++){
      if(getB(Math.floor(px),Math.floor(player.pos.y)+dy,Math.floor(pz))===LEAVES){
        spawnDrop(STICK,px,player.pos.y+dy+1,pz,wind.x*0.5,(Math.random()*0.5),wind.z*0.5);
        break;
      }
    }
  }
  // Rain wets: moss grows on stone slowly
}

// ══════════════════════════════════════════════════
//  PHYSICAL PROXIMITY CRAFTING
// ══════════════════════════════════════════════════
// Recipes: [{inputs:[type,count,...], output:type, outCount}]
const CRAFT_RECIPES=[
  {inputs:[STICK,2,ROCK,1],   output:COBBLE,  outCount:1, name:'Stone Axe'},
  {inputs:[STICK,3],           output:PLANK,   outCount:2, name:'Planks'},
  {inputs:[PLANK,4],           output:WOOD,    outCount:1, name:'Wood Block'},
  {inputs:[STICK,1,LEAF_PILE,2],output:TORCH, outCount:2, name:'Torches'},
  {inputs:[COAL_B,1,STICK,1], output:TORCH,   outCount:4, name:'Torches'},
  {inputs:[ROCK,2,STICK,1],   output:COBBLE,  outCount:2, name:'Cobble'},
  {inputs:[PLANK,2,STICK,2],  output:ENGINE_B,outCount:1, name:'Engine Frame'},
  {inputs:[SAND,4],            output:GLASS,   outCount:2, name:'Glass'},
  {inputs:[GRAVEL,3,CLAY,1],  output:STONE,   outCount:2, name:'Stone'},
  // Tools
  {inputs:[IRON,2,STICK,1],   output:SWORD,   outCount:1, name:'Iron Sword'},
  {inputs:[COBBLE,2,STICK,1], output:SWORD,   outCount:1, name:'Stone Sword'},
  {inputs:[ROCK,3,STICK,1],   output:AXE,     outCount:1, name:'Rock Axe'},
  {inputs:[IRON,3,STICK,2],   output:AXE,     outCount:1, name:'Iron Axe'},
  // Storage & utility
  {inputs:[PLANK,6],           output:CHEST,   outCount:1, name:'Chest'},
  {inputs:[COBBLE,8,COAL_B,1],output:FURNACE, outCount:1, name:'Furnace'},
  {inputs:[WOOD,2,COBBLE,4],  output:FURNACE, outCount:1, name:'Furnace'},
];

let craftTimer=0;
function checkProximityCraft(){
  // Collect all drops within 2 blocks of player
  const nearby=[];
  for(let i=0;i<drops.length;i++){
    const d=drops[i];
    const dx=d.mesh.position.x-player.pos.x,dy=d.mesh.position.y-player.pos.y,dz=d.mesh.position.z-player.pos.z;
    if(Math.hypot(dx,dy,dz)<2.2)nearby.push(i);
  }
  if(nearby.length<2)return;
  // Count types
  const counts={};
  for(const idx of nearby){const t=drops[idx].type;counts[t]=(counts[t]||0)+1;}
  // Check each recipe
  for(const r of CRAFT_RECIPES){
    let ok=true;
    const needed={};
    for(let i=0;i<r.inputs.length;i+=2){const t=r.inputs[i],n=r.inputs[i+1];needed[t]=(needed[t]||0)+n;}
    for(const t in needed){if((counts[t]||0)<needed[t]){ok=false;break;}}
    if(!ok)continue;
    // Consume drops
    for(const t in needed){
      let rem=needed[t];
      for(let i=drops.length-1;i>=0&&rem>0;i--){
        if(drops[i].type===Number(t)){scene.remove(drops[i].mesh);drops.splice(i,1);rem--;}
      }
    }
    // Spawn output
    spawnDrop(r.output,player.pos.x,player.pos.y+0.8,player.pos.z,0,3,0);
    if(r.outCount>1){for(let k=1;k<r.outCount;k++)spawnDrop(r.output,player.pos.x,player.pos.y+0.8,player.pos.z,(Math.random()-0.5)*2,3,(Math.random()-0.5)*2);}
    showMsg(`⚒  ${r.name}  crafted!`,1200);
    return; // one recipe per check
  }
}

// ══════════════════════════════════════════════════
//  GROUND ITEMS — sticks, rocks, leaf piles
// ══════════════════════════════════════════════════
// Spawn natural pickups at world load / exploration
let naturalSpawnT=0;
function spawnNaturalItems(){
  // Rocks in ocean shallows
  const px=Math.floor(player.pos.x),pz=Math.floor(player.pos.z);
  for(let dx=-8;dx<=8;dx+=4) for(let dz=-8;dz<=8;dz+=4){
    const wx=px+dx,wz=pz+dz;
    for(let y=SL-3;y<=SL+1;y++){
      if(getB(wx,y,wz)===WATER&&getB(wx,y-1,wz)===GRAVEL&&Math.random()<0.008){
        spawnDrop(ROCK,wx+Math.random(),y,wz+Math.random(),0,0.5,0);
      }
    }
    // Leaf piles under trees
    for(let y2=player.pos.y;y2<player.pos.y+6;y2++){
      if(getB(wx,Math.floor(y2),wz)===LEAVES&&getB(wx,Math.floor(y2)-1,wz)!==AIR&&Math.random()<0.003){
        spawnDrop(LEAF_PILE,wx,Math.floor(y2),wz,0,0.2,0);
      }
    }
  }
}

// ══════════════════════════════════════════════════
//  PLAYER HAND SWING
// ══════════════════════════════════════════════════
let handSwing=0,handSwinging=false;
const handMesh=new THREE.Mesh(
  new THREE.BoxGeometry(0.12,0.5,0.12),
  new THREE.MeshLambertMaterial({color:0xFFCBA4})
);
handMesh.visible=false;scene.add(handMesh);
// Item in hand visual
const handItemMesh=new THREE.Mesh(
  new THREE.BoxGeometry(0.22,0.22,0.22),
  new THREE.MeshLambertMaterial({color:0xA0712A})
);
handItemMesh.visible=false;scene.add(handItemMesh);

function triggerSwing(){handSwinging=true;handSwing=0;}
function updateHand(dt){
  if(!gameStarted||tpMode!==0)return;
  // Position hand in view (bottom-right corner)
  const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const base=camera.position.clone().add(fwd.clone().multiplyScalar(0.5)).add(right.clone().multiplyScalar(0.22)).add(up.clone().multiplyScalar(-0.18));

  if(handSwinging){
    handSwing+=dt*8;
    if(handSwing>Math.PI){handSwinging=false;handSwing=0;}
  }
  const swingOff=handSwinging?Math.sin(handSwing)*0.12:0;
  handMesh.position.copy(base).add(fwd.clone().multiplyScalar(swingOff));
  handMesh.quaternion.copy(camera.quaternion);
  handMesh.visible=true;

  const hd=held();
  if(hd&&BD[hd.type]){
    const def=BD[hd.type];
    const c=getBlockMat(hd.type,'top');
    handItemMesh.material=c;
    handItemMesh.position.copy(base).add(fwd.clone().multiplyScalar(0.08+swingOff));
    handItemMesh.quaternion.copy(camera.quaternion);
    handItemMesh.visible=true;
    handMesh.visible=false;
  } else {
    handItemMesh.visible=false;
    handMesh.visible=true;
  }
}

// Show biome name on screen
let biomeShowT=0,lastBiome=-1;
function checkBiomeChange(){
  const b=getBiome(Math.floor(player.pos.x),Math.floor(player.pos.z));
  if(b!==lastBiome){lastBiome=b;biomeShowT=3;const names=['Plains','Forest','Desert','Snowy Tundra','Ocean','Mountains','Swamp','Mesa'];showMsg(names[b]||'Unknown',2000);}
  if(biomeShowT>0)biomeShowT-=0.016;
}

// ══════════════════════════════════════════════════
//  TORCH LIGHTS
// ══════════════════════════════════════════════════
const torchLights=new Map(); // "x,y,z" -> PointLight
function updateTorchLights(){
  // Scan nearby blocks for torches, add/remove point lights
  const px=Math.floor(player.pos.x),py=Math.floor(player.pos.y),pz=Math.floor(player.pos.z);
  const active=new Set();
  for(let dx=-6;dx<=6;dx++) for(let dy=-4;dy<=4;dy++) for(let dz=-6;dz<=6;dz++){
    const bx=px+dx,by=py+dy,bz=pz+dz;
    if(getB(bx,by,bz)===TORCH){
      const k=`${bx},${by},${bz}`;active.add(k);
      if(!torchLights.has(k)){
        const l=new THREE.PointLight(0xFF8C00,1.2,8);
        l.position.set(bx+0.5,by+0.8,bz+0.5);
        scene.add(l);torchLights.set(k,l);
      }
      // Flicker
      const l=torchLights.get(k);
      l.intensity=1.1+Math.sin(wTime*12+bx*3.7+bz*2.1)*0.15;
    }
  }
  // Remove lights for removed torches
  torchLights.forEach((l,k)=>{if(!active.has(k)){scene.remove(l);torchLights.delete(k);}});
}

// ══════════════════════════════════════════════════
//  CHEST STORAGE
// ══════════════════════════════════════════════════
const chestData={}; // "x,y,z" -> [{type,count}×27]
let openChest=null;
function getChestKey(x,y,z){return`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;}
function openChestUI(x,y,z){
  const k=getChestKey(x,y,z);
  if(!chestData[k])chestData[k]=new Array(27).fill(null);
  openChest=k;
  // Build UI
  document.getElementById('invscr').style.display='flex';
  invOpen=true;document.exitPointerLock();
  renderChestScreen(k);
}
function renderChestScreen(k){
  const inv=document.getElementById('inv-main');
  inv.innerHTML='';
  const slots=chestData[k]||[];
  for(let i=0;i<27;i++){
    const sl=slots[i];const el=document.createElement('div');
    el.className='isl';el.style.width='46px';el.style.height='46px';
    if(sl&&BD[sl.type]){
      const def=BD[sl.type];
      const T='#'+def.top.toString(16).padStart(6,'0'),S='#'+def.side.toString(16).padStart(6,'0');
      el.innerHTML=`<div class="ic"><div class="ict" style="background:${T}"></div><div class="ics" style="background:${S}"></div></div><div class="icn">${sl.count>99?'99+':sl.count}</div>`;
      el.title=def.name;
    }
    el.onclick=()=>{
      const held2=held();
      if(held2&&!sl){chestData[k][i]={type:held2.type,count:1};invRem(selSlot);renderHotbar();renderChestScreen(k);}
      else if(sl&&!held2){invAdd(sl.type,sl.count);chestData[k][i]=null;renderHotbar();renderChestScreen(k);}
    };
    inv.appendChild(el);
  }
  const lbl=document.querySelector('.inv-lbl');if(lbl)lbl.textContent='Chest Storage (27 slots)';
  renderInvHotbarOnly();
}
function renderInvHotbarOnly(){
  const he=document.getElementById('inv-hbar');he.innerHTML='';
  for(let i=0;i<9;i++){
    const sl=inventory[i];const el=document.createElement('div');el.className='isl'+(i===selSlot?' ia':'');
    if(sl&&BD[sl.type]){const def=BD[sl.type];const T='#'+def.top.toString(16).padStart(6,'0'),S='#'+def.side.toString(16).padStart(6,'0');el.innerHTML=`<div class="ic"><div class="ict" style="background:${T}"></div><div class="ics" style="background:${S}"></div></div><div class="icn">${sl.count>99?'99+':sl.count}</div>`;}
    el.onclick=()=>{selSlot=i;renderHotbar();};el.appendChild&&el.appendChild;
    he.appendChild(el);
  }
}

// ══════════════════════════════════════════════════
//  FURNACE SMELTING
// ══════════════════════════════════════════════════
const furnaceData={}; // "x,y,z" -> {input, fuel, progress, output}
const SMELT_RECIPES={[IRON]:{output:GOLD,time:8},[SAND]:{output:GLASS,time:5},[COBBLE]:{output:STONE,time:6},[CLAY]:{output:BRICK||STONE,time:8}};
let furnaceT=0;
function tickFurnaces(dt){
  furnaceT+=dt;if(furnaceT<1)return;furnaceT=0;
  for(const k in furnaceData){
    const f=furnaceData[k];
    if(!f.input||!f.fuel)continue;
    const recipe=SMELT_RECIPES[f.input.type];if(!recipe)continue;
    if(f.fuel>0){f.fuel--;f.progress=(f.progress||0)+1;}
    if(f.progress>=(recipe.time)){
      f.progress=0;f.output={type:recipe.output,count:(f.output?.count||0)+1};
      f.input.count--;if(f.input.count<=0)f.input=null;
    }
  }
}
function openFurnaceUI(x,y,z){
  const k=getChestKey(x,y,z);
  if(!furnaceData[k])furnaceData[k]={input:null,fuel:0,progress:0,output:null};
  showMsg('Furnace: drop iron/sand onto it to smelt. Place wood nearby as fuel.',2500);
}

// ══════════════════════════════════════════════════
//  HUNGER SYSTEM (survival only)
// ══════════════════════════════════════════════════
let hunger=20,hungerT=0,hungerDrainT=0;
const FOOD_ITEMS={[LEAF_PILE]:1,[CACTUS]:2,[MOSS]:1};
function updateHunger(dt){
  if(gameMode==='creative')return;
  hungerDrainT+=dt;
  if(hungerDrainT>30){hungerDrainT=0;hunger=Math.max(0,hunger-1);renderHunger();}
  // Running/swimming drains faster
  if((keys['ShiftLeft']||keys['ShiftRight'])&&(Math.abs(player.vel.x||0)>0.1)){hungerDrainT+=dt*0.5;}
  // Regen health when full hunger
  if(hunger>=18&&player.hp<player.maxHp){hungerT+=dt;if(hungerT>4){hungerT=0;player.hp=Math.min(player.maxHp,player.hp+1);renderHUD();}}
  // Take damage when starving
  if(hunger===0&&player.hp>1){hungerT+=dt;if(hungerT>3){hungerT=0;player.hp--;flashDmg();renderHUD();}}
}
function renderHunger(){
  const el=document.getElementById('hearts');if(!el)return;
  let h='';
  for(let i=0;i<10;i++){const f=player.hp>=(i+1)*2,hf=!f&&player.hp>=i*2+1;h+=`<span class="ht ${f?'f':hf?'h':'e'}">♥</span>`;}
  h+=' ';
  for(let i=0;i<10;i++){const f=hunger>=(i+1)*2,hf=!f&&hunger>=i*2+1;h+=`<span class="ht" style="color:${f?'#F57F17':hf?'#BF360C':'#1a1a1a'}">${f?'🍗':hf?'🍖':'🍗'}</span>`;}
  el.innerHTML=h;
}
function eatItem(slot){
  const s=inventory[slot];if(!s||!FOOD_ITEMS[s.type])return false;
  hunger=Math.min(20,hunger+FOOD_ITEMS[s.type]*2);invRem(slot);renderHotbar();renderHunger();
  showMsg('Nom!',400);return true;
}

// ══════════════════════════════════════════════════
//  WEAPON DAMAGE BONUSES
// ══════════════════════════════════════════════════
function getPlayerDmg(){
  const s=held();if(!s)return 3;
  const def=BD[s.type];if(!def)return 3;
  return 3+(def.dmgBonus||0);
}
function getMineSpeed(){
  const s=held();if(!s)return 1;
  const def=BD[s.type];if(!def)return 1;
  return def.mineBonus?2.5:1;
}

// ══════════════════════════════════════════════════
//  EXTRA CRAFTING RECIPES
// ══════════════════════════════════════════════════
CRAFT_RECIPES.push(
  {inputs:[COBBLE,3,STICK,2],  output:SWORD,   outCount:1, name:'Stone Sword'},
  {inputs:[COBBLE,3,STICK,2],  output:AXE,     outCount:1, name:'Stone Axe'},
  {inputs:[COBBLE,8],           output:FURNACE, outCount:1, name:'Furnace'},
  {inputs:[PLANK,8],            output:CHEST,   outCount:1, name:'Chest'},
  {inputs:[STICK,1,LEAF_PILE,1],output:TORCH,  outCount:1, name:'Torch'},
  {inputs:[ROCK,4,STICK,1],     output:AXE,    outCount:1, name:'Rock Axe'},
  {inputs:[SAND,4,ROCK,2],      output:GLASS,  outCount:4, name:'Glass'},
  {inputs:[DIRT,4,STICK,1],     output:PLANK,  outCount:4, name:'Planks (dirt)'},
);


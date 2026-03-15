'use strict';
//  MAIN MENU
// ══════════════════════════════════════════════════
function mpTab(id,el){document.querySelectorAll('.mpt').forEach(t=>t.classList.remove('on'));el.classList.add('on');document.querySelectorAll('.mp-p').forEach(p=>p.classList.remove('on'));document.getElementById('mp-'+id).classList.add('on');}

// showMain and renderWorldList defined in ENGINE section above
function showNewWorld(){document.getElementById('nwscr').style.display='flex';document.getElementById('mainmenu').style.display='none';document.getElementById('nw-name').focus();}
function createWorld(){
  const name=(document.getElementById('nw-name').value||'').trim();if(!name){showMsg('Enter a name',700);return;}
  const seed=Math.floor(Math.random()*99999+1);
  saveWorldMeta(name,seed,newWorldMode);
  enterWorld(name,seed,newWorldMode);
}
function enterWorld(name,seed,mode){
  loadST();curWorld=name;gameMode=mode||'survival';
  _worldSeed=seed||1; // CRITICAL: set before any chunk generation
  document.getElementById('mainmenu').style.display='none';document.getElementById('nwscr').style.display='none';
  renderer.domElement.style.display='block';document.getElementById('menubg').style.display='none';
  gameStarted=true;
  // Reset state
  inventory=new Array(36).fill(null);
  if(gameMode==='creative'){
    [GRASS,DIRT,STONE,COBBLE,SAND,RED_SAND,WOOD,PLANK,LEAVES,SNOW,ICE,GRAVEL,CLAY,GLASS,IRON,GOLD,COAL_B,MOSS,CACTUS,ENGINE_B,BUILD_I,GLUE_I,STICK,ROCK,LEAF_PILE,TORCH].forEach(t=>invAdd(t,64));
  } else {
    invAdd(BUILD_I);invAdd(GLUE_I);invAdd(ENGINE_B,2);
    // Survival starts with a stick and a rock so player can craft immediately
    invAdd(STICK,3);invAdd(ROCK,2);
  }
  fx.spd=0;fx.reg=0;player.hp=20;player.yaw=0;player.pitch=0;player.vel.set(0,0,0);player.flying=false;
  tpMode=0;structures.length=0;gluedSet.clear();engFacing.clear();drops.length=0;blockChanges.clear();
  mobs.forEach(m=>scene.remove(m.grp));mobs.length=0;arrows.forEach(a=>scene.remove(a.mesh));arrows.length=0;score=0;
  weatherType='clear';weatherTimer=0;weatherDuration=60+Math.random()*120;if(rainPS){scene.remove(rainPS);rainPS=null;}
  lastBiome=-1;handSwinging=false;handSwing=0;
  // Mode badge
  const mb=document.getElementById('mode-badge');
  mb.className='mode-badge '+(gameMode==='creative'?'creative':'survival');
  mb.textContent=gameMode.toUpperCase();
  // Load chunks first, then apply save
  loadAround(0,0);
  const loaded=loadGameSave(name);
  if(!loaded){
    let sy=SL+5;
    for(let y=WH-1;y>=1;y--){const b=getB(8,y,8);if(b!==AIR&&b!==WATER&&b!==LEAVES){sy=y+2;break;}}
    player.pos.set(8,sy,8);spawnPos.set(8,sy,8);
  } else spawnPos.copy(player.pos);
  renderHotbar();renderHUD();renderFX();renderEngHUD();applyST();
  localStorage.setItem('vc_last',JSON.stringify({type:'world',name}));
  renderer.domElement.requestPointerLock();
  if(!loopStarted){loopStarted=true;requestAnimationFrame(t=>{lastT=t;loop(t);});}
}
function backToMenu(){
  saveGame();document.exitPointerLock();
  chunks.clear();
  meshMap.forEach(ms=>ms.forEach(m=>{scene.remove(m);m.geometry.dispose();}));meshMap.clear();
  drops.forEach(d=>scene.remove(d.mesh));drops.length=0;
  structures.forEach(s=>scene.remove(s.grp));structures.length=0;
  mobs.forEach(m=>{scene.remove(m.grp);});mobs.length=0;
  arrows.forEach(a=>scene.remove(a.mesh));arrows.length=0;
  Object.values(mobTags).forEach(el=>el.remove());for(const k in mobTags)delete mobTags[k];
  Object.keys(otherPlayers).forEach(rmOtherPlayer);
  gameStarted=false;running=false;invOpen=false;chatOpen=false;pG.visible=false;lastCX=999;lastCZ=999;
  handMesh.visible=false;handItemMesh.visible=false;
  if(rainPS){scene.remove(rainPS);rainPS=null;}
  ['crosshair','hud','info','eff-hud','tlabel','keyhints','tplbl','nametag','wind-hud','mp-badge','eng-hud','mode-badge','weather-hud','craft-hint'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('pause').style.display='none';document.getElementById('invscr').style.display='none';
  renderer.domElement.style.display='none';document.getElementById('menubg').style.display='block';
  showMain();
}

// ══════════════════════════════════════════════════

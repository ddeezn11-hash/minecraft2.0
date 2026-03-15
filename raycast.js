'use strict';
//  RAYCAST
// ══════════════════════════════════════════════════
const _rd=new THREE.Vector3();
function raycast(){
  _rd.set(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  let px=camera.position.x,py=camera.position.y,pz=camera.position.z;
  let pbx=Math.floor(px),pby=Math.floor(py),pbz=Math.floor(pz);
  for(let i=0;i<180;i++){
    const bx=Math.floor(px),by=Math.floor(py),bz=Math.floor(pz);
    const b=getB(bx,by,bz);
    if(b!==AIR&&b!==WATER)return{hit:{x:bx,y:by,z:bz},prev:{x:pbx,y:pby,z:pbz}};
    pbx=bx;pby=by;pbz=bz;px+=_rd.x*0.045;py+=_rd.y*0.045;pz+=_rd.z*0.045;
  }
  return null;
}

// Rotation suffix for engine direction display
const ROT_DIRS=['→N','→E','→S','→W'];

function attackPlayer(){
  if(!mpConnected)return false;
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  let best=null,bestDist=4.5;
  for(const id in otherPlayers){
    const op=otherPlayers[id];
    const dx=op.grp.position.x-player.pos.x,dy=op.grp.position.y-player.pos.y,dz=op.grp.position.z-player.pos.z;
    const d=Math.hypot(dx,dy,dz);
    const dot=(dx*fwd.x+dz*fwd.z)/Math.max(0.01,Math.hypot(dx,dz));
    if(d<bestDist&&dot>0.55){bestDist=d;best=id;}
  }
  if(!best)return false;
  const dmg=getPlayerDmg();
  const op=otherPlayers[best];
  op.flash=0.35; // flash their model red locally
  hitFlash=0.15; // flash our crosshair
  // Send hit to all peers (they will check if target===myId and apply damage)
  sendNet({t:'pvpHit',target:best,dmg,u:ST.uname,id:myId});
  addChat('⚔','You hit '+op.uname);
  return true;
}

function doMine(){
  if(attackPlayer())return;
  if(attackMob())return;
  const t=raycast();if(!t)return;
  const b=getB(t.hit.x,t.hit.y,t.hit.z);if(b===AIR||b===WATER)return;
  if(gameMode!=='creative'){
    setB(t.hit.x,t.hit.y,t.hit.z,AIR);
    // Drop table: block -> what it drops
    const dropTable={
      [GRASS]:DIRT,
      [STONE]:COBBLE,
      [COBBLE]:COBBLE,
      [WOOD]:WOOD,
      [LEAVES]:LEAF_PILE,
      [IRON]:IRON,
      [GOLD]:GOLD,
      [COAL_B]:STICK,  // coal ore → stick (simplified; no coal item type yet)
      [MOSS]:COBBLE,
      [ICE]:WATER,     // melts (water drop is skipped)
      [CACTUS]:CACTUS,
      [RED_SAND]:RED_SAND,
    };
    // Rare extra drops
    if(b===WOOD){
      // Extra sticks from breaking wood
      for(let i=0;i<2;i++)spawnDrop(STICK,t.hit.x,t.hit.y,t.hit.z,(Math.random()-0.5)*2,2,(Math.random()-0.5)*2);
    }
    if(b===LEAVES&&Math.random()<0.3)spawnDrop(STICK,t.hit.x,t.hit.y,t.hit.z,0,1,0);
    if(b===GRAVEL&&Math.random()<0.12)spawnDrop(ROCK,t.hit.x,t.hit.y,t.hit.z,0,2,0);
    if(b===STONE&&Math.random()<0.015){spawnDrop(PSPD,t.hit.x,t.hit.y,t.hit.z,0,2,0);}
    else if(b===GRAVEL&&Math.random()<0.08){spawnDrop(PREG,t.hit.x,t.hit.y,t.hit.z,0,2,0);}
    // Main drop
    const drop=dropTable[b]??b;
    if(drop!==null&&drop!==WATER)spawnDrop(drop,t.hit.x,t.hit.y,t.hit.z,(Math.random()-0.5)*1.5,2.5,(Math.random()-0.5)*1.5);
  } else {
    setB(t.hit.x,t.hit.y,t.hit.z,AIR);
  }
  sendNet({t:'blk',x:t.hit.x,y:t.hit.y,z:t.hit.z,b:AIR});
}

function doPlace(){
  const s=held();if(!s)return;
  const def=BD[s.type];if(!def)return;

  // Potions
  if(s.type===PSPD){applyFX('spd',30);invRem(selSlot);renderHotbar();showMsg('⚡ Speed +30s',1000);return;}
  if(s.type===PREG){applyFX('reg',30);invRem(selSlot);renderHotbar();showMsg('♥ Regen +30s',1000);return;}

  // Tool: Glue
  if(s.type===GLUE_I){
    const t=raycast();if(!t)return;
    const k=`${t.hit.x},${t.hit.y},${t.hit.z}`;
    gluedSet.has(k)?(gluedSet.delete(k),showMsg('Unglued',500)):(gluedSet.add(k),showMsg('Glued ✓',500));
    return;
  }

  // Tool: Build Analyzer
  if(s.type===BUILD_I){
    // First check structure hit
    const sh=raycastStructure();
    if(sh){
      const st=structures[sh.si];
      const netF=st.buoyTotal*10-st.mass*9.8;
      showMsg(`Structure: mass=${st.mass.toFixed(1)}  buoy×10=${(st.buoyTotal*10).toFixed(1)}  net=${netF>0?'+':''}${netF.toFixed(1)}N  ${netF>0?'FLOATS':'SINKS'}  fuel=${Math.ceil(st.fuel)}s`,3000);
      return;
    }
    const t=raycast();if(!t)return;
    const k=`${t.hit.x},${t.hit.y},${t.hit.z}`;
    if(gluedSet.has(k)){activateStructure(t.hit.x,t.hit.y,t.hit.z);return;}
    const b=getB(t.hit.x,t.hit.y,t.hit.z);const bd2=BD[b]||{};
    showMsg(`${BD[b]?.name}: mass=${bd2.mass||1}  buoy=${bd2.buoy||0}  (${(bd2.buoy||0)>0?'floats':'sinks'})  Right-glue+activate`,2000);
    return;
  }

  if(def.noPlace)return;

  // Try placing on structure first
  const sh=raycastStructure();
  if(sh){
    const st=structures[sh.si];
    const mats=[getMat(def.side),getMat(def.side),getMat(def.top),getMat(def.bot||def.side),getMat(def.side),getMat(def.side)];
    const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);
    m.position.copy(sh.adjLocal);st.grp.add(m);
    st.group.push({x:Math.round(sh.adjWorld.x),y:Math.round(sh.adjWorld.y),z:Math.round(sh.adjWorld.z),type:s.type});
    st.mass+=(def.mass||1);st.buoyTotal+=(def.buoy||0);if(def.sail)st.sails++;
    if(s.type===ENGINE_B)st.engCount++;
    if(gameMode!=='creative')invRem(selSlot);
    renderHotbar();showMsg('Added to structure',500);
    return;
  }

  // World placement
  const t=raycast();if(!t)return;
  const{x,y,z}=t.prev;
  const pp=player.pos;
  if(Math.abs(x+0.5-pp.x)<0.45&&Math.abs(z+0.5-pp.z)<0.45&&y>=pp.y-0.1&&y<=pp.y+player.H)return;

  // Engine: store facing direction based on block rotation
  if(s.type===ENGINE_B){
    const rot=s.rot||0;
    const dirs=[{dx:0,dz:-1},{dx:1,dz:0},{dx:0,dz:1},{dx:-1,dz:0}];
    engFacing.set(`${x},${y},${z}`,dirs[rot]);
  }

  if(gameMode!=='creative')invRem(selSlot);
  setB(x,y,z,s.type);renderHotbar();
  sendNet({t:'blk',x,y,z,b:s.type});

  // Fuel engine with wood (right-click ENGINE block)
  if(getB(t.hit.x,t.hit.y,t.hit.z)===ENGINE_B&&s.type===WOOD){
    for(const st of structures){if(st.engCount>0){st.fuel+=60;showMsg(`Engine fueled! +60s (total ${Math.ceil(st.fuel)}s)`,1000);renderEngHUD();break;}}
  }
}

// ══════════════════════════════════════════════════

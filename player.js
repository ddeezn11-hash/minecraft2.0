'use strict';
// isSolid — used by both player movement and mob AI
//  PHYSICS
// ══════════════════════════════════════════════════
function isSolid(b){return b!==AIR&&b!==WATER&&b!==LEAVES;}
function collides(x,y,z){
  for(let bx=Math.floor(x-player.W);bx<=Math.floor(x+player.W);bx++)
  for(let bz=Math.floor(z-player.W);bz<=Math.floor(z+player.W);bz++)
  for(let by=Math.floor(y);by<=Math.floor(y+player.H-0.01);by++)
    if(isSolid(getB(bx,by,bz)))return true;
  return false;
}

// ══════════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
//  WEATHER SYSTEM
// ══════════════════════════════════════════════════
let weatherType='clear'; // clear, rain, storm, snow
let weatherTimer=0,weatherDuration=0,weatherT=0;
const particles=[];
const rainGeo=new THREE.BufferGeometry();
const rainMat=new THREE.PointsMaterial({color:0x8ab4cc,size:0.08,transparent:true,opacity:0.5});
let rainPS=null;
const RAIN_COUNT=800;

function initRain(){
  if(rainPS){scene.remove(rainPS);rainPS=null;}
  if(weatherType==='clear')return;
  const pos=new Float32Array(RAIN_COUNT*3);
  for(let i=0;i<RAIN_COUNT;i++){pos[i*3]=(Math.random()-0.5)*40;pos[i*3+1]=Math.random()*20+player.pos.y;pos[i*3+2]=(Math.random()-0.5)*40;}
  rainGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  rainPS=new THREE.Points(rainGeo,weatherType==='snow'?new THREE.PointsMaterial({color:0xffffff,size:0.15,transparent:true,opacity:0.8}):rainMat);
  scene.add(rainPS);
}


// UPDATE LOOP
function update(dt){
  if(!running)return;
  player.yaw-=mdx*0.002*ST.sens;
  player.pitch=Math.max(-1.54,Math.min(1.54,player.pitch-mdy*0.002*ST.sens));
  mdx=0;mdy=0;
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const rgt=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  let mx=0,mz=0;
  if(keys['KeyW']){mx+=fwd.x;mz+=fwd.z;}if(keys['KeyS']){mx-=fwd.x;mz-=fwd.z;}
  if(keys['KeyA']){mx-=rgt.x;mz-=rgt.z;}if(keys['KeyD']){mx+=rgt.x;mz+=rgt.z;}
  const ml=Math.hypot(mx,mz);if(ml>0){mx/=ml;mz/=ml;}
  if(ml>0)walkT+=dt;
  const bodyB=getB(Math.floor(player.pos.x),Math.floor(player.pos.y+0.3),Math.floor(player.pos.z));
  const headB=getB(Math.floor(player.pos.x),Math.floor(player.pos.y+player.H-0.2),Math.floor(player.pos.z));
  const inW=(bodyB===WATER);
  const spd=player.speed*(keys['ShiftLeft']?1.8:1)*(fx.spd>0?1.5:1)*(gameMode==='creative'?1.5:1);

  if(gameMode==='creative'&&player.flying){
    // Creative fly
    player.vel.set(0,0,0);
    let fy=0;if(keys['Space'])fy=6;if(keys['ShiftLeft'])fy=-6;
    player.pos.x+=mx*spd*dt;player.pos.z+=mz*spd*dt;player.pos.y+=fy*dt;
    player.onGround=false;
  } else {
    player.vel.y+=(inW?-3.5:-24)*dt;
    player.vel.y=Math.max(inW?-2.5:-40,player.vel.y);
    if(keys['Space']&&(player.onGround||inW))player.vel.y=inW?3.8:player.jumpV;
    if(!player.onGround&&player.vel.y<0&&!player.wasFall){player.wasFall=true;player.lastFallY=player.pos.y;}
    const nx2=player.pos.x+mx*spd*dt;if(!collides(nx2,player.pos.y,player.pos.z))player.pos.x=nx2;
    const nz2=player.pos.z+mz*spd*dt;if(!collides(player.pos.x,player.pos.y,nz2))player.pos.z=nz2;
    const ny2=player.pos.y+player.vel.y*dt;
    if(!collides(player.pos.x,ny2,player.pos.z)){player.pos.y=ny2;player.onGround=false;}
    else{
      if(player.vel.y<0){
        player.onGround=true;
        if(player.wasFall&&gameMode!=='creative'){const f=player.lastFallY-player.pos.y;if(f>3.5){player.hp=Math.max(0,player.hp-Math.floor((f-3.5)*1.5));flashDmg();renderHUD();}if(player.hp<=0)respawn();}
        player.wasFall=false;
      }
      player.vel.y=0;
    }
  }

  // Camera
  const eyeY=player.pos.y+player.H-0.1;
  if(tpMode===0){
    camera.position.set(player.pos.x,eyeY,player.pos.z);
    camera.rotation.order='YXZ';camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
    pG.visible=false;document.getElementById('nametag').style.display='none';
  } else {
    pG.visible=true;pG.position.set(player.pos.x,player.pos.y,player.pos.z);pG.rotation.y=player.yaw+Math.PI;
    const wa=Math.sin(walkT*7)*(ml>0?0.55:0);
    pLL.rotation.x=wa;pRL.rotation.x=-wa;pLA.rotation.x=-wa;pRA.rotation.x=wa;
    const back=tpMode===1?1:-1;
    camera.position.set(player.pos.x-Math.sin(player.yaw)*3.8*back,player.pos.y+2.2,player.pos.z-Math.cos(player.yaw)*3.8*back);
    camera.lookAt(player.pos.x,player.pos.y+1.1,player.pos.z);
    const pr=new THREE.Vector3(player.pos.x,player.pos.y+2.3,player.pos.z).project(camera);
    const nt=document.getElementById('nametag');
    if(pr.z<1){nt.style.display='block';nt.style.left=((pr.x+1)/2*innerWidth)+'px';nt.style.top=((-pr.y+1)/2*innerHeight)+'px';nt.textContent=ST.uname;}
    else nt.style.display='none';
  }

  // UW fx
  const uw=(headB===WATER);
  document.getElementById('uwfx').style.display=uw?'block':'none';
  renderer.setClearColor(uw?0x0a2040:0x90CAF9);
  scene.fog.color.setHex(uw?0x0a2040:0x90CAF9);scene.fog.near=uw?4:40;scene.fog.far=uw?20:120;

  // Day/night cycle (full day = 600s)
  wTime+=dt;
  const dayT=(wTime%600)/600; // 0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight
  const sunAngle=dayT*Math.PI*2;
  sun.position.set(Math.cos(sunAngle)*100,Math.sin(sunAngle)*100,60);
  sun.intensity=Math.max(0,Math.sin(sunAngle)*0.85);
  const ambStrength=Math.max(0.12,Math.sin(sunAngle)*0.5+0.25);
  scene.children.find(c=>c.isAmbientLight)?.intensity && (scene.children.find(c=>c.isAmbientLight).intensity=ambStrength);
  // Sky color: day=light blue, sunset=orange, night=dark blue
  const nightFrac=Math.max(0,-Math.sin(sunAngle));
  const skyR=Math.round(144-nightFrac*140+Math.max(0,Math.sin(sunAngle+0.3))*60);
  const skyG=Math.round(202-nightFrac*190);
  const skyB=Math.round(249-nightFrac*220);
  if(!uw){renderer.setClearColor(new THREE.Color(skyR/255,skyG/255,skyB/255));scene.fog.color.setRGB(skyR/255,skyG/255,skyB/255);}
  // Stars appear at night
  starsMesh.position.copy(camera.position);
  starsMesh.material.opacity=Math.max(0,nightFrac*1.2-0.1);
  starsMesh.material.needsUpdate=true;
  // Ambient dims at night
  ambient.intensity=Math.max(0.08,0.6-nightFrac*0.5);
  // Water shimmer
  waterMats.forEach(m=>{m.color.setRGB(0.09+Math.sin(wTime*0.55)*0.04,0.38+Math.sin(wTime*0.38)*0.10,0.78+Math.sin(wTime*0.31)*0.14);m.opacity=0.68+Math.sin(wTime*1.05)*0.07;m.needsUpdate=true;});
  // Mobs spawn more at night
  if(nightFrac>0.5&&!gameStarted){}; // just a hook

  // Block highlight
  const ray=raycast();
  const sh=raycastStructure();
  if(ray&&(!sh||ray!==null)){
    hlMesh.position.set(ray.hit.x+0.5,ray.hit.y+0.5,ray.hit.z+0.5);hlMesh.visible=true;
    const isG=gluedSet.has(`${ray.hit.x},${ray.hit.y},${ray.hit.z}`);
    glueHL.visible=isG;if(isG)glueHL.position.copy(hlMesh.position);
    const b2=getB(ray.hit.x,ray.hit.y,ray.hit.z);const bd2=BD[b2]||{};
    const hd=held();
    let tl=BD[b2]?.name||'';
    if(hd?.type===BUILD_I)tl+=`  buoy=${bd2.buoy||0} mass=${bd2.mass||1}`;
    if(hd?.type===GLUE_I)tl+=isG?' [glued]':' [click to glue]';
    if(hd?.type===ENGINE_B)tl+=`  will face ${ROT_DIRS[hd.rot||0]}`;
    document.getElementById('tlabel').textContent=tl;document.getElementById('tlabel').style.display='block';
  }else{hlMesh.visible=false;glueHL.visible=false;document.getElementById('tlabel').style.display='none';}

  document.getElementById('info').innerHTML=
    `${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}  <span style="color:#1a3a1a">${curWorld}</span><br>`+
    `${(held()?BD[held().type]?.name:'—')}${held()?' ×'+held().count:''} ${held()?.rot!==undefined?ROT_DIRS[held().rot||0]:''}<br>`+
    `${player.onGround?'Ground':'Air'}${inW?' Swimming':''}${isRiding>=0?' Riding':''}${player.flying?' ✈ Flying':''} ${['Plains','Forest','Desert','Tundra','Ocean','Mountains','Swamp','Mesa'][getBiome(Math.floor(player.pos.x),Math.floor(player.pos.z))]||''}`;

  // Weather HUD
  const wh=document.getElementById('weather-hud');
  const wIcons={clear:'',rain:'🌧',storm:'⛈',snow:'❄'};
  wh.textContent=weatherType!=='clear'?(wIcons[weatherType]||'')+' '+(weatherType.toUpperCase()):'';;
  wh.style.display=weatherType!=='clear'?'block':'none';

  // Craft hint: show available recipe if drops nearby
  const nearby=drops.filter(d=>{const dx=d.mesh.position.x-player.pos.x,dy=d.mesh.position.y-player.pos.y,dz=d.mesh.position.z-player.pos.z;return Math.hypot(dx,dy,dz)<2.5;});
  const chEl=document.getElementById('craft-hint');
  if(nearby.length>=2){
    const counts={};nearby.forEach(d=>{counts[d.type]=(counts[d.type]||0)+1;});
    const possible=CRAFT_RECIPES.filter(r=>{let ok=true;for(let i=0;i<r.inputs.length;i+=2){if((counts[r.inputs[i]]||0)<r.inputs[i+1]){ok=false;break;}}return ok;});
    if(possible.length){chEl.textContent='⚒ Drop items to craft: '+possible.map(r=>r.name).join(', ');chEl.style.display='block';}
    else{chEl.style.display='none';}
  } else chEl.style.display='none';

  physT+=dt;if(physT>0.1){physT=0;processPhys();}
  waterT+=dt;if(waterT>0.18){waterT=0;processWater();}
  tickFX(dt);updateDrops(dt);updateWind(dt);updateStructures(dt);checkRiding();
  updateMobs(dt);updateArrows(dt);updateOtherPlayerHUDs();
  updateWeather(dt);updateHand(dt);checkBiomeChange();
  updateHunger(dt);updateTorchLights();tickFurnaces(dt);
  craftTimer+=dt;if(craftTimer>0.5){craftTimer=0;checkProximityCraft();}
  naturalSpawnT+=dt;if(naturalSpawnT>8){naturalSpawnT=0;spawnNaturalItems();}
  // Hitmarker
  if(hitFlash>0){hitFlash-=dt;const c=document.getElementById('crosshair');c.style.color=hitFlash>0?'#f44336':'rgba(255,255,255,0.75)';}

  netT+=dt;if(netT>0.1){netT=0;sendNet({t:'mv',x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,u:ST.uname,id:myId,hp:player.hp});}

  const cx=Math.floor(player.pos.x/CS),cz=Math.floor(player.pos.z/CS);
  if(cx!==lastCX||cz!==lastCZ){lastCX=cx;lastCZ=cz;loadAround(cx,cz);}
}

function loadAround(cx,cz){
  const nw=[];
  for(let dx=-RD;dx<=RD;dx++) for(let dz=-RD;dz<=RD;dz++){
    const k=ck(cx+dx,cz+dz);
    if(!chunks.has(k)){
      chunks.set(k,genChunk(cx+dx,cz+dz));nw.push({x:cx+dx,z:cz+dz});
      // Replay block changes that fall in this chunk
      const rcx=cx+dx,rcz=cz+dz;
      blockChanges.forEach((v,key)=>{
        const[bx,by,bz]=key.split(',').map(Number);
        if(Math.floor(bx/CS)===rcx&&Math.floor(bz/CS)===rcz)_applyBlock(bx,by,bz,v);
      });
    }
  }
  const toR=new Set();
  nw.forEach(({x,z})=>{for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) toR.add(ck(x+dx,z+dz));});
  for(let dx=-RD;dx<=RD;dx++) for(let dz=-RD;dz<=RD;dz++){const k=ck(cx+dx,cz+dz);if(!meshMap.has(k)||!meshMap.get(k).length)toR.add(k);}
  toR.forEach(k=>{if(!chunks.has(k))return;const[a,b]=k.split(',').map(Number);rebuildChunk(a,b);});
}

// ══════════════════════════════════════════════════

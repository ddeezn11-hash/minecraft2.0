'use strict';
//  MOBS & COMBAT
// ══════════════════════════════════════════════════
const MOB_TYPES={
  zombie:{name:'Zombie',hp:10,speed:2.2,dmg:2,color:0x558B2F,eyeColor:0xFF0000,drop:DIRT,score:10,size:0.55},
  skeleton:{name:'Skeleton',hp:8,speed:2.8,dmg:1,color:0xEEEEEE,eyeColor:0x222222,drop:GRAVEL,score:15,ranged:true,size:0.5},
  slime:{name:'Slime',hp:6,speed:1.5,dmg:1,color:0x66BB6A,eyeColor:0x1B5E20,drop:LEAVES,score:5,size:0.7,bouncy:true},
  spider:{name:'Spider',hp:8,speed:3.5,dmg:1,color:0x4E342E,eyeColor:0xFF6F00,drop:SAND,score:12,size:0.45,climbs:true},
};
const mobs=[];
let mobTimer=0,score=0;

// Mob hitmarker flash
let hitFlash=0;

function mkMobMesh(type){
  const def=MOB_TYPES[type];
  const g=new THREE.Group();
  // Body
  const body=new THREE.Mesh(new THREE.BoxGeometry(def.size,def.size*1.2,def.size),new THREE.MeshLambertMaterial({color:def.color}));
  body.position.y=def.size*0.8;g.add(body);
  // Head
  const head=new THREE.Mesh(new THREE.BoxGeometry(def.size*0.85,def.size*0.85,def.size*0.85),new THREE.MeshLambertMaterial({color:def.color}));
  head.position.y=def.size*1.6;g.add(head);
  // Eyes
  const eyeMat=new THREE.MeshBasicMaterial({color:def.eyeColor});
  const eyeGeo=new THREE.BoxGeometry(def.size*0.18,def.size*0.14,0.05);
  const eL=new THREE.Mesh(eyeGeo,eyeMat);eL.position.set(-def.size*0.22,def.size*1.7,-def.size*0.43);g.add(eL);
  const eR=new THREE.Mesh(eyeGeo,eyeMat);eR.position.set(def.size*0.22,def.size*1.7,-def.size*0.43);g.add(eR);
  // Legs
  const legMat=new THREE.MeshLambertMaterial({color:new THREE.Color(def.color).multiplyScalar(0.7)});
  for(const x of [-0.14,0.14]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(def.size*0.38,def.size*0.7,def.size*0.38),legMat);
    leg.position.set(x*def.size*2,def.size*0.35,0);g.add(leg);
  }
  // Slime: extra round look
  if(type==='slime'){
    const inner=new THREE.Mesh(new THREE.BoxGeometry(def.size*0.6,def.size*0.6,def.size*0.6),new THREE.MeshLambertMaterial({color:0x81C784,transparent:true,opacity:0.5}));
    inner.position.y=def.size*0.8;g.add(inner);
  }
  return g;
}

function spawnMob(type,x,y,z){
  const def=MOB_TYPES[type];
  const grp=mkMobMesh(type);
  grp.position.set(x,y,z);
  scene.add(grp);
  mobs.push({grp,type,hp:def.hp,maxHp:def.hp,vx:0,vy:0,vz:0,onGround:false,age:0,attackCd:0,bounceCd:0,arrowCd:0,alertDist:16,active:false});
}

// Arrows (skeleton projectiles)
const arrows=[];
const arrowGeo=new THREE.BoxGeometry(0.06,0.06,0.4);
const arrowMat=new THREE.MeshLambertMaterial({color:0xA1722A});
function fireArrow(from,tx,ty,tz){
  const m=new THREE.Mesh(arrowGeo,arrowMat);
  m.position.set(from.x,from.y+0.8,from.z);
  const dx=tx-from.x,dy=ty-from.y,dz=tz-from.z;
  const len=Math.hypot(dx,dy,dz);
  arrows.push({mesh:m,vx:dx/len*12,vy:dy/len*12+0.5,vz:dz/len*12,age:0});
  scene.add(m);
}
function updateArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){
    const a=arrows[i];a.age+=dt;
    a.vy-=12*dt;
    a.mesh.position.x+=a.vx*dt;a.mesh.position.y+=a.vy*dt;a.mesh.position.z+=a.vz*dt;
    a.mesh.lookAt(a.mesh.position.x+a.vx,a.mesh.position.y+a.vy,a.mesh.position.z+a.vz);
    if(a.age>4||isSolid(getB(Math.floor(a.mesh.position.x),Math.floor(a.mesh.position.y),Math.floor(a.mesh.position.z)))){
      scene.remove(a.mesh);arrows.splice(i,1);continue;
    }
    // Hit player
    if(gameMode!=='creative'){
      const dx=a.mesh.position.x-player.pos.x,dy=a.mesh.position.y-player.pos.y-0.8,dz=a.mesh.position.z-player.pos.z;
      if(Math.hypot(dx,dy,dz)<0.9){
        player.hp=Math.max(0,player.hp-1);flashDmg();renderHUD();
        scene.remove(a.mesh);arrows.splice(i,1);
        if(player.hp<=0)respawn();
      }
    }
  }
}

// Mob name tags (HTML overlays)
const mobTags={};
function getMobTag(idx){
  if(!mobTags[idx]){
    const el=document.createElement('div');
    el.style.cssText='position:fixed;pointer-events:none;z-index:12;transform:translateX(-50%);color:#fff;font-size:9px;background:rgba(0,0,0,0.6);padding:1px 6px;font-family:monospace;white-space:nowrap;';
    document.body.appendChild(el);mobTags[idx]=el;
  }
  return mobTags[idx];
}
function cleanMobTags(){Object.values(mobTags).forEach(el=>el.style.display='none');}

function updateMobs(dt){
  // Spawn timer
  mobTimer+=dt;
  const dayT2=(wTime%600)/600;const nightMult=Math.max(0,-Math.sin(dayT2*Math.PI*2))>0.4?0.4:1.0;
  const spawnInterval=Math.max(4,(20-score/50)*nightMult);
  if(mobTimer>spawnInterval&&mobs.length<12){
    mobTimer=0;
    const types=Object.keys(MOB_TYPES);
    const type=types[Math.floor(Math.random()*types.length)];
    const angle=Math.random()*Math.PI*2;
    const dist=14+Math.random()*8;
    const mx=player.pos.x+Math.cos(angle)*dist;
    const mz=player.pos.z+Math.sin(angle)*dist;
    let my=SL+5;
    for(let y=WH-1;y>=1;y--){if(isSolid(getB(Math.floor(mx),y,Math.floor(mz)))){my=y+1;break;}}
    spawnMob(type,mx,my,mz);
  }

  cleanMobTags();

  for(let i=mobs.length-1;i>=0;i--){
    const m=mobs[i];const def=MOB_TYPES[m.type];
    m.age+=dt;m.attackCd=Math.max(0,m.attackCd-dt);m.arrowCd=Math.max(0,m.arrowCd-dt);

    const mx=m.grp.position.x,my=m.grp.position.y,mz=m.grp.position.z;
    const dx=player.pos.x-mx,dy=player.pos.y-my,dz=player.pos.z-mz;
    const dist=Math.hypot(dx,dz);
    const dist3=Math.hypot(dx,dy,dz);

    // Activate when player nearby
    if(dist<m.alertDist)m.active=true;
    if(!m.active){continue;}

    // Nametag
    const tag=getMobTag(i);
    const pr=new THREE.Vector3(mx,my+def.size*2,mz).project(camera);
    if(pr.z<1&&pr.z>-1){
      tag.style.display='block';
      tag.style.left=((pr.x+1)/2*innerWidth)+'px';
      tag.style.top=((-pr.y+1)/2*innerHeight)+'px';
      const pct=m.hp/m.maxHp;
      const col=pct>0.6?'#4CAF50':pct>0.3?'#FF9800':'#f44336';
      tag.innerHTML=`${def.name} <span style="color:${col}">${m.hp}/${m.maxHp}</span>`;
    }

    // AI movement
    if(dist>1.4){
      const spd=def.speed*(m.type==='spider'?1.2:1);
      const nx=mx+dx/dist*spd*dt;
      const nz=mz+dz/dist*spd*dt;
      if(!isSolid(getB(Math.floor(nx),Math.floor(my),Math.floor(nz))))m.grp.position.x=nx;
      if(!isSolid(getB(Math.floor(nx),Math.floor(my),Math.floor(mz))))m.grp.position.x=nx;
      if(!isSolid(getB(Math.floor(mx),Math.floor(my),Math.floor(nz))))m.grp.position.z=nz;
      m.grp.rotation.y=Math.atan2(dx,dz);
      // Animate legs
      if(m.grp.children[4])m.grp.children[4].rotation.x=Math.sin(m.age*7)*0.5;
      if(m.grp.children[5])m.grp.children[5].rotation.x=-Math.sin(m.age*7)*0.5;
    }

    // Ranged attack (skeleton)
    if(m.type==='skeleton'&&dist<14&&dist>3&&m.arrowCd<=0){
      m.arrowCd=2.5;fireArrow(m.grp.position,player.pos.x,player.pos.y+0.9,player.pos.z);
    }

    // Melee attack
    if(dist3<1.8&&m.attackCd<=0&&gameMode!=='creative'){
      m.attackCd=1.2;player.hp=Math.max(0,player.hp-def.dmg);flashDmg();renderHUD();
      if(player.hp<=0)respawn();
      // Knockback
      player.vel.x=(player.pos.x-mx)/dist*5;player.vel.z=(player.pos.z-mz)/dist*5;
    }

    // Slime bounce
    if(m.type==='slime'){
      if(m.onGround&&m.bounceCd<=0&&dist<10){m.vy=6+Math.random()*3;m.bounceCd=1.5+Math.random();}
      m.bounceCd=Math.max(0,m.bounceCd-dt);
    }

    // Gravity / vertical movement
    m.vy-=20*dt;
    const ny=my+m.vy*dt;
    if(!isSolid(getB(Math.floor(mx),Math.floor(ny),Math.floor(mz)))){m.grp.position.y=ny;m.onGround=false;}
    else{if(m.vy<0)m.onGround=true;m.vy=0;}

    // Spider: stick to walls (simplified — just move toward player even vertically)
    if(m.type==='spider'&&!m.onGround&&dist<8){m.vy=Math.min(5,m.vy+4*dt);}

    // Despawn if too far
    if(dist>60){scene.remove(m.grp);mobs.splice(i,1);const t=mobTags[i];if(t)t.remove();delete mobTags[i];}
  }
}

// Player attacks mob with left click
function attackMob(){
  // Find closest mob within 4 blocks that is roughly in view
  let best=-1,bestDist=4.5;
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  for(let i=0;i<mobs.length;i++){
    const m=mobs[i];
    const dx=m.grp.position.x-player.pos.x,dy=m.grp.position.y-player.pos.y-0.8,dz=m.grp.position.z-player.pos.z;
    const d=Math.hypot(dx,dy,dz);
    const dot=(dx*fwd.x+dz*fwd.z)/Math.max(0.01,Math.hypot(dx,dz));
    if(d<bestDist&&dot>0.6){bestDist=d;best=i;}
  }
  if(best<0)return false;
  const m=mobs[best];const def=MOB_TYPES[m.type];
  m.hp-=getPlayerDmg();
  hitFlash=0.15;
  // Knockback on mob
  const dx=m.grp.position.x-player.pos.x,dz=m.grp.position.z-player.pos.z;
  const d=Math.hypot(dx,dz)||1;
  m.vx=(dx/d)*6;m.vy=3;m.vz=(dz/d)*6;
  if(m.hp<=0){
    score+=def.score;
    spawnDrop(def.drop,Math.round(m.grp.position.x),Math.round(m.grp.position.y),Math.round(m.grp.position.z));
    scene.remove(m.grp);mobs.splice(best,1);
    const tag=mobTags[best];if(tag)tag.remove();delete mobTags[best];
    showMsg(`+${def.score} pts — ${def.name} slain!  Score: ${score}`,900);
  }
  return true;
}
const player={pos:new THREE.Vector3(8,SL+20,8),vel:new THREE.Vector3(),yaw:0,pitch:0,onGround:false,H:1.75,W:0.28,speed:5.5,jumpV:8.8,hp:20,maxHp:20,wasFall:false,lastFallY:0,flying:false,flyVY:0};
const fx={spd:0,reg:0};let regAcc=0;
function applyFX(k,dur){fx[k]=dur;renderFX();}
function tickFX(dt){
  let ch=false;
  for(const k in fx){if(fx[k]>0){fx[k]=Math.max(0,fx[k]-dt);ch=true;}}
  if(fx.reg>0){regAcc+=dt;if(regAcc>3){player.hp=Math.min(player.maxHp,player.hp+1);regAcc=0;renderHUD();}}
  if(ch)renderFX();
}

let selSlot=0,tpMode=0,invOpen=false,running=false,walkT=0,wTime=0;
let lastCX=999,lastCZ=999,loopStarted=false;
const keys={};let mdx=0,mdy=0;
let lastSpaceT=0; // for double-space fly toggle in creative

// ══════════════════════════════════════════════════

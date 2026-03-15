'use strict';
//  STRUCTURE PHYSICS (proper buoyancy/gravity balance + world collision)
// ══════════════════════════════════════════════════
const structures=[];
const wind={x:0,z:0};let windAngle=0,windSpeed=1.2,windT2=0;

function updateWind(dt){
  windT2+=dt*0.1;windAngle=Math.sin(windT2)*Math.PI+Math.cos(windT2*0.7)*0.8;
  windSpeed=0.8+Math.sin(windT2*0.4)*0.6;
  wind.x=Math.sin(windAngle)*windSpeed;wind.z=Math.cos(windAngle)*windSpeed;
  document.getElementById('wind-hud').textContent=`WIND  ${windSpeed.toFixed(1)}m/s  ${cDir(windAngle)}`;
}
function cDir(a){const d=['N','NE','E','SE','S','SW','W','NW'];return d[Math.round(((a%(Math.PI*2))/(Math.PI*2))*8+8)%8];}

function findGluedGroup(sx,sy,sz){
  const group=[];const vis=new Set();
  const q=[[sx,sy,sz]];vis.add(`${sx},${sy},${sz}`);
  while(q.length){
    const[x,y,z]=q.pop();
    if(!gluedSet.has(`${x},${y},${z}`))continue;
    const b=getB(x,y,z);if(b===AIR)continue;
    group.push({x,y,z,type:b});
    for(const[dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      const nk=`${x+dx},${y+dy},${z+dz}`;
      if(!vis.has(nk)&&gluedSet.has(nk)){vis.add(nk);q.push([x+dx,y+dy,z+dz]);}
    }
  }
  return group;
}

function activateStructure(bx,by,bz){
  const group=findGluedGroup(bx,by,bz);
  if(!group.length){showMsg('No glued blocks — use Glue item first',1400);return;}
  let totalMass=0,totalBuoy=0,sails=0;
  group.forEach(b=>{const def=BD[b.type]||{};totalMass+=def.mass||1;totalBuoy+=def.buoy||0;if(def.sail)sails++;});
  // Net buoyancy: buoy*10 (water force) vs mass*9.8 (gravity)
  // We scale so buoyancy acts as counter to gravity
  const engList=group.filter(b=>b.type===ENGINE_B);
  const firstEng=engList[0];
  const engDir=firstEng?engFacing.get(`${firstEng.x},${firstEng.y},${firstEng.z}`)||{dx:0,dz:-1}:{dx:0,dz:0};

  // Compute center
  let cx=0,cy=0,cz=0;
  group.forEach(b=>{cx+=b.x+0.5;cy+=b.y+0.5;cz+=b.z+0.5;});
  cx/=group.length;cy/=group.length;cz/=group.length;

  // Remove blocks from world
  group.forEach(b=>{_noTrig=true;_applyBlock(b.x,b.y,b.z,AIR);blockChanges.set(`${b.x},${b.y},${b.z}`,AIR);gluedSet.delete(`${b.x},${b.y},${b.z}`);_noTrig=false;});
  const toR=new Set();
  group.forEach(b=>{const bcx=Math.floor(b.x/CS),bcz=Math.floor(b.z/CS);for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) toR.add(ck(bcx+dx,bcz+dz));});
  toR.forEach(k=>{if(chunks.has(k)){const[a,c]=k.split(',').map(Number);rebuildChunk(a,c);}});

  // Build mesh group
  const grp=new THREE.Group();grp.position.set(cx,cy,cz);
  group.forEach(b=>{
    const def=BD[b.type];if(!def)return;
    const mats=[getMat(def.side),getMat(def.side),getMat(def.top),getMat(def.bot||def.side),getMat(def.side),getMat(def.side)];
    const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mats);
    m.position.set(b.x+0.5-cx,b.y+0.5-cy,b.z+0.5-cz);
    grp.add(m);
  });
  scene.add(grp);

  // Compute half extents for collision
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  group.forEach(b=>{minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x+1);minY=Math.min(minY,b.y);maxY=Math.max(maxY,b.y+1);minZ=Math.min(minZ,b.z);maxZ=Math.max(maxZ,b.z+1);});
  const hx=(maxX-minX)/2,hy=(maxY-minY)/2,hz=(maxZ-minZ)/2;

  structures.push({
    grp,group,cx,cy,cz,
    vx:0,vy:0,vz:0,
    mass:totalMass,buoyTotal:totalBuoy,sails,engDir,
    fuel:0,engCount:engList.length,
    hx,hy,hz,
    age:0,
  });
  const netF=totalBuoy*10-totalMass*9.8;
  showMsg(`Structure (${group.length} blocks) — Net force: ${netF>0?'+':''}${netF.toFixed(1)}N  Sails:${sails}  Engines:${engList.length}`,2000);
  renderEngHUD();
}

// Check world collision for a structure at given position
function structWorldCollide(s,newX,newY,newZ){
  const cx=newX,cy=newY,cz=newZ;
  // Sample corners of bounding box
  for(let dx=-s.hx;dx<=s.hx;dx+=Math.max(0.5,s.hx)){
    for(let dy=-s.hy;dy<=s.hy;dy+=Math.max(0.5,s.hy)){
      for(let dz=-s.hz;dz<=s.hz;dz+=Math.max(0.5,s.hz)){
        const b=getB(Math.floor(cx+dx),Math.floor(cy+dy),Math.floor(cz+dz));
        if(isSolid(b))return true;
      }
    }
  }
  return false;
}

function updateStructures(dt){
  for(let i=structures.length-1;i>=0;i--){
    const s=structures[i];s.age+=dt;
    const cx=s.grp.position.x,cy=s.grp.position.y,cz=s.grp.position.z;

    // How many blocks are submerged (world y < SL+1)
    let subCount=0;
    s.group.forEach(b=>{const wy=s.grp.position.y+(b.y+0.5-s.cy);if(wy<SL+1)subCount++;});
    const subFrac=subCount/Math.max(1,s.group.length);

    // Buoyancy: positive buoyTotal = floats, negative = sinks
    // When submerged, apply buoy force directly. Out of water, gravity pulls it down.
    if(subFrac>0.05){
      // In water: buoy drives vertical movement, heavy drag
      s.vy+=s.buoyTotal*0.25*dt;
    } else {
      // Out of water: fall with gravity
      s.vy-=14*dt;
    }

    // Engine thrust
    if(s.fuel>0&&s.engCount>0){
      s.fuel=Math.max(0,s.fuel-dt);
      const thrust=s.engCount*3.0/s.mass;
      s.vx+=s.engDir.dx*thrust*dt;s.vz+=s.engDir.dz*thrust*dt;
    }

    // Wind/sail force (horizontal, only when floating)
    if(s.sails>0&&subFrac>0.1){
      const sf=s.sails*0.6/s.mass;
      s.vx+=wind.x*sf*dt;s.vz+=wind.z*sf*dt;
    }

    // Drag (water resistance when submerged, air resistance always)
    const drag=subFrac>0.1?0.92:0.98;
    s.vx*=Math.pow(drag,dt*60);s.vz*=Math.pow(drag,dt*60);
    s.vy*=Math.pow(subFrac>0.1?0.88:0.98,dt*60);

    // Clamp
    s.vy=Math.max(-20,Math.min(12,s.vy));
    const spd=Math.hypot(s.vx,s.vz);if(spd>8){s.vx=s.vx/spd*8;s.vz=s.vz/spd*8;}

    // Move with collision
    const nx=cx+s.vx*dt,ny=cy+s.vy*dt,nz=cz+s.vz*dt;
    if(!structWorldCollide(s,nx,cy,cz))s.grp.position.x=nx;else{s.vx*=-0.3;}
    if(!structWorldCollide(s,s.grp.position.x,ny,cz))s.grp.position.y=ny;else{if(s.vy<0){s.grp.position.y=Math.ceil(ny);s.vy=0;}else{s.vy*=-0.2;}}
    if(!structWorldCollide(s,s.grp.position.x,s.grp.position.y,nz))s.grp.position.z=nz;else{s.vz*=-0.3;}

    // Floor
    if(s.grp.position.y-s.hy<1){s.grp.position.y=1+s.hy;s.vy=Math.abs(s.vy)*0.2;}

    // Gentle rock
    if(subFrac>0.1){s.grp.rotation.z=Math.sin(s.age*0.9)*0.025;s.grp.rotation.x=Math.sin(s.age*0.65+1)*0.018;}
    else{s.grp.rotation.z*=0.95;s.grp.rotation.x*=0.95;}

    // Carry player if standing on top
    if(isRiding===i){player.pos.x+=s.vx*dt;player.pos.z+=s.vz*dt;}
  }
  renderEngHUD();
}

let isRiding=-1;
function checkRiding(){
  isRiding=-1;
  for(let i=0;i<structures.length;i++){
    const s=structures[i];
    const dx=player.pos.x-s.grp.position.x,dz=player.pos.z-s.grp.position.z;
    const dy=player.pos.y-(s.grp.position.y+s.hy);
    if(Math.abs(dx)<s.hx+0.5&&Math.abs(dz)<s.hz+0.5&&dy>-0.3&&dy<1.2){isRiding=i;break;}
  }
}

function renderEngHUD(){
  const el=document.getElementById('eng-hud');
  if(!structures.length){el.style.display='none';return;}
  el.style.display='flex';
  el.innerHTML=structures.map((s,i)=>{
    const f=s.fuel,max=60*s.engCount;
    const pct=Math.min(100,s.engCount>0?(f/Math.max(1,max)*100):0);
    const col=pct>50?'#4CAF50':pct>20?'#FF9800':'#f44336';
    const buoyStr=s.buoyTotal>1?'↑ floats':s.buoyTotal<-1?'↓ sinks':'↔ neutral';
    return `<div class="eng-row">
      <span style="color:#555">STR${i+1}</span>
      <span>${buoyStr}</span>
      ${s.engCount>0?`<span style="color:#555">ENG</span><div class="eng-bar-bg"><div class="eng-bar" style="width:${pct.toFixed(0)}%;background:${col}"></div></div><span style="color:${col}">${Math.ceil(f)}s</span>`:'<span style="color:#333">no engine</span>'}
    </div>`;
  }).join('');
}

// Add block to existing structure (right-click on structure with block)
const structRaycaster=new THREE.Raycaster();
function raycastStructure(){
  structRaycaster.setFromCamera({x:0,y:0},camera);
  let best=null,bd=Infinity;
  for(let si=0;si<structures.length;si++){
    const s=structures[si];
    const hits=structRaycaster.intersectObjects(s.grp.children,false);
    if(hits.length&&hits[0].distance<bd&&hits[0].distance<8){
      bd=hits[0].distance;
      const hit=hits[0];
      const normal=hit.face.normal.clone().transformDirection(s.grp.matrixWorld).round();
      const bWorld=hit.object.position.clone().applyMatrix4(s.grp.matrixWorld).round();
      const adjWorld=bWorld.clone().add(normal);
      const adjLocal=adjWorld.clone().sub(s.grp.position);
      best={si,adjLocal,adjWorld,bWorld};
    }
  }
  return best;
}

// ══════════════════════════════════════════════════

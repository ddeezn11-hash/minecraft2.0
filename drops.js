'use strict';
//  ITEM DROPS
// ══════════════════════════════════════════════════
const drops=[];
const dropGeo=new THREE.BoxGeometry(0.28,0.28,0.28);
const dMC={};
function dMat(c){if(!dMC[c])dMC[c]=new THREE.MeshLambertMaterial({color:c});return dMC[c];}
function spawnDrop(type,bx,by,bz,vx,vy,vz){
  const def=BD[type];if(!def)return;
  const ms=[dMat(def.side),dMat(def.side),dMat(def.top),dMat(def.bot||def.side),dMat(def.side),dMat(def.side)];
  const mesh=new THREE.Mesh(dropGeo,ms);
  mesh.position.set(bx+0.5+(Math.random()-0.5)*0.3,by+0.65,bz+0.5+(Math.random()-0.5)*0.3);
  scene.add(mesh);
  drops.push({mesh,type,vx:vx??((Math.random()-0.5)*2.5),vy:vy??(2.5+Math.random()*2),vz:vz??((Math.random()-0.5)*2.5),ground:false,base:0,age:0});
}
function updateDrops(dt){
  const px=player.pos.x,py=player.pos.y+0.7,pz=player.pos.z;
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];d.age+=dt;
    if(d.age>90){scene.remove(d.mesh);drops.splice(i,1);continue;}
    const dx=d.mesh.position.x-px,dy=d.mesh.position.y-py,dz=d.mesh.position.z-pz;
    if(Math.hypot(dx,dy,dz)<1.6){
      invAdd(d.type);scene.remove(d.mesh);drops.splice(i,1);
      renderHotbar();showMsg('+1 '+(BD[d.type]?.name||'?'),500);continue;
    }
    d.mesh.rotation.y+=dt*3;d.mesh.rotation.x+=dt*1.1;
    if(!d.ground){
      const inW=getB(Math.floor(d.mesh.position.x),Math.floor(d.mesh.position.y),Math.floor(d.mesh.position.z))===WATER;
      d.vy+=(inW?(d.vy<0.3?1.5:-1.5):-18)*dt;
      d.vx*=Math.pow(inW?0.93:0.82,dt*60);d.vz*=Math.pow(inW?0.93:0.82,dt*60);
      if(inW){d.vx+=wind.x*0.25*dt;d.vz+=wind.z*0.25*dt;}
      const nx=d.mesh.position.x+d.vx*dt,ny=d.mesh.position.y+d.vy*dt,nz=d.mesh.position.z+d.vz*dt;
      if(isSolid(getB(Math.floor(nx),Math.floor(ny-0.15),Math.floor(nz)))&&d.vy<0){
        d.ground=true;d.base=Math.floor(ny-0.15)+1.22;d.mesh.position.set(nx,d.base,nz);d.vx=0;d.vy=0;d.vz=0;
      }else d.mesh.position.set(nx,ny,nz);
    }else{
      if(!isSolid(getB(Math.floor(d.mesh.position.x),Math.floor(d.base-0.3),Math.floor(d.mesh.position.z)))){d.ground=false;d.vy=0;}
      else d.mesh.position.y=d.base+Math.sin(d.age*2.2+i)*0.1;
    }
  }
}

// ══════════════════════════════════════════════════

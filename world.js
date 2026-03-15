'use strict';
//  WORLD DATA
// ══════════════════════════════════════════════════
const chunks=new Map(),meshMap=new Map();
const gluedSet=new Set();
const engFacing=new Map(); // "x,y,z" -> {dx,dz}
function ck(cx,cz){return cx+','+cz;}

function getB(x,y,z){
  if(y<0)return STONE;if(y>=WH)return AIR;
  const cx=Math.floor(x/CS),cz=Math.floor(z/CS);
  const c=chunks.get(ck(cx,cz));if(!c)return AIR;
  const lx=((x%CS)+CS)%CS,lz=((z%CS)+CS)%CS;
  return c[lx*WH*CS+y*CS+lz];
}

// Apply without side effects (used during save replay)
function _applyBlock(x,y,z,t){
  if(y<0||y>=WH)return;
  const cx=Math.floor(x/CS),cz=Math.floor(z/CS);
  const c=chunks.get(ck(cx,cz));if(!c)return;
  const lx=((x%CS)+CS)%CS,lz=((z%CS)+CS)%CS;
  c[lx*WH*CS+y*CS+lz]=t;
}

let _noTrig=false;
function setB(x,y,z,t){
  if(y<0||y>=WH)return;
  _applyBlock(x,y,z,t);
  // Record change vs generated terrain
  blockChanges.set(`${x},${y},${z}`,t);
  const cx=Math.floor(x/CS),cz=Math.floor(z/CS);
  const lx=((x%CS)+CS)%CS,lz=((z%CS)+CS)%CS;
  const R=new Set([ck(cx,cz)]);
  if(lx===0)R.add(ck(cx-1,cz));if(lx===CS-1)R.add(ck(cx+1,cz));
  if(lz===0)R.add(ck(cx,cz-1));if(lz===CS-1)R.add(ck(cx,cz+1));
  R.forEach(k=>{const[a,b]=k.split(',').map(Number);rebuildChunk(a,b);});
  if(!_noTrig){
    if(t===AIR){
      // Physics blocks above may fall
      for(let d=1;d<=4;d++)physQ.add(`${x},${y+d},${z}`);
      // Any adjacent water should now flow into this gap
      for(const[dx,dy,dz] of [[0,1,0],[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,-1,0]]){
        if(getB(x+dx,y+dy,z+dz)===WATER) waterQ.add(`${x+dx},${y+dy},${z+dz}`);
      }
    }
    if(PHYS_SET.has(t))physQ.add(`${x},${y},${z}`);
    // Newly placed water block should flow immediately
    if(t===WATER) waterQ.add(`${x},${y},${z}`);
  }
  if(t===AIR)gluedSet.delete(`${x},${y},${z}`);
}

let _worldSeed=1;
// Seeded noise: every world unique
function sfbm(x,z){
  const ox=_worldSeed*0.00137,oz=_worldSeed*0.00089;
  let v=0,amp=1,max=0,f=0.007;
  for(let i=0;i<6;i++){v+=sn((x+ox)*f+i*37,(z+oz)*f+i*53)*amp;max+=amp;amp*=0.52;f*=2.1;}
  return v/max;
}
function biomeN(x,z){const ox=_worldSeed*0.002+5000,oz=_worldSeed*0.0017+3000;return sn(x*0.003+ox,z*0.003+oz);}
function tempN(x,z){const ox=_worldSeed*0.0025+9000,oz=_worldSeed*0.002+7000;return sn(x*0.004+ox,z*0.004+oz);}
const B_PLAINS=0,B_FOREST=1,B_DESERT=2,B_SNOWY=3,B_OCEAN=4,B_MOUNTAINS=5,B_SWAMP=6,B_MESA=7;
function getBiome(wx,wz){
  const h=sfbm(wx,wz),b=biomeN(wx,wz),t=tempN(wx,wz);
  if(h<-0.3)return B_OCEAN;
  if(h>0.55)return B_MOUNTAINS;
  if(t>0.5)return h<0.1?B_DESERT:B_MESA;
  if(t<-0.4)return B_SNOWY;
  if(b>0.3)return B_FOREST;
  if(b<-0.3)return B_SWAMP;
  return B_PLAINS;
}

function rng(cx,cz,a,b){let s=(cx*1009+cz+_worldSeed*7)*7919+a*17+b*31;s=(s^(s>>>16))*0x45d9f3b;s=(s^(s>>>16))*0x45d9f3b;return((s^(s>>>16))>>>0)/0xffffffff;}
function genChunk(cx,cz){
  const data=new Uint8Array(CS*WH*CS);
  const trees=[];const cacti=[];
  for(let lx=0;lx<CS;lx++) for(let lz=0;lz<CS;lz++){
    const wx=cx*CS+lx,wz=cz*CS+lz;
    const h=sfbm(wx,wz);
    const biome=getBiome(wx,wz);
    let hScale=22,hBase=SL;
    if(biome===B_MOUNTAINS){hScale=38;hBase=SL+5;}
    else if(biome===B_OCEAN){hScale=10;hBase=SL-8;}
    else if(biome===B_SWAMP){hScale=6;hBase=SL-1;}
    else if(biome===B_DESERT||biome===B_MESA){hScale=16;hBase=SL+2;}
    const H=Math.max(2,Math.min(WH-3,Math.round(hBase+h*hScale)));
    const under=H<=SL;
    for(let y=0;y<=H;y++){
      let b;
      if(y===0)b=STONE;
      else if(y<H-4)b=STONE;
      else if(y<H){b=(biome===B_DESERT||biome===B_MESA)?SAND:DIRT;}
      else {
        if(biome===B_SNOWY)b=H>SL+6?SNOW:H<=SL+1?GRAVEL:GRASS;
        else if(biome===B_DESERT)b=SAND;
        else if(biome===B_MESA)b=RED_SAND;
        else if(biome===B_OCEAN)b=under?(H<SL-4?GRAVEL:SAND):SAND;
        else if(biome===B_SWAMP)b=H<=SL+1?CLAY:MOSS;
        else if(biome===B_MOUNTAINS)b=H>SL+20?SNOW:H>SL+10?STONE:GRASS;
        else b=H<=SL+1?SAND:GRASS;
      }
      if(b===STONE){
        if(y<10&&rng(cx,cz,lx+y*3,lz+7)<0.028)b=COAL_B;
        else if(y<22&&rng(cx,cz,lx+y*5,lz+13)<0.018)b=IRON;
        else if(y<14&&rng(cx,cz,lx+y*7,lz+19)<0.009)b=GOLD;
        else if(rng(cx,cz,lx+y*2,lz+3)<0.006)b=COBBLE;
      }
      data[lx*WH*CS+y*CS+lz]=b;
    }
    for(let y=H+1;y<=SL;y++)data[lx*WH*CS+y*CS+lz]=WATER;
    const canTree=H>SL+3&&H<SL+20&&!under;
    if(biome===B_FOREST&&canTree&&rng(cx,cz,lx+100,lz+200)<0.055)trees.push({lx,lz,H,spruce:false});
    else if((biome===B_PLAINS||biome===B_SWAMP)&&canTree&&rng(cx,cz,lx+100,lz+200)<0.018)trees.push({lx,lz,H,spruce:false});
    else if(biome===B_SNOWY&&canTree&&rng(cx,cz,lx+100,lz+200)<0.016)trees.push({lx,lz,H,spruce:true});
    if((biome===B_DESERT||biome===B_MESA)&&H>SL+1&&!under&&rng(cx,cz,lx+300,lz+400)<0.015)cacti.push({lx,lz,H});
  }
  for(const t of trees){
    const th=t.spruce?(5+Math.floor(rng(cx,cz,t.lx,t.lz+50)*3)):(4+Math.floor(rng(cx,cz,t.lx,t.lz+50)*2));
    for(let i=1;i<=th;i++){const y=t.H+i;if(y<WH)data[t.lx*WH*CS+y*CS+t.lz]=WOOD;}
    const top=t.H+th;const lr=t.spruce?1:2;
    for(let dx=-lr;dx<=lr;dx++) for(let dz=-lr;dz<=lr;dz++) for(let dy=-1;dy<=(t.spruce?3:2);dy++){
      const nx=t.lx+dx,nz=t.lz+dz,ny=top+dy;
      if(nx<0||nx>=CS||nz<0||nz>=CS||ny<0||ny>=WH)continue;
      if(Math.abs(dx)+Math.abs(dz)+(dy<0?-dy:dy)>(t.spruce?2:3))continue;
      if(data[nx*WH*CS+ny*CS+nz]===AIR)data[nx*WH*CS+ny*CS+nz]=LEAVES;
    }
  }
  for(const c of cacti){
    const ch=1+Math.floor(rng(cx,cz,c.lx,c.lz)*3);
    for(let i=1;i<=ch;i++){const y=c.H+i;if(y<WH)data[c.lx*WH*CS+y*CS+c.lz]=CACTUS;}
  }
  return data;
}

// ══════════════════════════════════════════════════
//  THREE.JS
// ══════════════════════════════════════════════════
const renderer=new THREE.WebGLRenderer({antialias:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(0x90CAF9);
renderer.domElement.style.display='none';
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x90CAF9,40,120);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.05,200);
const scene2=scene; // alias for clarity
const sun=new THREE.DirectionalLight(0xFFF9C4,0.85);sun.position.set(80,120,60);scene.add(sun);
const ambient=new THREE.AmbientLight(0xffffff,0.6);scene.add(ambient);
// Stars (visible at night)
const starsGeo=new THREE.BufferGeometry();
const starPos=new Float32Array(3000);
for(let i=0;i<3000;i+=3){const th=Math.random()*Math.PI*2,ph=Math.random()*Math.PI;starPos[i]=Math.sin(ph)*Math.cos(th)*180;starPos[i+1]=Math.cos(ph)*180;starPos[i+2]=Math.sin(ph)*Math.sin(th)*180;}
starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));
const starsMesh=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xffffff,size:0.4,transparent:true,opacity:0}));
scene.add(starsMesh);

const matC={};
function getMat(col,opt={}){
  const k=col+(opt.w?'W':'')+(opt.d?'D':'');
  if(!matC[k])matC[k]=new THREE.MeshLambertMaterial({
    color:col,transparent:!!(opt.w||opt.d),opacity:opt.w?0.72:opt.d?0.7:1,
    depthWrite:!opt.w,side:opt.d?THREE.DoubleSide:THREE.FrontSide
  });return matC[k];
}
const waterMats=new Set();
const FACES=[
  {d:[0,1,0],c:[[0,1,0],[1,1,0],[0,1,1],[1,1,1]],t:'top'},
  {d:[0,-1,0],c:[[1,0,1],[0,0,1],[1,0,0],[0,0,0]],t:'bot'},
  {d:[0,0,1],c:[[1,0,1],[0,0,1],[1,1,1],[0,1,1]],t:'side'},
  {d:[0,0,-1],c:[[0,0,0],[1,0,0],[0,1,0],[1,1,0]],t:'side'},
  {d:[1,0,0],c:[[1,0,0],[1,0,1],[1,1,0],[1,1,1]],t:'side'},
  {d:[-1,0,0],c:[[0,0,1],[0,0,0],[0,1,1],[0,1,0]],t:'side'},
];
function rebuildChunk(cx,cz){
  const k=ck(cx,cz);const chunk=chunks.get(k);if(!chunk)return;
  const old=meshMap.get(k);if(old){old.forEach(m=>{scene.remove(m);m.geometry.dispose();});}
  const G={};
  function af(wx,y,wz,f,b,yo=0){
    const def=BD[b];if(!def)return;
    const iW=(b===WATER),iL=(b===LEAVES||b===GLASS||b===ICE||b===LEAF_PILE);
    const faceKey=f.t==='top'?'top':f.t==='bot'?'bot':'side';
    const mat=getBlockMat(b,faceKey,{w:iW,d:iL});
    const gk=`${b}_${faceKey}`;
    if(!G[gk])G[gk]={pos:[],nor:[],idx:[],mat,w:iW,d:iL};
    const g=G[gk];const vi=g.pos.length/3;
    for(const c of f.c){g.pos.push(wx+c[0],y+c[1]+yo,wz+c[2]);g.nor.push(f.d[0],f.d[1],f.d[2]);}
    g.idx.push(vi,vi+2,vi+1,vi+1,vi+2,vi+3);
  }
  for(let lx=0;lx<CS;lx++) for(let y=0;y<WH;y++) for(let lz=0;lz<CS;lz++){
    const b=chunk[lx*WH*CS+y*CS+lz];if(b===AIR)continue;
    const wx=cx*CS+lx,wz=cz*CS+lz;
    const TRANSPARENT_SET=new Set([LEAVES,GLASS,ICE,LEAF_PILE]);
    for(const f of FACES){
      const nb=getB(wx+f.d[0],y+f.d[1],wz+f.d[2]);
      const nbTransparent=nb===AIR||nb===WATER||TRANSPARENT_SET.has(nb);
      if(b===WATER){
        if(f.t==='top'&&nb===AIR)af(wx,y,wz,f,b,-0.08);
        else if(f.t!=='top'&&f.t!=='bot'&&nb===AIR)af(wx,y,wz,f,b,-0.08);
      } else if(TRANSPARENT_SET.has(b)){
        // Double-sided transparent: render all faces visible from any direction
        af(wx,y,wz,f,b,0);
      } else {
        if(nbTransparent)af(wx,y,wz,f,b,0);
      }
    }
  }
  const ms=[];
  for(const gk in G){
    const g=G[gk];
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(g.pos,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.nor,3));
    geo.setIndex(g.idx);geo.computeBoundingSphere();
    const mat=g.mat||getMat(0x888888,{w:g.w,d:g.d});
    if(g.w)waterMats.add(mat);
    ms.push(new THREE.Mesh(geo,mat));scene.add(ms[ms.length-1]);
  }
  meshMap.set(k,ms);
}

// Block outline + glue highlight
const hlMesh=new THREE.Mesh(new THREE.BoxGeometry(1.006,1.006,1.006),new THREE.MeshBasicMaterial({color:0,wireframe:true,transparent:true,opacity:0.4}));
hlMesh.visible=false;scene.add(hlMesh);
const glueHL=new THREE.Mesh(new THREE.BoxGeometry(1.02,1.02,1.02),new THREE.MeshBasicMaterial({color:0xFFEB3B,wireframe:true,transparent:true,opacity:0.65}));
glueHL.visible=false;scene.add(glueHL);

// ══════════════════════════════════════════════════

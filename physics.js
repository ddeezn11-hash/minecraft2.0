'use strict';
//  PHYSICS BLOCKS & WATER FLOW
// ══════════════════════════════════════════════════
const physQ=new Set();let physT=0;
function processPhys(){
  const todo=[...physQ].slice(0,80);physQ.clear();
  for(const key of todo){
    const[x,y,z]=key.split(',').map(Number);
    const b=getB(x,y,z);if(!PHYS_SET.has(b))continue;
    const bel=getB(x,y-1,z);
    if((bel===AIR||bel===WATER)&&y>0){
      _noTrig=true;_applyBlock(x,y,z,AIR);blockChanges.set(`${x},${y},${z}`,AIR);
      _applyBlock(x,y-1,z,b);blockChanges.set(`${x},${y-1},${z}`,b);
      const R=new Set();
      for(const[bx,by,bz2] of [[x,y,z],[x,y-1,z]]){const cxb=Math.floor(bx/CS),czb=Math.floor(bz2/CS);for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) R.add(ck(cxb+dx,czb+dz));}
      R.forEach(k=>{if(chunks.has(k)){const[a,c]=k.split(',').map(Number);rebuildChunk(a,c);}});
      _noTrig=false;physQ.add(`${x},${y-2},${z}`);physQ.add(`${x},${y+1},${z}`);
    }
  }
}
const waterQ=new Set();let waterT=0;
function processWater(){
  const todo=[...waterQ].slice(0,120);waterQ.clear();
  for(const key of todo){
    const[x,y,z]=key.split(',').map(Number);
    if(getB(x,y,z)!==WATER)continue;
    // Fall straight down first
    if(y>0&&getB(x,y-1,z)===AIR){
      _noTrig=true;_applyBlock(x,y-1,z,WATER);blockChanges.set(`${x},${y-1},${z}`,WATER);_noTrig=false;
      rebuildLocal(x,y-1,z);
      waterQ.add(`${x},${y-1},${z}`); // keep falling
      waterQ.add(`${x},${y},${z}`);   // source still spreads sideways
      continue;
    }
    // Spread sideways into all air neighbours at same level
    for(const[dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz;
      if(getB(nx,y,nz)===AIR){
        _noTrig=true;_applyBlock(nx,y,nz,WATER);blockChanges.set(`${nx},${y},${nz}`,WATER);_noTrig=false;
        rebuildLocal(nx,y,nz);
        waterQ.add(`${nx},${y},${nz}`); // new block also flows
      }
    }
  }
}
// Rebuild all chunks touching a block position
function rebuildLocal(x,y,z){
  const cx=Math.floor(x/CS),cz=Math.floor(z/CS);
  const lx=((x%CS)+CS)%CS,lz=((z%CS)+CS)%CS;
  const R=new Set([ck(cx,cz)]);
  if(lx===0)R.add(ck(cx-1,cz));if(lx===CS-1)R.add(ck(cx+1,cz));
  if(lz===0)R.add(ck(cx,cz-1));if(lz===CS-1)R.add(ck(cx,cz+1));
  R.forEach(k=>{if(chunks.has(k)){const[a,b]=k.split(',').map(Number);rebuildChunk(a,b);}});
}

// ══════════════════════════════════════════════════

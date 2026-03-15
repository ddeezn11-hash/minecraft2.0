'use strict';
//  BLOCK REGISTRY
// ══════════════════════════════════════════════════
const AIR=0,GRASS=1,DIRT=2,STONE=3,SAND=4,WOOD=5,LEAVES=6,SNOW=7,WATER=8,GRAVEL=9,CLAY=10,
      ENGINE_B=11,PSPD=12,PREG=13,BUILD_I=50,GLUE_I=51,GLASS=14,IRON=15,GOLD=16,
      STICK=17,ROCK=18,LEAF_PILE=19,CACTUS=20,RED_SAND=21,ICE=22,MOSS=23,
      PLANK=24,TORCH=25,COAL_B=26,COBBLE=27,CHEST=28,SWORD=29,AXE=30,FURNACE=31;

// Procedural pixel-art texture generator
const texCache={};
function mkTex(drawFn,size=16){
  const key=drawFn.toString().slice(0,40);
  if(texCache[key])return texCache[key];
  const c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d');drawFn(ctx,size);
  const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;
  texCache[key]=t;return t;
}
function noiseVal(x,y,s=1){return(Math.sin(x*127.1*s+y*311.7*s)*43758.5453)%1;}
function pxNoise(ctx,size,r,g,b,variance=20){
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=Math.floor(noiseVal(x,y)*variance-variance/2);
    ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`;ctx.fillRect(x,y,1,1);
  }
}

// Texture draw functions
const TX={
  grass_top:(ctx,s)=>{pxNoise(ctx,s,76,175,80,30);for(let i=0;i<8;i++){ctx.fillStyle=`hsl(${110+Math.random()*20},60%,${30+Math.random()*20}%)`;ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),1+Math.floor(Math.random()*2),1);}},
  dirt:(ctx,s)=>{pxNoise(ctx,s,101,67,33,25);for(let i=0;i<6;i++){ctx.fillStyle='#4a3520';ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),2,1);}},
  grass_side:(ctx,s)=>{pxNoise(ctx,s,101,67,33,20);for(let x=0;x<s;x++){const gH=2+Math.floor(noiseVal(x,0)*3);ctx.fillStyle=`hsl(${115},55%,${28+Math.floor(noiseVal(x,99)*10)}%)`;ctx.fillRect(x,0,1,gH);}},
  stone:(ctx,s)=>{pxNoise(ctx,s,118,118,118,28);for(let i=0;i<4;i++){ctx.strokeStyle='#888';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(Math.random()*s,Math.random()*s);ctx.lineTo(Math.random()*s,Math.random()*s);ctx.stroke();}},
  cobble:(ctx,s)=>{pxNoise(ctx,s,105,105,105,30);const grid=4;for(let gy=0;gy<s;gy+=grid)for(let gx=0;gx<s;gx+=grid){ctx.strokeStyle='#555';ctx.strokeRect(gx+.5,gy+.5,grid-1,grid-1);}},
  sand:(ctx,s)=>{pxNoise(ctx,s,210,190,122,18);},
  red_sand:(ctx,s)=>{pxNoise(ctx,s,190,120,60,22);},
  wood_top:(ctx,s)=>{pxNoise(ctx,s,160,113,42,15);ctx.strokeStyle='#8b6014';for(let r=1;r<s/2;r+=3){ctx.beginPath();ctx.arc(s/2,s/2,r,0,Math.PI*2);ctx.stroke();}},
  wood_side:(ctx,s)=>{for(let x=0;x<s;x++){const c=120+Math.floor(noiseVal(x,0)*30);ctx.fillStyle=`rgb(${c},${Math.floor(c*0.7)},${Math.floor(c*0.26)})`;ctx.fillRect(x,0,1,s);}for(let y=0;y<s;y+=5){ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,y,s,1);}},
  leaves:(ctx,s)=>{ctx.fillStyle='#2d6e2d';ctx.fillRect(0,0,s,s);for(let i=0;i<s*s*0.6;i++){ctx.fillStyle=`hsl(${110+Math.random()*20},${50+Math.random()*20}%,${22+Math.random()*18}%)`;ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),1+Math.floor(Math.random()*2),1+Math.floor(Math.random()*2));}},
  snow:(ctx,s)=>{pxNoise(ctx,s,236,239,241,8);for(let i=0;i<10;i++){ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),2,1);}},
  ice:(ctx,s)=>{pxNoise(ctx,s,160,200,240,12);ctx.strokeStyle='rgba(200,230,255,0.5)';for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(Math.random()*s,Math.random()*s);ctx.lineTo(Math.random()*s,Math.random()*s);ctx.stroke();}},
  water:(ctx,s)=>{pxNoise(ctx,s,21,101,192,20);},
  gravel:(ctx,s)=>{pxNoise(ctx,s,130,130,130,35);for(let i=0;i<12;i++){const r=1+Math.floor(Math.random()*2);ctx.fillStyle='#888';ctx.beginPath();ctx.arc(Math.random()*s,Math.random()*s,r,0,Math.PI*2);ctx.fill();}},
  clay:(ctx,s)=>{pxNoise(ctx,s,210,140,140,15);},
  glass:(ctx,s)=>{ctx.fillStyle='rgba(180,230,255,0.3)';ctx.fillRect(0,0,s,s);ctx.strokeStyle='rgba(200,240,255,0.7)';ctx.strokeRect(0.5,0.5,s-1,s-1);ctx.beginPath();ctx.moveTo(2,2);ctx.lineTo(s-2,s-2);ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.stroke();},
  iron:(ctx,s)=>{pxNoise(ctx,s,180,180,180,18);for(let i=0;i<4;i++){ctx.fillStyle='#aaa';ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),3,2);}},
  gold:(ctx,s)=>{pxNoise(ctx,s,255,213,79,18);for(let i=0;i<3;i++){ctx.fillStyle='#ffcc00';ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),2,2);}},
  moss:(ctx,s)=>{pxNoise(ctx,s,60,110,60,25);for(let i=0;i<10;i++){ctx.fillStyle=`hsl(130,40%,${20+Math.random()*15}%)`;ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),2,2);}},
  cactus:(ctx,s)=>{ctx.fillStyle='#5d8a2a';ctx.fillRect(0,0,s,s);ctx.fillStyle='#4a7020';for(let y=0;y<s;y+=4)ctx.fillRect(0,y,s,2);ctx.fillStyle='#6a9a30';for(let x=0;x<s;x+=3)ctx.fillRect(x,0,1,s);},
  stick:(ctx,s)=>{ctx.fillStyle='#a07830';ctx.fillRect(s/2-1,0,2,s);ctx.fillStyle='#c89850';for(let y=0;y<s;y+=2)ctx.fillRect(s/2-1,y,2,1);},
  rock:(ctx,s)=>{pxNoise(ctx,s,100,100,110,22);ctx.fillStyle='rgba(150,150,170,0.4)';ctx.beginPath();ctx.arc(s*0.3,s*0.35,s*0.3,0,Math.PI*2);ctx.fill();},
  plank:(ctx,s)=>{pxNoise(ctx,s,185,145,80,15);for(let y=0;y<s;y+=s/2){ctx.strokeStyle='rgba(80,50,20,0.4)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}ctx.strokeStyle='rgba(80,50,20,0.2)';for(let x=0;x<s;x+=4)ctx.strokeRect(x,0,4,s);},
  coal:(ctx,s)=>{pxNoise(ctx,s,55,55,55,20);for(let i=0;i<5;i++){ctx.fillStyle='#111';ctx.fillRect(Math.floor(Math.random()*s),Math.floor(Math.random()*s),3,2);}},
  engine:(ctx,s)=>{pxNoise(ctx,s,60,40,20,10);ctx.fillStyle='#e65100';ctx.fillRect(3,3,s-6,s-6);ctx.fillStyle='#ff8f00';ctx.fillRect(s/2-2,s/2-2,4,4);},
  leaf_pile:(ctx,s)=>{pxNoise(ctx,s,50,90,50,20);for(let i=0;i<15;i++){ctx.fillStyle=`hsl(${100+Math.random()*30},55%,${20+Math.random()*20}%)`;const lx=Math.floor(Math.random()*s),ly=Math.floor(Math.random()*s);ctx.fillRect(lx,ly,2+Math.floor(Math.random()*3),1);}},
  chest_top:(ctx,s)=>{pxNoise(ctx,s,160,113,42,12);ctx.strokeStyle='#5a3800';ctx.strokeRect(2,2,s-4,s-4);ctx.fillStyle='#8B6010';ctx.fillRect(s/2-3,s/2-3,6,6);},
  chest_side:(ctx,s)=>{pxNoise(ctx,s,145,100,38,12);ctx.strokeStyle='#5a3800';ctx.strokeRect(1,1,s-2,s-2);ctx.fillStyle='#2a1a00';ctx.fillRect(2,s/2-3,s-4,6);ctx.fillStyle='#c0922a';ctx.fillRect(s/2-2,s/2-2,4,4);},
  sword:(ctx,s)=>{ctx.fillStyle='#555';ctx.fillRect(s/2-1,0,2,s*0.7);ctx.fillStyle='#888';ctx.fillRect(s/2-1,1,2,s*0.65);ctx.fillStyle='#8B6010';ctx.fillRect(s/2-4,s*0.65,8,s*0.12);ctx.fillStyle='#A1722A';ctx.fillRect(s/2-2,s*0.77,4,s*0.23);},
  axe:(ctx,s)=>{ctx.fillStyle='#8B6010';ctx.fillRect(s/2-1,s*0.3,2,s*0.7);ctx.fillStyle='#888';ctx.fillRect(s/2-5,0,9,s*0.45);ctx.fillStyle='#aaa';ctx.fillRect(s/2-4,1,8,s*0.4);ctx.fillStyle='#555';ctx.fillRect(s/2-5,s*0.3,9,2);},
  furnace_front:(ctx,s)=>{pxNoise(ctx,s,80,80,80,15);ctx.fillStyle='#FF6D00';ctx.fillRect(3,s*0.5,s-6,s*0.4);ctx.fillStyle='#FF9100';for(let i=0;i<6;i++)ctx.fillRect(3+Math.random()*(s-8),s*0.5+Math.random()*s*0.35,2,2);ctx.strokeStyle='#333';ctx.strokeRect(2,s*0.48,s-4,s*0.44);},
};

function mkBlockMat(txKey,opt={}){
  const fn=TX[txKey];
  if(!fn)return new THREE.MeshLambertMaterial({color:0x888888,...opt});
  const tex=mkTex(fn);
  return new THREE.MeshLambertMaterial({map:tex,...opt,transparent:opt.transparent||false});
}
// Pre-built material getter with texture support
const blockMats={};
function getBlockMat(blockType,face,opt={}){
  const def=BD[blockType];if(!def)return getMat(0x888888,opt);
  const key=`${blockType}_${face}`;
  if(!blockMats[key]){
    const txMap={
      [GRASS]:{top:'grass_top',side:'grass_side',bot:'dirt'},
      [DIRT]:{top:'dirt',side:'dirt',bot:'dirt'},
      [STONE]:{top:'stone',side:'stone',bot:'stone'},
      [COBBLE]:{top:'cobble',side:'cobble',bot:'cobble'},
      [SAND]:{top:'sand',side:'sand',bot:'sand'},
      [RED_SAND]:{top:'red_sand',side:'red_sand',bot:'red_sand'},
      [WOOD]:{top:'wood_top',side:'wood_side',bot:'wood_top'},
      [PLANK]:{top:'plank',side:'plank',bot:'plank'},
      [LEAVES]:{top:'leaves',side:'leaves',bot:'leaves'},
      [SNOW]:{top:'snow',side:'snow',bot:'snow'},
      [ICE]:{top:'ice',side:'ice',bot:'ice'},
      [GRAVEL]:{top:'gravel',side:'gravel',bot:'gravel'},
      [CLAY]:{top:'clay',side:'clay',bot:'clay'},
      [GLASS]:{top:'glass',side:'glass',bot:'glass'},
      [IRON]:{top:'iron',side:'iron',bot:'iron'},
      [GOLD]:{top:'gold',side:'gold',bot:'gold'},
      [MOSS]:{top:'moss',side:'moss',bot:'moss'},
      [CACTUS]:{top:'cactus',side:'cactus',bot:'cactus'},
      [COAL_B]:{top:'coal',side:'coal',bot:'coal'},
      [ENGINE_B]:{top:'engine',side:'engine',bot:'engine'},
      [CHEST]:   {top:'chest_top',side:'chest_side',bot:'chest_top'},
      [SWORD]:   {top:'sword',side:'sword',bot:'sword'},
      [AXE]:     {top:'axe',side:'axe',bot:'axe'},
      [FURNACE]: {top:'stone',side:'furnace_front',bot:'stone'},
      [LEAF_PILE]:{top:'leaf_pile',side:'leaf_pile',bot:'leaf_pile'},
    };
    const txDef=txMap[blockType];
    const txKey=txDef?txDef[face]||txDef.side:null;
    const isWater=blockType===WATER,isLeaves=blockType===LEAVES||blockType===GLASS;
    if(txKey){
      const tex=mkTex(TX[txKey]);
      blockMats[key]=new THREE.MeshLambertMaterial({map:tex,transparent:isWater||isLeaves,opacity:isWater?0.72:isLeaves?0.85:1,depthWrite:!isWater,side:isLeaves?THREE.DoubleSide:THREE.FrontSide});
    } else {
      blockMats[key]=getMat(face==='top'?def.top:face==='bot'?def.bot:def.side,opt);
    }
  }
  return blockMats[key];
}

// mass: kg-equivalent per block (affects gravity on structure)
// buoy: positive = floats, negative = sinks, in N/block when submerged
const BD={
  [GRASS]: {name:'Grass',  top:0x4CAF50,side:0x6D4C41,bot:0x6D4C41, mass:2, buoy:1.5},
  [DIRT]:  {name:'Dirt',   top:0x6D4C41,side:0x6D4C41,bot:0x6D4C41, mass:2, buoy:0.5},
  [STONE]: {name:'Stone',  top:0x757575,side:0x757575,bot:0x757575, mass:5, buoy:-3.0},
  [COBBLE]:{name:'Cobblestone',top:0x7a7a7a,side:0x7a7a7a,bot:0x7a7a7a,mass:4,buoy:-2.5},
  [SAND]:  {name:'Sand',   top:0xD4C07A,side:0xD4C07A,bot:0xD4C07A, mass:3, buoy:-1.2, phys:true},
  [RED_SAND]:{name:'Red Sand',top:0xC1610A,side:0xC1610A,bot:0xC1610A,mass:3,buoy:-1.2,phys:true},
  [WOOD]:  {name:'Wood',   top:0xA0712A,side:0x6D4C1A,bot:0xA0712A, mass:1, buoy:3.5},
  [PLANK]: {name:'Planks', top:0xDEB887,side:0xDEB887,bot:0xDEB887, mass:1, buoy:3.0},
  [LEAVES]:{name:'Leaves', top:0x388E3C,side:0x388E3C,bot:0x388E3C, mass:0.2,buoy:4.0, sail:true},
  [LEAF_PILE]:{name:'Leaf Pile',top:0x2e7d32,side:0x2e7d32,bot:0x2e7d32,mass:0.1,buoy:4.5,flat:true},
  [SNOW]:  {name:'Snow',   top:0xECEFF1,side:0xCFD8DC,bot:0xCFD8DC, mass:0.5,buoy:2.0},
  [ICE]:   {name:'Ice',    top:0xB3E5FC,side:0xB3E5FC,bot:0xB3E5FC, mass:2, buoy:0.8, transparent:true},
  [WATER]: {name:'Water',  top:0x1565C0,side:0x1565C0,bot:0x1565C0, mass:0, buoy:0, water:true, noPlace:true},
  [GRAVEL]:{name:'Gravel', top:0x9E9E9E,side:0x9E9E9E,bot:0x9E9E9E, mass:3, buoy:-1.5, phys:true},
  [CLAY]:  {name:'Clay',   top:0xEF9A9A,side:0xC62828,bot:0xEF9A9A, mass:2, buoy:-0.8, phys:true},
  [GLASS]: {name:'Glass',  top:0xB3E5FC,side:0xB3E5FC,bot:0xB3E5FC, mass:1, buoy:0.5, transparent:true},
  [IRON]:  {name:'Iron Ore',top:0xBDBDBD,side:0x9E9E9E,bot:0xBDBDBD,mass:8, buoy:-5.0},
  [GOLD]:  {name:'Gold Ore',top:0xFFD54F,side:0xFFB300,bot:0xFFD54F,mass:6, buoy:-3.5},
  [COAL_B]:{name:'Coal Ore',top:0x424242,side:0x424242,bot:0x424242,mass:5, buoy:-2.5},
  [MOSS]:  {name:'Mossy Stone',top:0x558B2F,side:0x558B2F,bot:0x558B2F,mass:4,buoy:-2.0},
  [CACTUS]:{name:'Cactus', top:0x558B2F,side:0x558B2F,bot:0x558B2F,mass:1, buoy:1.5},
  [ENGINE_B]:{name:'Engine',top:0xF57F17,side:0xE65100,bot:0xF57F17, mass:4, buoy:-1.0},
  [PSPD]:  {name:'Speed Potion',top:0xCE93D8,side:0xAB47BC,bot:0xCE93D8, mass:0, buoy:1, noPlace:true},
  [PREG]:  {name:'Regen Potion',top:0xEF9A9A,side:0xE53935,bot:0xEF9A9A, mass:0, buoy:1, noPlace:true},
  [BUILD_I]:{name:'Build Analyzer',top:0x00BCD4,side:0x0097A7,bot:0x00BCD4, mass:0, buoy:1, noPlace:true},
  [GLUE_I]:{name:'Structure Glue',top:0xFFEB3B,side:0xF9A825,bot:0xFFEB3B, mass:0, buoy:1, noPlace:true},
  [STICK]: {name:'Stick',  top:0x8B6914,side:0x7a5c10,bot:0x8B6914, mass:0.1, buoy:3.0, item:true, noPlace:false},
  [ROCK]:  {name:'Rock',   top:0x78909C,side:0x607D8B,bot:0x78909C, mass:1.5, buoy:-0.5, item:true, noPlace:false},
  [CHEST]: {name:'Chest',  top:0xA1722A,side:0x8B6010,bot:0xA1722A, mass:2, buoy:1.5},
  [SWORD]: {name:'Sword',  top:0xBDBDBD,side:0x9E9E9E,bot:0xBDBDBD, mass:0.5, buoy:-0.2, item:true, noPlace:true, dmgBonus:4},
  [AXE]:   {name:'Axe',    top:0xBDBDBD,side:0x9E9E9E,bot:0xBDBDBD, mass:1, buoy:-0.5, item:true, noPlace:true, mineBonus:true},
  [FURNACE]:{name:'Furnace',top:0x616161,side:0x757575,bot:0x616161, mass:5, buoy:-2.5},
};
const PHYS_SET=new Set([SAND,GRAVEL,CLAY,RED_SAND]);
const CS=16,WH=64,SL=32;
let RD=3;

// ══════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════
let ST={rd:3,fov:75,sens:1.0,uname:'Player'};
function loadST(){try{Object.assign(ST,JSON.parse(localStorage.getItem('vc_st')||'{}'));}catch{}}
function saveST(){
  ST.rd=+document.getElementById('st-rd').value;
  ST.fov=+document.getElementById('st-fov').value;
  ST.sens=+document.getElementById('st-sens').value;
  ST.uname=document.getElementById('st-uname').value.trim()||'Player';
  localStorage.setItem('vc_st',JSON.stringify(ST));
  showMsg('Settings saved',700);
}
function stCh(){
  document.getElementById('sv-rd').textContent=document.getElementById('st-rd').value;
  document.getElementById('sv-fov').textContent=document.getElementById('st-fov').value+'°';
  document.getElementById('sv-sens').textContent=(+document.getElementById('st-sens').value).toFixed(1);
}
function applyST(){
  RD=ST.rd;camera.fov=ST.fov;camera.updateProjectionMatrix();
  document.getElementById('st-rd').value=ST.rd;
  document.getElementById('st-fov').value=ST.fov;
  document.getElementById('st-sens').value=ST.sens;
  document.getElementById('st-uname').value=ST.uname;
  stCh();
}
let newWorldMode='survival';
function setNewMode(m){newWorldMode=m;document.getElementById('mode-survival').classList.toggle('on',m==='survival');document.getElementById('mode-creative').classList.toggle('on',m==='creative');}

// ══════════════════════════════════════════════════

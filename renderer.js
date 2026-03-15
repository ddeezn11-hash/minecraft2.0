'use strict';
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

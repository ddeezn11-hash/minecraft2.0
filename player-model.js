'use strict';
//  PLAYER MODEL
// ══════════════════════════════════════════════════
function mkP(w,h,d,col,x,y,z,par){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:col}));m.position.set(x,y,z);par.add(m);return m;}
const pG=new THREE.Group();
mkP(0.62,0.62,0.62,0xFFCBA4,0,1.55,0,pG);
mkP(0.50,0.65,0.28,0x2E7D32,0,0.925,0,pG);
const pLA=mkP(0.22,0.60,0.22,0xFFCBA4,-0.36,0.925,0,pG);
const pRA=mkP(0.22,0.60,0.22,0xFFCBA4,0.36,0.925,0,pG);
const pLL=mkP(0.22,0.60,0.22,0x37474F,-0.14,0.3,0,pG);
const pRL=mkP(0.22,0.60,0.22,0x37474F,0.14,0.3,0,pG);
pG.visible=false;scene.add(pG);

const otherPlayers={};
// Health bar canvas helper
function mkHPBar(){
  const el=document.createElement('div');
  el.style.cssText='position:fixed;pointer-events:none;z-index:13;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:1px;';
  const name=document.createElement('div');
  name.style.cssText='font-size:9px;color:#fff;background:rgba(0,0,0,0.55);padding:1px 6px;font-family:monospace;white-space:nowrap;';
  const barBg=document.createElement('div');
  barBg.style.cssText='width:44px;height:4px;background:#2a2a2a;border:1px solid #111;';
  const barFill=document.createElement('div');
  barFill.style.cssText='height:100%;background:#4CAF50;transition:width 0.2s;';
  barBg.appendChild(barFill);
  el.appendChild(name);el.appendChild(barBg);
  document.body.appendChild(el);
  return{el,name,barFill};
}

function getOtherPlayer(id,uname){
  if(otherPlayers[id])return otherPlayers[id];
  const g=new THREE.Group();
  mkP(0.62,0.62,0.62,0xFF8A65,0,1.55,0,g);mkP(0.50,0.65,0.28,0x1565C0,0,0.925,0,g);
  mkP(0.22,0.60,0.22,0xFF8A65,-0.36,0.925,0,g);mkP(0.22,0.60,0.22,0xFF8A65,0.36,0.925,0,g);
  mkP(0.22,0.60,0.22,0x263238,-0.14,0.3,0,g);mkP(0.22,0.60,0.22,0x263238,0.14,0.3,0,g);
  scene.add(g);
  const hud=mkHPBar();
  otherPlayers[id]={grp:g,uname:uname||id,hp:20,maxHp:20,hud,flash:0};
  return otherPlayers[id];
}
function rmOtherPlayer(id){
  if(!otherPlayers[id])return;
  scene.remove(otherPlayers[id].grp);
  otherPlayers[id].hud.el.remove();
  delete otherPlayers[id];
}
// Update floating health bars each frame
function updateOtherPlayerHUDs(){
  for(const id in otherPlayers){
    const op=otherPlayers[id];
    const pr=new THREE.Vector3(op.grp.position.x,op.grp.position.y+2.6,op.grp.position.z).project(camera);
    if(pr.z<1&&pr.z>-1&&Math.hypot(op.grp.position.x-player.pos.x,op.grp.position.z-player.pos.z)<40){
      op.hud.el.style.display='flex';
      op.hud.el.style.left=((pr.x+1)/2*innerWidth)+'px';
      op.hud.el.style.top=((-pr.y+1)/2*innerHeight)+'px';
      const pct=Math.max(0,op.hp/op.maxHp*100);
      op.hud.barFill.style.width=pct+'%';
      op.hud.barFill.style.background=pct>60?'#4CAF50':pct>30?'#FF9800':'#f44336';
      op.hud.name.textContent=op.uname;
      // Flash red when hit
      if(op.flash>0){op.flash-=0.016;op.grp.children.forEach(c=>{if(c.material)c.material.emissive?.setHex(0x660000);});}
      else{op.grp.children.forEach(c=>{if(c.material?.emissive)c.material.emissive.setHex(0x000000);});}
    } else {
      op.hud.el.style.display='none';
    }
  }
}

// ══════════════════════════════════════════════════

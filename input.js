'use strict';
//  INPUT
// ══════════════════════════════════════════════════
document.addEventListener('pointerlockchange',()=>{
  running=document.pointerLockElement===renderer.domElement;
  if(running){
    ['crosshair','hud','info','keyhints'].forEach(id=>document.getElementById(id).style.display=id==='hud'?'flex':'block');
    document.getElementById('eff-hud').style.display='flex';
    document.getElementById('wind-hud').style.display='block';
    document.getElementById('eff-hud').style.display='flex';
    document.getElementById('wind-hud').style.display='block';
    document.getElementById('mode-badge').style.display='block';
    document.getElementById('pause').style.display='none';
    invOpen=false;document.getElementById('invscr').style.display='none';
  } else if(gameStarted&&!invOpen&&!chatOpen){
    document.getElementById('pause').style.display='flex';saveGame();
  }
});
document.addEventListener('mousemove',e=>{if(!running)return;mdx+=e.movementX;mdy+=e.movementY;});
document.addEventListener('keydown',e=>{
  if(chatOpen)return;
  keys[e.code]=true;
  if(e.code==='Escape'){if(invOpen)closeInv();else if(running)document.exitPointerLock();}
  if(e.code==='KeyE'&&running)toggleInv();
  if(e.code==='KeyQ'&&running)dropHeld();
  if(e.code==='KeyR'&&running){if(invOpen){/* rotate in inv screen */}else{rotateSlot(selSlot);renderHotbar();}}
  if(e.code==='KeyF'&&running){tpMode=(tpMode+1)%3;updTPLbl();}
  if(e.code==='KeyT'&&running){chatOpen=true;document.exitPointerLock();openChat();}
  if(e.code==='Period'&&running)showPList(true);
  if(e.code==='Space'&&running&&gameMode==='creative'){
    const now=Date.now();if(now-lastSpaceT<350){player.flying=!player.flying;showMsg(player.flying?'Flying ON':'Flying OFF',600);}
    lastSpaceT=now;
  }
  if(running){const n=parseInt(e.key);if(n>=1&&n<=9){selSlot=n-1;renderHotbar();}}
});
document.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Period')showPList(false);});
document.addEventListener('wheel',e=>{if(!running)return;selSlot=(selSlot+(e.deltaY>0?1:-1)+HS)%HS;renderHotbar();},{passive:true});
renderer.domElement.addEventListener('mousedown',e=>{if(!running||invOpen)return;if(e.button===0){triggerSwing();doMine();}if(e.button===2)doPlace();});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

function resumeGame(){renderer.domElement.requestPointerLock();}
function toggleInv(){invOpen=!invOpen;if(invOpen){document.exitPointerLock();document.getElementById('invscr').style.display='flex';document.getElementById('pause').style.display='none';renderInvScreen();}else closeInv();}
function closeInv(){invOpen=false;document.getElementById('invscr').style.display='none';if(gameStarted)renderer.domElement.requestPointerLock();}
function dropHeld(){const s=held();if(!s)return;const fx2=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);spawnDrop(s.type,player.pos.x+fx2*0.5,player.pos.y+1,player.pos.z+fz*0.5,fx2*4,2,fz*4);invRem(selSlot);renderHotbar();}
function updTPLbl(){const el=document.getElementById('tplbl');el.textContent=['','3rd Person','3rd Front'][tpMode];el.style.display=tpMode?'block':'none';}
function showPList(show){
  const el=document.getElementById('plist-ov');
  if(!show){el.style.display='none';return;}
  const rows=[`<div class="pl-row"><div class="pld" style="background:#4CAF50"></div>${ST.uname} <span style="font-size:8px;color:#4CAF50;opacity:0.5;">YOU</span></div>`];
  Object.values(otherPlayers).forEach(op=>{rows.push(`<div class="pl-row"><div class="pld" style="background:#FF8A65"></div>${op.uname||'Player'}</div>`);});
  document.getElementById('pl-rows').innerHTML=rows.join('');
  el.style.display='block';
}

// ══════════════════════════════════════════════════

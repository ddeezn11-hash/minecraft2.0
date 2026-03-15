'use strict';
//  MULTIPLAYER
// ══════════════════════════════════════════════════
let mpWS=null,mpPeer=null,peerConns={},myPeerId=null,mpConnected=false;
let netT=0,chatOpen=false;
const chatLines=[];

function initPeerJS(){
  if(typeof Peer==='undefined')return;
  try{mpPeer=new Peer();mpPeer.on('open',id=>{myPeerId=id;document.getElementById('peer-id-box').textContent=id;});mpPeer.on('connection',c=>setupPC(c));mpPeer.on('error',()=>{});}catch(e){}
}
function copyPeerId(){if(myPeerId)navigator.clipboard?.writeText(myPeerId).then(()=>showMsg('Copied!',600));}
function setupPC(conn){
  peerConns[conn.peer]=conn;
  conn.on('data',d=>handleNet(d,conn.peer));
  conn.on('close',()=>{rmOtherPlayer(conn.peer);delete peerConns[conn.peer];updateMPBadge();});
  conn.on('open',()=>{mpConnected=true;conn.send({t:'join',u:ST.uname});updateMPBadge();});
}
function joinPeer(){
  const id=document.getElementById('peer-join').value.trim();if(!id||!mpPeer)return;
  const conn=mpPeer.connect(id,{reliable:true});setupPC(conn);
  if(!gameStarted){const ws=getWorlds();if(ws.length)enterWorld(ws[0].name,ws[0].seed,ws[0].mode||'survival');}
}
function getServers(){try{return JSON.parse(localStorage.getItem('vc_servers')||'[]');}catch{return[];}}
function saveServer(){const u=document.getElementById('srv-url').value.trim(),n=document.getElementById('srv-name').value.trim()||u;if(!u)return;const ss=getServers();if(!ss.find(s=>s.url===u))ss.push({name:n,url:u});localStorage.setItem('vc_servers',JSON.stringify(ss));renderServerList();}
function delServer(u){localStorage.setItem('vc_servers',JSON.stringify(getServers().filter(s=>s.url!==u)));renderServerList();}
function renderServerList(){const el=document.getElementById('srvlist');const ss=getServers();el.innerHTML=ss.map(s=>`<div class="srv-row" onclick="quickConnect('${s.url}')"><div class="sdot" style="background:#4CAF50"></div><div class="sn">${s.name}</div><div class="stu">WS</div><span style="font-size:8px;color:#1a3a1a;cursor:pointer;" onclick="event.stopPropagation();delServer('${s.url}')">✕</span></div>`).join('')||'<div style="color:#1a3a1a;font-size:10px;padding:8px 0;">No saved servers</div>';}
function quickConnect(u){document.getElementById('srv-url').value=u;connectWS();}
function connectWS(){
  let u=document.getElementById('srv-url').value.trim();if(!u)return;
  if(!u.startsWith('ws'))u='ws://'+u;
  localStorage.setItem('vc_last',JSON.stringify({type:'server',url:u}));
  try{
    mpWS=new WebSocket(u);
    mpWS.onopen=()=>{mpConnected=true;updateMPBadge();mpWS.send(JSON.stringify({t:'join',u:ST.uname}));showMsg('Connected',900);if(!gameStarted){const ws=getWorlds();if(ws.length)enterWorld(ws[0].name,ws[0].seed,ws[0].mode||'survival');}};
    mpWS.onmessage=e=>{try{handleNet(JSON.parse(e.data),null);}catch{}};
    mpWS.onclose=()=>{mpConnected=false;mpWS=null;updateMPBadge();};
    mpWS.onerror=()=>{showMsg('Connection failed',900);mpConnected=false;};
  }catch{showMsg('Invalid URL',800);}
}
// Generate a stable local ID (persisted in localStorage)
let myId=localStorage.getItem('vc_myid');if(!myId){myId=Math.random().toString(36).slice(2);localStorage.setItem('vc_myid',myId);}

function handleNet(msg,from){
  if(!msg?.t)return;
  const id=from||msg.id||'srv';
  if(msg.t==='join'){const op=getOtherPlayer(id,msg.u);op.uname=msg.u||id;sendNet({t:'join',u:ST.uname,id:myId,hp:player.hp});}
  if(msg.t==='mv'){
    const op=getOtherPlayer(id,msg.u||id);
    op.grp.position.set(msg.x,msg.y,msg.z);op.grp.rotation.y=msg.yaw;
    if(msg.hp!==undefined)op.hp=msg.hp;
    if(msg.u)op.uname=msg.u;
  }
  if(msg.t==='blk'){_noTrig=true;setB(msg.x,msg.y,msg.z,msg.b);_noTrig=false;}
  if(msg.t==='chat')addChat(msg.u,msg.m);
  if(msg.t==='bye')rmOtherPlayer(id);
  // PVP: someone hit us
  if(msg.t==='pvpHit'&&msg.target===myId&&gameMode!=='creative'){
    player.hp=Math.max(0,player.hp-msg.dmg);
    flashDmg();renderHUD();
    addChat('⚔',''+msg.u+' hit you for '+msg.dmg);
    if(player.hp<=0){respawn();sendNet({t:'pvpDead',u:ST.uname,killer:msg.u,id:myId});}
  }
  if(msg.t==='pvpDead'){addChat('💀',msg.killer+' killed '+msg.u);}
}
function sendNet(msg){
  const j=typeof msg==='string'?msg:JSON.stringify(msg);
  if(mpWS?.readyState===1)mpWS.send(j);
  Object.values(peerConns).forEach(c=>{try{if(c.open)c.send(msg);}catch{}});
}
function updateMPBadge(){const el=document.getElementById('mp-badge');el.style.display=mpConnected?'block':'none';el.textContent=mpConnected?'◉ ONLINE':'';}

let chatFadeT=null;
function addChat(from,msg){
  chatLines.push({from,msg});if(chatLines.length>30)chatLines.shift();
  const cw=document.getElementById('chat-wrap');
  cw.innerHTML=chatLines.slice(-8).map(l=>`<div class="cline"><span class="cw">${l.from}</span>: ${l.msg}</div>`).join('');
  cw.scrollTop=cw.scrollHeight;
  if(!chatOpen){cw.style.display='flex';clearTimeout(chatFadeT);chatFadeT=setTimeout(()=>{if(!chatOpen)cw.style.display='none';},6000);}
}
function openChat(){
  chatOpen=true;
  document.getElementById('chat-inp-w').style.display='block';
  document.getElementById('chat-wrap').style.display='flex';
  setTimeout(()=>document.getElementById('chat-inp').focus(),50);
}
function closeChat(){
  chatOpen=false;
  document.getElementById('chat-inp-w').style.display='none';
  document.getElementById('chat-inp').value='';
  setTimeout(()=>{if(!chatOpen)document.getElementById('chat-wrap').style.display='none';},4000);
}
document.getElementById('chat-inp').addEventListener('keydown',e=>{
  if(e.key==='Enter'){const m=document.getElementById('chat-inp').value.trim();if(m){sendNet({t:'chat',u:ST.uname,m});addChat(ST.uname,m);}closeChat();setTimeout(()=>renderer.domElement.requestPointerLock(),80);}
  if(e.key==='Escape'){closeChat();setTimeout(()=>renderer.domElement.requestPointerLock(),80);}
  e.stopPropagation();
});

// ══════════════════════════════════════════════════

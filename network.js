// ══════════════════════════════════════════════════
//  network.js — VoxelCraft Multiplayer
//  Handles: WebSocket, PeerJS P2P, chat, DMs,
//           PVP sync, block sync, player positions
// ══════════════════════════════════════════════════

// ── Stable local peer ID (persists across sessions) ──
let myId = localStorage.getItem('vc_myid');
if (!myId) {
  myId = Math.random().toString(36).slice(2);
  localStorage.setItem('vc_myid', myId);
}

// ── State ──
let mpWS       = null;   // active WebSocket connection
let mpPeer     = null;   // PeerJS instance
let peerConns  = {};     // peer id -> DataConnection
let myPeerId   = null;   // our PeerJS id (shown in UI)
let mpConnected = false;
let netT       = 0;      // position broadcast timer
let chatOpen   = false;
const chatLines = [];
let activeDM   = null;   // username of current DM conversation
let chatFadeT  = null;   // timeout for fading chat

// ── Auto-connect when served from Render ──
// If the game is opened from https://yourapp.onrender.com,
// automatically connect to wss://yourapp.onrender.com
window.addEventListener('load', () => {
  if (window.location.hostname !== 'localhost' &&
      window.location.hostname !== '' &&
      !window.location.hostname.startsWith('192.') &&
      window.location.protocol === 'https:') {
    const autoUrl = 'wss://' + window.location.host;
    // Wait 2 seconds for game to finish initialising
    setTimeout(() => {
      console.log('[NET] Auto-connecting to', autoUrl);
      connectWS(autoUrl);
    }, 2000);
  }
});

// ══════════════════════════════════════════════════
//  OTHER PLAYER MODELS
// ══════════════════════════════════════════════════
const otherPlayers = {};

function mkHPBar() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;pointer-events:none;z-index:13;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:1px;';
  const name  = document.createElement('div');
  name.style.cssText = 'font-size:9px;color:#fff;background:rgba(0,0,0,0.55);padding:1px 6px;font-family:monospace;white-space:nowrap;';
  const barBg = document.createElement('div');
  barBg.style.cssText = 'width:44px;height:4px;background:#2a2a2a;border:1px solid #111;';
  const barFill = document.createElement('div');
  barFill.style.cssText = 'height:100%;background:#4CAF50;transition:width 0.2s;';
  barBg.appendChild(barFill);
  el.appendChild(name);
  el.appendChild(barBg);
  document.body.appendChild(el);
  return { el, name, barFill };
}

function mkPart(w, h, d, col, x, y, z, par) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: col })
  );
  m.position.set(x, y, z);
  par.add(m);
  return m;
}

function getOtherPlayer(id, uname) {
  if (otherPlayers[id]) return otherPlayers[id];
  const g = new THREE.Group();
  mkPart(0.62, 0.62, 0.62, 0xFF8A65,  0,    1.55, 0, g); // head
  mkPart(0.50, 0.65, 0.28, 0x1565C0,  0,    0.925, 0, g); // body
  mkPart(0.22, 0.60, 0.22, 0xFF8A65, -0.36, 0.925, 0, g); // left arm
  mkPart(0.22, 0.60, 0.22, 0xFF8A65,  0.36, 0.925, 0, g); // right arm
  mkPart(0.22, 0.60, 0.22, 0x263238, -0.14, 0.3,   0, g); // left leg
  mkPart(0.22, 0.60, 0.22, 0x263238,  0.14, 0.3,   0, g); // right leg
  scene.add(g);
  const hud = mkHPBar();
  otherPlayers[id] = { grp: g, uname: uname || id, hp: 20, maxHp: 20, hud, flash: 0 };
  return otherPlayers[id];
}

function rmOtherPlayer(id) {
  if (!otherPlayers[id]) return;
  scene.remove(otherPlayers[id].grp);
  otherPlayers[id].hud.el.remove();
  delete otherPlayers[id];
}

// Call this every frame in the game loop
function updateOtherPlayerHUDs() {
  for (const id in otherPlayers) {
    const op = otherPlayers[id];
    const pr = new THREE.Vector3(
      op.grp.position.x,
      op.grp.position.y + 2.6,
      op.grp.position.z
    ).project(camera);

    const dist = Math.hypot(
      op.grp.position.x - player.pos.x,
      op.grp.position.z - player.pos.z
    );

    if (pr.z < 1 && pr.z > -1 && dist < 40) {
      op.hud.el.style.display = 'flex';
      op.hud.el.style.left   = ((pr.x + 1) / 2 * innerWidth)  + 'px';
      op.hud.el.style.top    = ((-pr.y + 1) / 2 * innerHeight) + 'px';
      const pct = Math.max(0, op.hp / op.maxHp * 100);
      op.hud.barFill.style.width      = pct + '%';
      op.hud.barFill.style.background = pct > 60 ? '#4CAF50' : pct > 30 ? '#FF9800' : '#f44336';
      op.hud.name.textContent         = op.uname;
      if (op.flash > 0) {
        op.flash -= 0.016;
        op.grp.children.forEach(c => { if (c.material?.emissive) c.material.emissive.setHex(0x660000); });
      } else {
        op.grp.children.forEach(c => { if (c.material?.emissive) c.material.emissive.setHex(0x000000); });
      }
    } else {
      op.hud.el.style.display = 'none';
    }
  }
}

// ══════════════════════════════════════════════════
//  WEBSOCKET
// ══════════════════════════════════════════════════
function connectWS(url) {
  // If called from the UI with no argument, read the input field
  if (!url) url = document.getElementById('srv-url')?.value?.trim();
  if (!url) return;
  if (!url.startsWith('ws')) url = 'wss://' + url;

  // Save as last-used server
  localStorage.setItem('vc_last', JSON.stringify({ type: 'server', url }));

  try {
    mpWS = new WebSocket(url);

    mpWS.onopen = () => {
      mpConnected = true;
      updateMPBadge();
      mpWS.send(JSON.stringify({ t: 'join', u: ST.uname, id: myId }));
      showMsg('Connected to server', 1000);
      // If game isn't open yet, load the most recent world
      if (!gameStarted) {
        const ws = getWorlds();
        if (ws.length) enterWorld(ws[0].name, ws[0].seed, ws[0].mode || 'survival');
      }
    };

    mpWS.onmessage = e => {
      try { handleNet(JSON.parse(e.data), null); } catch {}
    };

    mpWS.onclose = () => {
      mpConnected = false;
      mpWS = null;
      updateMPBadge();
      addChat('SERVER', 'Disconnected');
    };

    mpWS.onerror = () => {
      showMsg('Connection failed — check URL', 1200);
      mpConnected = false;
    };

  } catch (e) {
    showMsg('Invalid server URL', 900);
  }
}

// ══════════════════════════════════════════════════
//  PEER-TO-PEER (PeerJS)
// ══════════════════════════════════════════════════
function initPeerJS() {
  if (typeof Peer === 'undefined') return;
  try {
    mpPeer = new Peer();
    mpPeer.on('open', id => {
      myPeerId = id;
      const box = document.getElementById('peer-id-box');
      if (box) box.textContent = id;
    });
    mpPeer.on('connection', conn => setupPeerConn(conn));
    mpPeer.on('error', () => {});
  } catch (e) {}
}

function copyPeerId() {
  if (myPeerId) {
    navigator.clipboard?.writeText(myPeerId)
      .then(() => showMsg('Peer ID copied!', 700));
  }
}

function setupPeerConn(conn) {
  peerConns[conn.peer] = conn;
  conn.on('data',  d  => handleNet(d, conn.peer));
  conn.on('close', () => {
    rmOtherPlayer(conn.peer);
    delete peerConns[conn.peer];
    updateMPBadge();
  });
  conn.on('open', () => {
    mpConnected = true;
    conn.send({ t: 'join', u: ST.uname, id: myId });
    updateMPBadge();
  });
}

function joinPeer() {
  const id = document.getElementById('peer-join')?.value?.trim();
  if (!id || !mpPeer) return;
  const conn = mpPeer.connect(id, { reliable: true });
  setupPeerConn(conn);
  // Enter most recent world if game not started
  if (!gameStarted) {
    const ws = getWorlds();
    if (ws.length) enterWorld(ws[0].name, ws[0].seed, ws[0].mode || 'survival');
  }
}

// ══════════════════════════════════════════════════
//  SEND (broadcast to all connections)
// ══════════════════════════════════════════════════
function sendNet(msg) {
  const j = typeof msg === 'string' ? msg : JSON.stringify(msg);
  if (mpWS?.readyState === 1) mpWS.send(j);
  Object.values(peerConns).forEach(c => {
    try { if (c.open) c.send(msg); } catch {}
  });
}

// ══════════════════════════════════════════════════
//  RECEIVE — handle all incoming messages
// ══════════════════════════════════════════════════
function handleNet(msg, from) {
  if (!msg?.t) return;
  const id = from || msg.id || 'server';

  switch (msg.t) {

    // ── Player joined ──
    case 'join': {
      const op = getOtherPlayer(id, msg.u);
      op.uname = msg.u || id;
      // Reply with our own info so they see us
      sendNet({ t: 'join', u: ST.uname, id: myId, hp: player.hp });
      addChat('→', msg.u + ' joined');
      break;
    }

    // ── Player moved ──
    case 'mv': {
      const op = getOtherPlayer(id, msg.u || id);
      op.grp.position.set(msg.x, msg.y, msg.z);
      op.grp.rotation.y = msg.yaw || 0;
      if (msg.hp !== undefined) op.hp = msg.hp;
      if (msg.u) op.uname = msg.u;
      break;
    }

    // ── Block placed / broken ──
    case 'blk': {
      _noTrig = true;
      setB(msg.x, msg.y, msg.z, msg.b);
      _noTrig = false;
      break;
    }

    // ── Chat message ──
    case 'chat': {
      addChat(msg.u, msg.m);
      break;
    }

    // ── Player left ──
    case 'bye': {
      addChat('←', (otherPlayers[id]?.uname || id) + ' left');
      rmOtherPlayer(id);
      break;
    }

    // ── PVP: someone hit us ──
    case 'pvpHit': {
      if (msg.target !== myId) break;
      if (gameMode === 'creative') break;
      // Check world PVP permission
      if (!checkPerms(curWorld, 'pvp')) {
        // PVP disabled — restore HP
        player.hp = Math.min(player.maxHp, player.hp + msg.dmg);
        renderHUD();
        break;
      }
      player.hp = Math.max(0, player.hp - msg.dmg);
      flashDmg();
      renderHUD();
      addChat('⚔', msg.u + ' hit you for ' + msg.dmg);
      if (player.hp <= 0) {
        respawn();
        sendNet({ t: 'pvpDead', u: ST.uname, killer: msg.u, id: myId });
      }
      break;
    }

    // ── PVP: kill confirmed ──
    case 'pvpDead': {
      addChat('💀', msg.killer + ' killed ' + msg.u);
      break;
    }

    // ── Direct message ──
    case 'dm': {
      if (msg.to !== ST.uname) break;
      const f = getFriends();
      if (!f.dms[msg.from]) f.dms[msg.from] = [];
      f.dms[msg.from].push({
        from: msg.from, to: msg.to,
        text: msg.text, ts: msg.ts || Date.now()
      });
      saveFriends(f);
      if (activeDM === msg.from) renderDMThread();
      addChat('📨', msg.from + ': ' + msg.text);
      break;
    }

    // ── Friend request ──
    case 'fr_req': {
      const f = getFriends();
      if (!f.requests) f.requests = [];
      if (!f.requests.includes(msg.from)) f.requests.push(msg.from);
      saveFriends(f);
      addChat('👥', msg.from + ' sent you a friend request');
      break;
    }
  }
}

// ══════════════════════════════════════════════════
//  PVP — attack nearest player in view
// ══════════════════════════════════════════════════
function attackPlayer() {
  if (!mpConnected) return false;
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  let best = null, bestDist = 4.5;

  for (const id in otherPlayers) {
    const op = otherPlayers[id];
    const dx = op.grp.position.x - player.pos.x;
    const dy = op.grp.position.y - player.pos.y;
    const dz = op.grp.position.z - player.pos.z;
    const d  = Math.hypot(dx, dy, dz);
    const dot = (dx * fwd.x + dz * fwd.z) / Math.max(0.01, Math.hypot(dx, dz));
    if (d < bestDist && dot > 0.55) { bestDist = d; best = id; }
  }

  if (!best) return false;

  const dmg = getPlayerDmg();
  const op  = otherPlayers[best];
  op.flash  = 0.35;
  hitFlash  = 0.15;

  sendNet({ t: 'pvpHit', target: best, dmg, u: ST.uname, id: myId });
  addChat('⚔', 'You hit ' + op.uname);
  return true;
}

// ══════════════════════════════════════════════════
//  POSITION BROADCAST (called each frame)
// ══════════════════════════════════════════════════
function broadcastPosition(dt) {
  netT += dt;
  if (netT > 0.1) {
    netT = 0;
    sendNet({
      t: 'mv',
      x: player.pos.x,
      y: player.pos.y,
      z: player.pos.z,
      yaw: player.yaw,
      u: ST.uname,
      id: myId,
      hp: player.hp
    });
  }
}

// ══════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════
function addChat(from, msg) {
  chatLines.push({ from, msg });
  if (chatLines.length > 30) chatLines.shift();

  const cw = document.getElementById('chat-wrap');
  if (!cw) return;
  cw.innerHTML = chatLines.slice(-8)
    .map(l => `<div class="cline"><span class="cw">${l.from}</span>: ${l.msg}</div>`)
    .join('');
  cw.scrollTop = cw.scrollHeight;

  // Show chat history briefly, then hide
  if (!chatOpen) {
    cw.style.display = 'flex';
    clearTimeout(chatFadeT);
    chatFadeT = setTimeout(() => {
      if (!chatOpen) cw.style.display = 'none';
    }, 6000);
  }
}

function openChat() {
  chatOpen = true;
  const w = document.getElementById('chat-inp-w');
  const cw = document.getElementById('chat-wrap');
  if (w)  w.style.display  = 'block';
  if (cw) cw.style.display = 'flex';
  setTimeout(() => document.getElementById('chat-inp')?.focus(), 50);
}

function closeChat() {
  chatOpen = false;
  const w = document.getElementById('chat-inp-w');
  const inp = document.getElementById('chat-inp');
  if (w)   w.style.display = 'none';
  if (inp) inp.value = '';
  setTimeout(() => {
    if (!chatOpen) {
      const cw = document.getElementById('chat-wrap');
      if (cw) cw.style.display = 'none';
    }
  }, 4000);
}

// Hook Enter/Escape on the chat input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('chat-inp');
  if (!inp) return;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const m = inp.value.trim();
      if (m) { sendNet({ t: 'chat', u: ST.uname, m }); addChat(ST.uname, m); }
      closeChat();
      setTimeout(() => renderer?.domElement?.requestPointerLock(), 80);
    }
    if (e.key === 'Escape') {
      closeChat();
      setTimeout(() => renderer?.domElement?.requestPointerLock(), 80);
    }
    e.stopPropagation();
  });
});

// ══════════════════════════════════════════════════
//  STATUS BADGE
// ══════════════════════════════════════════════════
function updateMPBadge() {
  const el = document.getElementById('mp-badge');
  if (!el) return;
  el.style.display = mpConnected ? 'block' : 'none';
  el.textContent   = mpConnected ? '◉ ONLINE' : '';
}

// ══════════════════════════════════════════════════
//  SERVER LIST HELPERS (used by menu.js)
// ══════════════════════════════════════════════════
function getServers() {
  try { return JSON.parse(localStorage.getItem('vc_servers') || '[]'); } catch { return []; }
}

function saveServer() {
  const u = document.getElementById('srv-url')?.value?.trim();
  const n = document.getElementById('srv-name')?.value?.trim() || u;
  if (!u) return;
  const ss = getServers();
  if (!ss.find(s => s.url === u)) ss.push({ name: n, url: u });
  localStorage.setItem('vc_servers', JSON.stringify(ss));
  renderServerList();
}

function delServer(u) {
  localStorage.setItem('vc_servers',
    JSON.stringify(getServers().filter(s => s.url !== u))
  );
  renderServerList();
}

function renderServerList() {
  const el = document.getElementById('srvlist');
  if (!el) return;
  const ss = getServers();
  el.innerHTML = ss.length
    ? ss.map(s => `
        <div class="srv-row" onclick="quickConnect('${s.url}')">
          <div class="sdot" style="background:#4CAF50"></div>
          <div class="sn">${s.name}</div>
          <div class="stu">WS</div>
          <span style="font-size:8px;color:#1a3a1a;cursor:pointer;"
                onclick="event.stopPropagation();delServer('${s.url}')">✕</span>
        </div>`).join('')
    : '<div style="color:#1a3a1a;font-size:10px;padding:8px 0;">No saved servers</div>';
}

function quickConnect(url) {
  const inp = document.getElementById('srv-url');
  if (inp) inp.value = url;
  connectWS(url);
}

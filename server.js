// VoxelCraft Relay Server
// Handles HTTP (status page + game file) and WebSocket (game traffic)
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 10000;
const clients = new Map();
let totalConnections = 0;
const startTime = Date.now();

// Try to load the game file (minecraft.html must be in same folder as server.js)
const GAME_FILE = path.join(__dirname, 'index.html');
function serveGame(res) {
  if (fs.existsSync(GAME_FILE)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(GAME_FILE).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('minecraft.html not found — add it to your repo');
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── HTTP server ──
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Serve the game at /play or /game
  if (url === '/play' || url === '/game' || url === '/minecraft.html') {
    return serveGame(res);
  }

  // Status page at /
  const upSecs = Math.floor((Date.now() - startTime) / 1000);
  const upStr = upSecs > 3600
    ? `${Math.floor(upSecs/3600)}h ${Math.floor((upSecs%3600)/60)}m`
    : upSecs > 60 ? `${Math.floor(upSecs/60)}m ${upSecs%60}s`
    : `${upSecs}s`;

  const playerList = [...clients.values()]
    .map(c => `<li>● ${escHtml(c.uname||'Player')}</li>`)
    .join('') || '<li style="color:#444">No players online</li>';

  const host = req.headers.host || 'your-app.onrender.com';

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><title>VoxelCraft Server</title>
<meta http-equiv="refresh" content="10">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#060e06;color:#a5d6a7;font-family:'Courier New',monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;}
  .wrap{width:100%;max-width:560px;padding:24px;}
  h1{color:#4CAF50;font-size:32px;letter-spacing:5px;text-shadow:3px 3px 0 #1b5e20;margin-bottom:4px;}
  .tag{font-size:9px;color:#2a5a2a;letter-spacing:5px;margin-bottom:24px;}
  .card{background:#080f08;border:1px solid #0e1e0e;padding:14px 18px;margin-bottom:10px;}
  .lbl{font-size:8px;color:#1a3a1a;letter-spacing:3px;margin-bottom:7px;}
  .val{font-size:22px;color:#4CAF50;font-weight:bold;}
  .url{background:#040d04;border:1px solid #0a1a0a;padding:10px 14px;color:#64b5f6;font-size:13px;letter-spacing:1px;margin:6px 0;cursor:pointer;word-break:break-all;}
  .url:hover{border-color:#1a3a8a;}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
  .stat{text-align:center;background:#050d05;border:1px solid #0a1a0a;padding:12px 8px;}
  ul{list-style:none;}li{padding:4px 0;border-bottom:1px solid #080f08;font-size:11px;}
  .play-btn{display:block;width:100%;padding:13px;background:#1b5e20;border:none;color:#a5d6a7;font-family:'Courier New',monospace;font-size:14px;letter-spacing:3px;cursor:pointer;text-align:center;text-decoration:none;margin-top:4px;}
  .play-btn:hover{background:#2e7d32;}
  footer{font-size:8px;color:#1a2a1a;text-align:center;margin-top:16px;}
</style>
</head><body><div class="wrap">
  <h1>VOXELCRAFT</h1>
  <div class="tag">SERVER STATUS</div>

  <div class="card grid">
    <div class="stat"><div class="lbl">ONLINE</div><div class="val">${clients.size}</div></div>
    <div class="stat"><div class="lbl">TOTAL</div><div class="val">${totalConnections}</div></div>
    <div class="stat"><div class="lbl">UPTIME</div><div class="val" style="font-size:14px;">${upStr}</div></div>
  </div>

  <div class="card">
    <div class="lbl">PLAY IN BROWSER</div>
    <a class="play-btn" href="/play">▶  OPEN GAME</a>
  </div>

  <div class="card">
    <div class="lbl">OR: PASTE THIS IN GAME → SERVERS → JOIN</div>
    <div class="url" onclick="navigator.clipboard?.writeText('wss://${host}').then(()=>this.textContent='Copied!')">wss://${host}</div>
    <div style="font-size:8px;color:#1a3a1a;margin-top:4px;">Click to copy</div>
  </div>

  <div class="card">
    <div class="lbl">PLAYERS ONLINE</div>
    <ul>${playerList}</ul>
  </div>

  <footer>Auto-refreshes every 10s</footer>
</div></body></html>`);
});

// ── WebSocket relay ──
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2);
  clients.set(ws, { id, uname: 'Player', world: '' });
  totalConnections++;
  console.log(`[+] ${id} — ${clients.size} online`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const info = clients.get(ws);
      if (msg.t === 'join') { info.uname = msg.u || info.uname; info.world = msg.world || ''; }
      if (msg.t === 'mv' && msg.u) info.uname = msg.u;
      msg.id = id;
      const out = JSON.stringify(msg);
      wss.clients.forEach(c => { if (c !== ws && c.readyState === 1) c.send(out); });
    } catch {}
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    console.log(`[-] ${info?.uname || id} — ${clients.size - 1} online`);
    const bye = JSON.stringify({ t: 'bye', id, u: info?.uname });
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(bye); });
    clients.delete(ws);
  });

  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`VoxelCraft server running on port ${PORT}`);
});


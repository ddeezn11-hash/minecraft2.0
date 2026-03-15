const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 10000;
const clients = new Map();
let totalConnections = 0;
const startTime = Date.now();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function serveFile(res, filePath) {
  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'text/plain';
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + path.basename(filePath));
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function statusPage(req) {
  const upSecs = Math.floor((Date.now() - startTime) / 1000);
  const upStr  = upSecs > 3600
    ? `${Math.floor(upSecs/3600)}h ${Math.floor((upSecs%3600)/60)}m`
    : upSecs > 60 ? `${Math.floor(upSecs/60)}m ${upSecs%60}s`
    : `${upSecs}s`;
  const host = req.headers.host || 'yourapp.onrender.com';
  const list = [...clients.values()]
    .map(c => `<li>● ${escHtml(c.uname||'Player')}</li>`).join('')
    || '<li style="color:#444">No players online</li>';

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>VoxelCraft Server</title>
<meta http-equiv="refresh" content="10">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#060e06;color:#a5d6a7;font-family:'Courier New',monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;}
.wrap{width:100%;max-width:540px;padding:24px;}
h1{color:#4CAF50;font-size:30px;letter-spacing:5px;text-shadow:3px 3px 0 #1b5e20;margin-bottom:4px;}
.tag{font-size:9px;color:#2a5a2a;letter-spacing:5px;margin-bottom:22px;}
.card{background:#080f08;border:1px solid #0e1e0e;padding:14px 18px;margin-bottom:10px;}
.lbl{font-size:8px;color:#1a3a1a;letter-spacing:3px;margin-bottom:7px;}
.val{font-size:22px;color:#4CAF50;font-weight:bold;}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.stat{text-align:center;background:#050d05;border:1px solid #0a1a0a;padding:12px 8px;}
.url{background:#040d04;border:1px solid #0a1a0a;padding:10px 14px;color:#64b5f6;font-size:13px;margin:6px 0;cursor:pointer;word-break:break-all;}
a.btn{display:block;width:100%;padding:13px;background:#1b5e20;border:none;color:#a5d6a7;font-family:'Courier New',monospace;font-size:14px;letter-spacing:3px;text-align:center;text-decoration:none;margin-top:4px;}
a.btn:hover{background:#2e7d32;}
ul{list-style:none;}li{padding:4px 0;border-bottom:1px solid #080f08;font-size:11px;}
footer{font-size:8px;color:#1a2a1a;text-align:center;margin-top:14px;}
</style></head><body><div class="wrap">
<h1>VOXELCRAFT</h1>
<div class="tag">SERVER STATUS</div>
<div class="card grid">
  <div class="stat"><div class="lbl">ONLINE</div><div class="val">${clients.size}</div></div>
  <div class="stat"><div class="lbl">TOTAL</div><div class="val">${totalConnections}</div></div>
  <div class="stat"><div class="lbl">UPTIME</div><div class="val" style="font-size:14px">${upStr}</div></div>
</div>
<div class="card">
  <div class="lbl">PLAY IN BROWSER</div>
  <a class="btn" href="/play">▶  OPEN GAME</a>
</div>
<div class="card">
  <div class="lbl">MULTIPLAYER URL — paste in Servers → Join</div>
  <div class="url" onclick="navigator.clipboard?.writeText('wss://${host}').then(()=>this.textContent='Copied!')">wss://${host}</div>
  <div style="font-size:8px;color:#1a3a1a;margin-top:4px;">Click to copy</div>
</div>
<div class="card">
  <div class="lbl">PLAYERS ONLINE</div>
  <ul>${list}</ul>
</div>
<footer>Auto-refreshes every 10s</footer>
</div></body></html>`;
}

// ── HTTP server ──
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Root → status page
  if (urlPath === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(statusPage(req));
    return;
  }

  // /play or /game → serve index.html
  if (urlPath === '/play' || urlPath === '/game') {
    serveFile(res, path.join(__dirname, 'index.html'));
    return;
  }

  // Everything else → try to serve the file from repo root
  // This handles /blocks.js, /world.js, /network.js etc.
  const safePath = path.join(__dirname, path.basename(urlPath));
  serveFile(res, safePath);
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
      const msg  = JSON.parse(raw);
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
  console.log(`VoxelCraft server on port ${PORT}`);
});

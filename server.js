// VoxelCraft WebSocket Relay Server
// Usage: npm install ws && node server.js
// Then connect from the game: ws://your-ip:8080

const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: process.env.PORT || 8080 });
const clients = new Map(); // ws -> { id, uname, world }

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2);
  clients.set(ws, { id, uname: 'unknown', world: null });
  console.log(`[+] ${id} connected  (${clients.size} online)`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const info = clients.get(ws);

      if (msg.t === 'join') {
        info.uname = msg.u || 'unknown';
        info.world = msg.world || null;
        console.log(`    ${info.uname} joined  world=${info.world}`);
      }

      // Stamp sender ID and relay to all other clients
      msg.id = id;
      const out = JSON.stringify(msg);
      wss.clients.forEach(c => {
        if (c !== ws && c.readyState === 1) c.send(out);
      });
    } catch (e) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    const bye = JSON.stringify({ t: 'bye', id, u: info?.uname });
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(bye); });
    clients.delete(ws);
    console.log(`[-] ${info?.uname || id} left  (${clients.size} online)`);
  });

  ws.on('error', () => {});
});

console.log(`VoxelCraft server on ws://localhost:${process.env.PORT || 8080}`);
console.log('Share your public IP so friends can connect.');

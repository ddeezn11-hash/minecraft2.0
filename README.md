# VoxelCraft

A Minecraft-style voxel game that runs entirely in the browser.

## Quick Start

**Play instantly:**  
Double-click `index.html` — no install needed.

**If double-click doesn't work** (some browsers block local file APIs):
```bash
# Python (built-in on Mac/Linux)
cd voxelcraft
python3 -m http.server 8080
# then open http://localhost:8080
```

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump (double-tap = fly in Creative) |
| Shift | Sprint |
| Left Click | Mine block / Attack |
| Right Click | Place block / Use item |
| E | Inventory + Crafting |
| Q | Drop item |
| R | Rotate held item |
| F | Toggle 3rd person |
| T | Chat (multiplayer) |
| . | Hold to see players online |
| 1–9 / Scroll | Select hotbar slot |
| Esc | Pause |

## Crafting

Drop items on the ground near you — recipes auto-craft when the right items are within range!

| Recipe | Output |
|--------|--------|
| Stick×3 | Planks×2 |
| Stick×2 + Rock×1 | Stone Axe |
| Coal Ore + Stick | Torches×4 |
| Plank×6 | Chest |
| Iron×2 + Stick | Iron Sword |
| Iron×3 + Stick×2 | Iron Axe |
| Sand×4 | Glass×2 |
| Cobble×8 + Coal | Furnace |

## Multiplayer

### P2P (no server needed)
Go to **Servers → Peer-to-Peer**, share your Peer ID with friends. Both must have the page open.

### WebSocket Server (permanent)
```bash
npm install
node server.js
```
Friends connect to `ws://your-ip:8080` via **Servers → Join Server**.

**Free hosting:**
- [Render.com](https://render.com) — push to GitHub, deploy as Web Service
- [Glitch.com](https://glitch.com) — paste server.js, get instant wss:// URL

## File Structure

```
index.html          ← main page (loads all modules)
server.js           ← multiplayer relay server (Node.js)
package.json        ← npm config for server
js/
  noise.js          ← Perlin noise
  blocks.js         ← block registry, textures, materials
  settings.js       ← user settings + inventory
  save.js           ← world save/load (localStorage)
  renderer.js       ← Three.js scene, camera, lighting
  world.js          ← chunk data, terrain generation, biomes
  drops.js          ← item drop physics
  physics.js        ← gravity blocks, water flow
  structures.js     ← boat/structure physics
  player-model.js   ← player mesh + other players
  network.js        ← WebSocket + PeerJS multiplayer
  torch.js          ← torch point lights
  chest.js          ← chest storage UI
  hunger.js         ← hunger system
  tools.js          ← weapon damage + tool bonuses
  mobs.js           ← mob AI, spawning, combat
  input.js          ← keyboard, mouse, pointer lock
  raycast.js        ← block raycasting, mine/place
  weather.js        ← rain, storm, snow, day-night
  player.js         ← movement, physics, camera, update loop
  hud.js            ← hotbar, hearts, inventory screen
  menu.js           ← main menu, world list, account
  loop.js           ← game loop, resize handler
  engine-tab.js     ← ENGINE tab (commands, scripting, perms)
```

## Biomes

Plains · Forest · Desert · Snowy Tundra · Ocean · Mountains · Swamp · Mesa

Each biome has unique terrain height, surface blocks, ores, and features.

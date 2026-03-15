'use strict';
//  HUD RENDERING
// ══════════════════════════════════════════════════
function renderHotbar(){
  const hb=document.getElementById('hotbar');hb.innerHTML='';
  for(let i=0;i<HS;i++){
    const sl=inventory[i];const el=document.createElement('div');el.className='hsl'+(i===selSlot?' on':'');
    if(sl){const def=BD[sl.type];if(def){
      const T='#'+def.top.toString(16).padStart(6,'0'),S='#'+def.side.toString(16).padStart(6,'0');
      const rotStr=sl.rot!==undefined&&sl.rot>0?`<div class="brot">${ROT_DIRS[sl.rot]}</div>`:'';
      el.innerHTML=`<div class="bic"><div class="bt" style="background:${T}"></div><div class="bs" style="background:${S}"></div><div class="bhi"></div></div><div class="bn">${def.name}</div><div class="bc">${sl.count>99?'99+':sl.count}</div>${rotStr}`;
    }}
    el.onclick=()=>{selSlot=i;renderHotbar();};hb.appendChild(el);
  }
}
function renderHUD(){
  if(gameMode==='creative'){document.getElementById('hearts').innerHTML='';return;}
  let h='';for(let i=0;i<10;i++){const f=player.hp>=(i+1)*2,hf=!f&&player.hp>=i*2+1;h+=`<span class="ht ${f?'f':hf?'h':'e'}">♥</span>`;}
  document.getElementById('hearts').innerHTML=h;
}
function renderFX(){
  const el=document.getElementById('eff-hud');let b='';
  if(fx.spd>0)b+=`<div class="efb"><div class="ed" style="background:#CE93D8"></div>Speed ${Math.ceil(fx.spd)}s</div>`;
  if(fx.reg>0)b+=`<div class="efb"><div class="ed" style="background:#EF9A9A"></div>Regen ${Math.ceil(fx.reg)}s</div>`;
  el.innerHTML=b;
}
let dragSrc=-1;
function renderInvScreen(){
  function mkISlot(idx){
    const sl=inventory[idx];
    const el=document.createElement('div');
    el.className='isl'+(idx===selSlot?' ia':'');
    if(sl){
      const def=BD[sl.type];if(def){
        const T='#'+def.top.toString(16).padStart(6,'0'),S='#'+def.side.toString(16).padStart(6,'0');
        const rotStr=sl.rot&&sl.rot>0?`<div class="irot">${ROT_DIRS[sl.rot]}</div>`:'';
        el.innerHTML=`<div class="ic"><div class="ict" style="background:${T}"></div><div class="ics" style="background:${S}"></div></div><div class="icn">${sl.count>99?'99+':sl.count}</div>${rotStr}`;
        el.title=def.name+(sl.rot?` ${ROT_DIRS[sl.rot]}`:'');
        el.draggable=true;
      }
    }
    el.addEventListener('dragstart',e=>{dragSrc=idx;el.style.opacity='0.35';e.dataTransfer.effectAllowed='move';});
    el.addEventListener('dragend',()=>{el.style.opacity='';});
    el.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';el.classList.add('drag-over');});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',e=>{
      e.preventDefault();el.classList.remove('drag-over');
      if(dragSrc<0||dragSrc===idx)return;
      const tmp=inventory[dragSrc];inventory[dragSrc]=inventory[idx];inventory[idx]=tmp;
      if(dragSrc===selSlot)selSlot=idx;else if(idx===selSlot)selSlot=dragSrc;
      dragSrc=-1;renderInvScreen();renderHotbar();
    });
    el.onclick=()=>{
      if(idx<HS)selSlot=idx;
      else if(sl){for(let i=0;i<HS;i++){if(!inventory[i]){inventory[i]=sl;inventory[idx]=null;break;}}}
      renderInvScreen();renderHotbar();
    };
    el.oncontextmenu=e=>{e.preventDefault();rotateSlot(idx);renderInvScreen();renderHotbar();};
    return el;
  }
  const me=document.getElementById('inv-main');me.innerHTML='';for(let i=9;i<36;i++)me.appendChild(mkISlot(i));
  const he=document.getElementById('inv-hbar');he.innerHTML='';for(let i=0;i<HS;i++)he.appendChild(mkISlot(i));
  // Recipe panel
  const rl=document.getElementById('recipe-list');
  if(rl){
    rl.innerHTML=CRAFT_RECIPES.map(r=>{
      const outDef=BD[r.output];const col=outDef?'#'+outDef.top.toString(16).padStart(6,'0'):'#888';
      const ins=[];for(let i=0;i<r.inputs.length;i+=2){const d=BD[r.inputs[i]];ins.push(`${d?.name||'?'}×${r.inputs[i+1]}`);}
      return`<div style="background:#050d05;border:1px solid #0a1a0a;padding:4px 6px;font-size:8px;color:#2a5a2a;line-height:1.7;cursor:help;" title="${ins.join(' + ')} → ${r.name}">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
          <div style="width:10px;height:10px;background:${col};flex-shrink:0;"></div>
          <span style="color:#a5d6a7;">${r.name}</span>
        </div>
        <div>${ins.join(' + ')}</div>
      </div>`;
    }).join('');
  }
}

let msgT2=null;
function showMsg(t,dur=800){const el=document.getElementById('msg');el.textContent=t;el.style.display='block';clearTimeout(msgT2);msgT2=setTimeout(()=>el.style.display='none',dur);}
function flashDmg(){const el=document.getElementById('dmgfx');el.style.background='rgba(200,0,0,0.38)';setTimeout(()=>el.style.background='',400);}
function respawn(){player.hp=player.maxHp;player.pos.copy(spawnPos);player.vel.set(0,0,0);player.flying=false;showMsg('You died!',2000);renderHUD();}

// ══════════════════════════════════════════════════

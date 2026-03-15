'use strict';
//  CHEST STORAGE
// ══════════════════════════════════════════════════
const chestData={}; // "x,y,z" -> array[27] of {type,count}
let openChestKey=null;

function openChest(x,y,z){
  const k=`${x},${y},${z}`;
  if(!chestData[k])chestData[k]=new Array(27).fill(null);
  openChestKey=k;
  renderChestUI(k);
  document.getElementById('chest-modal').style.display='flex';
  document.exitPointerLock();
}
function closeChest(){
  openChestKey=null;
  document.getElementById('chest-modal').style.display='none';
  saveChests();
  renderer.domElement.requestPointerLock();
}
function saveChests(){localStorage.setItem('vc_chests_'+curWorld,JSON.stringify(chestData));}
function loadChests(){
  const d=localStorage.getItem('vc_chests_'+curWorld);
  if(d){Object.assign(chestData,JSON.parse(d));}
}
function renderChestUI(k){
  const slots=chestData[k]||[];
  const grid=document.getElementById('chest-grid');
  grid.innerHTML='';
  for(let i=0;i<27;i++){
    const sl=slots[i];const el=document.createElement('div');
    el.className='isl';el.style.width='44px';el.style.height='44px';
    if(sl){
      const def=BD[sl.type];if(def){
        const T='#'+def.top.toString(16).padStart(6,'0'),S='#'+def.side.toString(16).padStart(6,'0');
        el.innerHTML=`<div class="ic" style="width:26px;height:26px"><div class="ict" style="background:${T}"></div><div class="ics" style="background:${S}"></div></div><div class="icn">${sl.count}</div>`;
        el.title=def.name;
      }
    }
    el.onclick=()=>{
      const h=held();
      if(h&&!sl){chestData[k][i]={type:h.type,count:1};invRem(selSlot);renderHotbar();renderChestUI(k);}
      else if(sl&&!h){invAdd(sl.type,sl.count);chestData[k][i]=null;renderHotbar();renderChestUI(k);}
      else if(h&&sl&&sl.type===h.type&&sl.count<64){sl.count++;invRem(selSlot);renderHotbar();renderChestUI(k);}
    };
    grid.appendChild(el);
  }
}

// ══════════════════════════════════════════════════

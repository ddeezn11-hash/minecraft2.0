'use strict';
//  HUNGER SYSTEM
// ══════════════════════════════════════════════════
let hunger=20,maxHunger=20,hungerT=0;
const FOOD_VALUES={[LEAF_PILE]:1,[LEAVES]:1};
function renderHunger(){
  const el=document.getElementById('hunger-bar');if(!el)return;
  let h='';
  for(let i=0;i<10;i++){const f=hunger>=(i+1)*2,hf=!f&&hunger>=i*2+1;h+=`<span style="font-size:13px;color:${f?'#FF9800':hf?'#FF9800':'#161616'};opacity:${f||hf?1:0.3}">🍗</span>`;}
  el.innerHTML=h;
}
function tickHunger(dt){
  if(gameMode==='creative')return;
  hungerT+=dt;
  if(hungerT>30){hungerT=0;hunger=Math.max(0,hunger-1);renderHunger();}
  // Starving: take damage
  if(hunger<=0&&wTime%4<dt){player.hp=Math.max(1,player.hp-1);renderHUD();}
  // Eating: right-click food items
}
function tryEat(){
  const h=held();if(!h)return false;
  const fv=FOOD_VALUES[h.type];if(!fv)return false;
  hunger=Math.min(maxHunger,hunger+fv);invRem(selSlot);renderHotbar();renderHunger();
  showMsg('Mmm... +'+fv+' hunger',500);return true;
}

// ══════════════════════════════════════════════════

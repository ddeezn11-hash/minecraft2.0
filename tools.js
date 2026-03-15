'use strict';
//  TOOL BONUSES (sword dmg, axe mine speed)
// ══════════════════════════════════════════════════
function getPlayerDmg(){
  const h=held();if(!h)return 3;
  return BD[h.type]?.dmgBonus??3;
}
function hasMineBonus(){return !!(BD[held()?.type]?.mineBonus);}

// ══════════════════════════════════════════════════

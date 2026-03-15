'use strict';
//  LOOP
// ══════════════════════════════════════════════════
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let lastT=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min((ts-lastT)/1000,0.05);lastT=ts;
  if(gameStarted)update(dt);
  if(gameStarted)renderer.render(scene,camera);
}

// ══════════════════════════════════════════════════

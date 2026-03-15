'use strict';
//  TORCH LIGHTS
// ══════════════════════════════════════════════════
const torchLights=new Map(); // "x,y,z" -> PointLight
function updateTorchLights(){
  // Add lights for newly placed torches near player
  const px=Math.floor(player.pos.x),py=Math.floor(player.pos.y),pz=Math.floor(player.pos.z);
  for(let dx=-6;dx<=6;dx++) for(let dy=-4;dy<=6;dy++) for(let dz=-6;dz<=6;dz++){
    const bx=px+dx,by=py+dy,bz=pz+dz;
    const k=`${bx},${by},${bz}`;
    if(getB(bx,by,bz)===TORCH&&!torchLights.has(k)){
      const light=new THREE.PointLight(0xFFAA33,1.8,10);
      light.position.set(bx+0.5,by+0.7,bz+0.5);
      scene.add(light);torchLights.set(k,light);
    }
  }
  // Flicker + remove lights for broken torches
  for(const [k,light] of torchLights){
    const [x,y,z]=k.split(',').map(Number);
    if(getB(x,y,z)!==TORCH){scene.remove(light);torchLights.delete(k);}
    else{light.intensity=1.6+Math.sin(Date.now()*0.008+x)*0.3;} // flicker
  }
}

// ══════════════════════════════════════════════════

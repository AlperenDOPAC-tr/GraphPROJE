import * as THREE from 'three';

export function getGroundTexture(repeatsX = 10, repeatsY = 10) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  
  // Dama tahtası deseni
  context.fillStyle = '#ffffff'; // Tam beyaz
  context.fillRect(0, 0, 512, 512);
  context.fillStyle = '#222222'; // Koyu gri / Siyah
  
  // Kareleri büyütmek için 8x8 yerine 4x4'lük bir grid çiziyoruz (512/4 = 128)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) {
        context.fillRect(i * 128, j * 128, 128, 128);
      }
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatsX, repeatsY);
  
  return texture;
}

export function getCubeTexture(colorHex = '#d81b60') {
  const t1 = document.createElement('canvas'); t1.width = 256; t1.height = 256; const ctx1 = t1.getContext('2d');
  ctx1.fillStyle = '#ffffff'; ctx1.fillRect(0,0,256,256);
  ctx1.fillStyle = colorHex;
  for(let i=0; i<8; i++) for(let j=0; j<8; j++) if((i+j)%2===0) ctx1.fillRect(i*32, j*32, 32, 32);
  const texCube = new THREE.CanvasTexture(t1); texCube.wrapS = texCube.wrapT = THREE.RepeatWrapping;
  return texCube;
}

export function getSphereTexture(colorHex = '#00acc1') {
  const t2 = document.createElement('canvas'); t2.width = 256; t2.height = 256; const ctx2 = t2.getContext('2d');
  ctx2.fillStyle = '#ffffff'; ctx2.fillRect(0,0,256,256);
  ctx2.fillStyle = colorHex;
  for(let i=16; i<256; i+=32) for(let j=16; j<256; j+=32) { ctx2.beginPath(); ctx2.arc(i,j,8,0,Math.PI*2); ctx2.fill(); }
  const texSphere = new THREE.CanvasTexture(t2); texSphere.wrapS = texSphere.wrapT = THREE.RepeatWrapping;
  return texSphere;
}

export function getTowerTexture() {
  const t3 = document.createElement('canvas'); t3.width = 256; t3.height = 256; const ctx3 = t3.getContext('2d');
  ctx3.fillStyle = '#8B4513'; ctx3.fillRect(0,0,256,256); // Kahverengi tuğla zemin
  ctx3.fillStyle = '#5c2e0b';
  for(let y=0; y<256; y+=32) {
    ctx3.fillRect(0, y, 256, 4); // Yatay derz
    const offsetX = (y / 32) % 2 === 0 ? 0 : 32;
    for(let x=0; x<256; x+=64) {
      ctx3.fillRect(x + offsetX, y, 4, 32); // Dikey derz
    }
  }
  const texTower = new THREE.CanvasTexture(t3); texTower.wrapS = texTower.wrapT = THREE.RepeatWrapping;
  texTower.repeat.set(1, 10);
  return texTower;
}

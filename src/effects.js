import * as THREE from 'three';

const POOL_SIZE = 12;
const LIFETIME = 0.4;
const START_SCALE = 0.6;
const END_SCALE = 4.0;
const SEGMENTS = 24;

function makeRing(color) {
  const positions = new Float32Array(SEGMENTS * 3);
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    positions[i * 3] = Math.cos(a);
    positions[i * 3 + 1] = Math.sin(a);
    positions[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.LineLoop(geo, mat);
  ring.visible = false;
  return ring;
}

export class EffectsPool {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const obj = makeRing(0xffaa33);
      scene.add(obj);
      this.list.push({ obj, ttl: 0, active: false });
    }
  }

  spawnHit(position, camera) {
    let target = null;
    for (const b of this.list) {
      if (!b.active) { target = b; break; }
    }
    if (!target) return;
    target.active = true;
    target.ttl = LIFETIME;
    target.obj.visible = true;
    target.obj.position.copy(position);
    // Billboard the ring to face the camera.
    target.obj.quaternion.copy(camera.quaternion);
    target.obj.scale.setScalar(START_SCALE);
    target.obj.material.opacity = 1;
  }

  update(dt) {
    for (const b of this.list) {
      if (!b.active) continue;
      b.ttl -= dt;
      if (b.ttl <= 0) {
        b.active = false;
        b.obj.visible = false;
        continue;
      }
      const t = 1 - b.ttl / LIFETIME;
      b.obj.scale.setScalar(START_SCALE + (END_SCALE - START_SCALE) * t);
      b.obj.material.opacity = 1 - t;
    }
  }

  reset() {
    for (const b of this.list) {
      b.active = false;
      b.obj.visible = false;
    }
  }
}

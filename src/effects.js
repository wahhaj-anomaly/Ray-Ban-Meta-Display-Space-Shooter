import * as THREE from 'three';

const POOL_SIZE = 14;
const SEGMENTS = 32;

function makeRing() {
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
    color: 0xffffff,
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
      const obj = makeRing();
      scene.add(obj);
      this.list.push({
        obj,
        ttl: 0,
        lifetime: 0,
        startScale: 0,
        endScale: 0,
        active: false,
      });
    }
  }

  _spawn(position, camera, color, startScale, endScale, lifetime) {
    let target = null;
    for (const b of this.list) {
      if (!b.active) { target = b; break; }
    }
    if (!target) return null;
    target.active = true;
    target.ttl = lifetime;
    target.lifetime = lifetime;
    target.startScale = startScale;
    target.endScale = endScale;
    target.obj.visible = true;
    target.obj.position.copy(position);
    target.obj.quaternion.copy(camera.quaternion);
    target.obj.scale.setScalar(startScale);
    target.obj.material.color.setHex(color);
    target.obj.material.opacity = 1;
    return target;
  }

  spawnHit(position, camera) {
    return this._spawn(position, camera, 0xffaa33, 0.6, 4.0, 0.4);
  }

  spawnBigHit(position, camera) {
    return this._spawn(position, camera, 0xff66aa, 1.0, 8.0, 0.6);
  }

  spawnPulse(position, camera) {
    return this._spawn(position, camera, 0x66ffff, 0.5, 50.0, 0.8);
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
      const t = 1 - b.ttl / b.lifetime;
      b.obj.scale.setScalar(b.startScale + (b.endScale - b.startScale) * t);
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

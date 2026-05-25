import * as THREE from 'three';

const PLAYER_SPEED = 60;
const PLAYER_LIFETIME = 2;
const ENEMY_SPEED = 20;
const ENEMY_LIFETIME = 4;
const PLAYER_POOL = 32;
const ENEMY_POOL = 64;
const PLAYER_HIT_RADIUS_SQ = 1.0;

const _dir = new THREE.Vector3();
const _v = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, -1);

function makeBullet(color, length, additive = false) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -length], 3)
  );
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  return line;
}

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.player = [];
    this.enemy = [];
    for (let i = 0; i < PLAYER_POOL; i++) {
      this.player.push({
        obj: this._add(makeBullet(0x66ff99, 5, true)),
        vel: new THREE.Vector3(),
        ttl: 0,
        active: false,
      });
    }
    for (let i = 0; i < ENEMY_POOL; i++) {
      this.enemy.push({
        obj: this._add(makeBullet(0xff33ff, 1.2)),
        vel: new THREE.Vector3(),
        ttl: 0,
        active: false,
      });
    }
  }

  _add(obj) {
    this.scene.add(obj);
    return obj;
  }

  _spawn(pool, origin, dir, speed, ttl) {
    for (const b of pool) {
      if (b.active) continue;
      b.active = true;
      b.ttl = ttl;
      b.obj.visible = true;
      b.obj.position.copy(origin);
      b.obj.quaternion.setFromUnitVectors(_forward, dir);
      b.vel.copy(dir).multiplyScalar(speed);
      return b;
    }
    return null;
  }

  spawnPlayer(camera) {
    camera.getWorldDirection(_dir);
    // Offset the spawn forward so the whole tracer is in front of the
    // near plane and visible immediately, not clipped against the camera.
    _origin.copy(camera.position).addScaledVector(_dir, 2);
    return this._spawn(
      this.player,
      _origin,
      _dir,
      PLAYER_SPEED,
      PLAYER_LIFETIME
    );
  }

  spawnEnemy(origin, targetPos, spreadDeg = 3) {
    _dir.copy(targetPos).sub(origin).normalize();
    if (spreadDeg > 0) {
      const r = (spreadDeg * Math.PI) / 180;
      _v.set(
        (Math.random() - 0.5) * 2 * r,
        (Math.random() - 0.5) * 2 * r,
        (Math.random() - 0.5) * 2 * r
      );
      _dir.add(_v).normalize();
    }
    return this._spawn(this.enemy, origin, _dir, ENEMY_SPEED, ENEMY_LIFETIME);
  }

  update(dt, onPlayerHit) {
    for (const b of this.player) {
      if (!b.active) continue;
      b.obj.position.addScaledVector(b.vel, dt);
      b.ttl -= dt;
      if (b.ttl <= 0) this._retire(b);
    }
    for (const b of this.enemy) {
      if (!b.active) continue;
      b.obj.position.addScaledVector(b.vel, dt);
      b.ttl -= dt;
      if (b.obj.position.lengthSq() < PLAYER_HIT_RADIUS_SQ) {
        this._retire(b);
        onPlayerHit();
        continue;
      }
      if (b.ttl <= 0) this._retire(b);
    }
  }

  _retire(b) {
    b.active = false;
    b.obj.visible = false;
  }

  reset() {
    for (const b of this.player) this._retire(b);
    for (const b of this.enemy) this._retire(b);
  }
}

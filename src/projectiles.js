import * as THREE from 'three';

const ENEMY_SPEED = 20;
const ENEMY_LIFETIME = 4;
const ENEMY_POOL = 64;
const TRACER_POOL = 24;
const TRACER_LIFETIME = 0.22;
const TRACER_MAX_RANGE = 100;
const PLAYER_HIT_RADIUS_SQ = 1.0;

// --- Enemy bullet size / hitbox tuning ---------------------------------
// Base radius the player's shot must pass within to destroy a bullet.
const ENEMY_BULLET_HIT_RADIUS = 0.6;
// A fraction of bullets spawn larger, with a proportionally bigger hitbox.
const BIG_BULLET_CHANCE = 0.3;
const BIG_BULLET_SCALE = 1.7;
// -----------------------------------------------------------------------

const _dir = new THREE.Vector3();
const _v = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, -1);

function makeEnemyBullet(color, length) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -length], 3)
  );
  const mat = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  return line;
}

function makeTracer() {
  // Unit-length tracer; scale.z is set per spawn to match hit distance.
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
  );
  const mat = new THREE.LineBasicMaterial({
    color: 0xaaffaa,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  return line;
}

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.tracer = [];
    this.enemy = [];
    for (let i = 0; i < TRACER_POOL; i++) {
      this.tracer.push({
        obj: this._add(makeTracer()),
        ttl: 0,
        active: false,
      });
    }
    for (let i = 0; i < ENEMY_POOL; i++) {
      this.enemy.push({
        obj: this._add(makeEnemyBullet(0xff33ff, 1.2)),
        vel: new THREE.Vector3(),
        ttl: 0,
        active: false,
        hitRadius: ENEMY_BULLET_HIT_RADIUS,
      });
    }
  }

  _add(obj) {
    this.scene.add(obj);
    return obj;
  }

  _spawnEnemyBullet(origin, dir, speed, ttl) {
    for (const b of this.enemy) {
      if (b.active) continue;
      b.active = true;
      b.ttl = ttl;
      const big = Math.random() < BIG_BULLET_CHANCE;
      const scale = big ? BIG_BULLET_SCALE : 1;
      b.obj.scale.setScalar(scale);
      b.hitRadius = ENEMY_BULLET_HIT_RADIUS * scale;
      b.obj.visible = true;
      b.obj.position.copy(origin);
      b.obj.quaternion.setFromUnitVectors(_forward, dir);
      b.vel.copy(dir).multiplyScalar(speed);
      return b;
    }
    return null;
  }

  // Returns the nearest active enemy bullet the ray passes within hitRadius
  // of, up to maxDist, or null. Used so player shots can destroy bullets.
  raycastEnemyBullet(ray, maxDist = TRACER_MAX_RANGE) {
    let nearest = null;
    let nearestDist = maxDist;
    for (const b of this.enemy) {
      if (!b.active) continue;
      const dist = ray.origin.distanceTo(b.obj.position);
      if (dist > nearestDist) continue;
      if (ray.distanceToPoint(b.obj.position) <= b.hitRadius) {
        nearest = b;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  destroyEnemyBullet(b) {
    this._retireBullet(b);
  }

  spawnTracer(origin, dir, length) {
    for (const t of this.tracer) {
      if (t.active) continue;
      t.active = true;
      t.ttl = TRACER_LIFETIME;
      t.obj.visible = true;
      t.obj.position.copy(origin);
      t.obj.quaternion.setFromUnitVectors(_forward, dir);
      t.obj.scale.set(1, 1, Math.max(1, length));
      t.obj.material.opacity = 1;
      return t;
    }
    return null;
  }

  spawnPlayer(camera, hitDist = TRACER_MAX_RANGE) {
    camera.getWorldDirection(_dir);
    _origin.copy(camera.position).addScaledVector(_dir, 0.5);
    return this.spawnTracer(_origin, _dir, hitDist);
  }

  spawnPlayerInDirection(camera, dir, hitDist = TRACER_MAX_RANGE) {
    _origin.copy(camera.position).addScaledVector(dir, 0.5);
    return this.spawnTracer(_origin, dir, hitDist);
  }

  spawnEnemy(origin, targetPos, spreadDeg = 3, speed = ENEMY_SPEED) {
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
    return this._spawnEnemyBullet(origin, _dir, speed, ENEMY_LIFETIME);
  }

  update(dt, onPlayerHit) {
    for (const t of this.tracer) {
      if (!t.active) continue;
      t.ttl -= dt;
      if (t.ttl <= 0) {
        this._retireTracer(t);
        continue;
      }
      t.obj.material.opacity = t.ttl / TRACER_LIFETIME;
    }
    for (const b of this.enemy) {
      if (!b.active) continue;
      b.obj.position.addScaledVector(b.vel, dt);
      b.ttl -= dt;
      if (b.obj.position.lengthSq() < PLAYER_HIT_RADIUS_SQ) {
        this._retireBullet(b);
        onPlayerHit();
        continue;
      }
      if (b.ttl <= 0) this._retireBullet(b);
    }
  }

  _retireTracer(t) {
    t.active = false;
    t.obj.visible = false;
  }

  _retireBullet(b) {
    b.active = false;
    b.obj.visible = false;
  }

  reset() {
    for (const t of this.tracer) this._retireTracer(t);
    for (const b of this.enemy) this._retireBullet(b);
  }
}

import * as THREE from 'three';

const SPAWN_RADIUS = 40;
const COLLISION_DIST_SQ = 2.0 * 2.0;
const FORWARD_AVOID_COS = Math.cos((30 * Math.PI) / 180);
const DEG = Math.PI / 180;

const SNIPER_HOLD_DIST_SQ = 20 * 20;
const SNIPER_CHARGE_DURATION = 0.3;
const BOSS_ORBIT_DIST = 25;
const BOSS_CHARGE_DURATION = 0.4;
const BOSS_FAN_DEG = 10;
const BOSS_FAN_COUNT = 3;

const _forward = new THREE.Vector3();
const _toCenter = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

function makeDrifterMesh() {
  const geo = new THREE.OctahedronGeometry(0.6);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xff3366 });
  const mesh = new THREE.LineSegments(edges, mat);
  return { mesh, materials: [mat] };
}

function makeSniperMesh() {
  const geo = new THREE.OctahedronGeometry(0.8);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xffaa33 });
  const mesh = new THREE.LineSegments(edges, mat);
  mesh.scale.set(0.7, 1.4, 0.7);
  return { mesh, materials: [mat] };
}

function makeSwarmerMesh() {
  const geo = new THREE.TetrahedronGeometry(0.4);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xff44aa });
  const mesh = new THREE.LineSegments(edges, mat);
  return { mesh, materials: [mat] };
}

function makeBossMesh() {
  const group = new THREE.Group();
  const outerGeo = new THREE.DodecahedronGeometry(1.8);
  const outerEdges = new THREE.EdgesGeometry(outerGeo);
  const outerMat = new THREE.LineBasicMaterial({ color: 0xff0033 });
  const outer = new THREE.LineSegments(outerEdges, outerMat);
  const innerGeo = new THREE.IcosahedronGeometry(1.0);
  const innerEdges = new THREE.EdgesGeometry(innerGeo);
  const innerMat = new THREE.LineBasicMaterial({ color: 0xff0033 });
  const inner = new THREE.LineSegments(innerEdges, innerMat);
  group.add(outer);
  group.add(inner);
  return { mesh: group, materials: [outerMat, innerMat], outer, inner };
}

const TYPE_DEFS = {
  drifter: {
    hp: 2,
    radius: 0.8,
    baseColor: 0xff3366,
    make: makeDrifterMesh,
  },
  sniper: {
    hp: 3,
    radius: 0.9,
    baseColor: 0xffaa33,
    make: makeSniperMesh,
  },
  swarmer: {
    hp: 1,
    radius: 0.5,
    baseColor: 0xff44aa,
    make: makeSwarmerMesh,
  },
  boss: {
    hp: 15,
    radius: 2.2,
    baseColor: 0xff0033,
    make: makeBossMesh,
  },
};

const POOL_SIZES = {
  drifter: 20,
  sniper: 6,
  swarmer: 12,
  boss: 1,
};

function jitterDirection(dir, jitterDeg) {
  const r = jitterDeg * DEG;
  _right.crossVectors(dir, _up).normalize();
  if (_right.lengthSq() < 0.001) _right.set(1, 0, 0);
  dir.applyAxisAngle(_up, (Math.random() - 0.5) * 2 * r);
  dir.applyAxisAngle(_right, (Math.random() - 0.5) * 2 * r);
  dir.normalize();
  return dir;
}

export class EnemyPool {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (const type of Object.keys(TYPE_DEFS)) {
      const def = TYPE_DEFS[type];
      for (let i = 0; i < POOL_SIZES[type]; i++) {
        const built = def.make();
        built.mesh.visible = false;
        scene.add(built.mesh);
        this.list.push({
          type,
          obj: built.mesh,
          materials: built.materials,
          radius: def.radius,
          baseColor: def.baseColor,
          active: false,
          hp: 0,
          maxHp: 0,
          speed: 0,
          fireInterval: 0,
          fireTimer: 0,
          chargeTimer: 0,
          telegraphed: false,
          hitFlashTimer: 0,
          orbitAngle: 0,
          orbitSpeed: 0,
        });
      }
    }
  }

  countActive() {
    let n = 0;
    for (const e of this.list) if (e.active) n++;
    return n;
  }

  countActiveNonBoss() {
    let n = 0;
    for (const e of this.list) if (e.active && e.type !== 'boss') n++;
    return n;
  }

  getBoss() {
    for (const e of this.list) if (e.active && e.type === 'boss') return e;
    return null;
  }

  spawn(type, wave, camera, dirHint = null) {
    let target = null;
    for (const e of this.list) {
      if (e.type === type && !e.active) { target = e; break; }
    }
    if (!target) return null;

    const dir = new THREE.Vector3();
    if (dirHint) {
      dir.copy(dirHint);
      jitterDirection(dir, 15);
    } else {
      camera.getWorldDirection(_forward);
      for (let i = 0; i < 8; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        dir.set(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        );
        if (dir.dot(_forward) < FORWARD_AVOID_COS) break;
      }
    }

    const def = TYPE_DEFS[type];
    target.obj.position.copy(dir).multiplyScalar(
      type === 'boss' ? BOSS_ORBIT_DIST : SPAWN_RADIUS
    );
    target.obj.visible = true;
    target.active = true;
    target.telegraphed = false;
    target.chargeTimer = 0;

    if (type === 'drifter') {
      target.hp = def.hp;
      target.maxHp = def.hp;
      target.speed = 1.5 + wave * 0.2;
      target.fireInterval = Math.max(0.6, 2 - wave * 0.05);
    } else if (type === 'sniper') {
      target.hp = def.hp;
      target.maxHp = def.hp;
      target.speed = 1.2;
      target.fireInterval = 1.2;
    } else if (type === 'swarmer') {
      target.hp = def.hp;
      target.maxHp = def.hp;
      target.speed = 3.5 + wave * 0.2;
      target.fireInterval = 0;
    } else if (type === 'boss') {
      const bossHp = 10 + Math.floor(wave / 5) * 5;
      target.hp = bossHp;
      target.maxHp = bossHp;
      target.speed = 0;
      target.fireInterval = 1.8;
      target.orbitAngle = Math.atan2(dir.x, dir.z);
      target.orbitSpeed = (Math.random() < 0.5 ? -1 : 1) * 0.3;
    }
    target.fireTimer = target.fireInterval > 0
      ? target.fireInterval * (0.5 + Math.random() * 0.5)
      : 0;

    this._setColor(target, target.baseColor);
    return target;
  }

  _setColor(e, hex) {
    for (const m of e.materials) m.color.setHex(hex);
  }

  update(dt, projectiles, onPlayerHit) {
    for (const e of this.list) {
      if (!e.active) continue;
      if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
      if (e.type === 'drifter' || e.type === 'swarmer') {
        this._updateDrifter(e, dt, projectiles, onPlayerHit);
      } else if (e.type === 'sniper') {
        this._updateSniper(e, dt, projectiles, onPlayerHit);
      } else if (e.type === 'boss') {
        this._updateBoss(e, dt, projectiles);
      }
      if (!e.active) continue;
      this._refreshColor(e);
    }
  }

  _refreshColor(e) {
    const white = e.hitFlashTimer > 0 || e.telegraphed;
    this._setColor(e, white ? 0xffffff : e.baseColor);
  }

  _updateDrifter(e, dt, projectiles, onPlayerHit) {
    _toCenter.copy(e.obj.position).negate().normalize();
    e.obj.position.addScaledVector(_toCenter, e.speed * dt);
    e.obj.rotation.x += dt * 0.8;
    e.obj.rotation.y += dt * 0.6;

    if (e.obj.position.lengthSq() < COLLISION_DIST_SQ) {
      this.kill(e);
      onPlayerHit(10);
      return;
    }

    if (e.fireInterval > 0) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireInterval;
        projectiles.spawnEnemy(e.obj.position, _origin);
      }
    }
  }

  _updateSniper(e, dt, projectiles, onPlayerHit) {
    e.obj.rotation.y += dt * 0.5;
    e.obj.rotation.z += dt * 0.3;

    if (e.obj.position.lengthSq() > SNIPER_HOLD_DIST_SQ) {
      _toCenter.copy(e.obj.position).negate().normalize();
      e.obj.position.addScaledVector(_toCenter, e.speed * dt);
    }

    if (e.obj.position.lengthSq() < COLLISION_DIST_SQ) {
      this.kill(e);
      onPlayerHit(10);
      return;
    }

    e.fireTimer -= dt;
    e.telegraphed = e.fireTimer <= SNIPER_CHARGE_DURATION;
    if (e.fireTimer <= 0) {
      projectiles.spawnEnemy(e.obj.position, _origin, 1, 12);
      e.fireTimer = e.fireInterval;
      e.telegraphed = false;
    }
  }

  _updateBoss(e, dt, projectiles) {
    e.orbitAngle += e.orbitSpeed * dt;
    e.obj.position.set(
      Math.cos(e.orbitAngle) * BOSS_ORBIT_DIST,
      0,
      Math.sin(e.orbitAngle) * BOSS_ORBIT_DIST
    );
    if (e.materials.length >= 2) {
      e.obj.children[0].rotation.x += dt * 0.4;
      e.obj.children[0].rotation.y += dt * 0.6;
      e.obj.children[1].rotation.x -= dt * 0.8;
      e.obj.children[1].rotation.z += dt * 0.7;
    }

    e.fireTimer -= dt;
    e.telegraphed = e.fireTimer <= BOSS_CHARGE_DURATION;
    if (e.fireTimer <= 0) {
      this._fireFan(e, projectiles);
      e.fireTimer = e.fireInterval;
      e.telegraphed = false;
    }
  }

  _fireFan(e, projectiles) {
    const baseDir = new THREE.Vector3()
      .copy(_origin)
      .sub(e.obj.position)
      .normalize();
    for (let i = 0; i < BOSS_FAN_COUNT; i++) {
      const t = BOSS_FAN_COUNT === 1 ? 0 : i / (BOSS_FAN_COUNT - 1) - 0.5;
      const dir = baseDir.clone().applyAxisAngle(_up, t * BOSS_FAN_DEG * DEG);
      const aim = new THREE.Vector3()
        .copy(e.obj.position)
        .addScaledVector(dir, 10);
      projectiles.spawnEnemy(e.obj.position, aim, 0);
    }
  }

  raycastHit(ray, maxDist = 100) {
    let nearest = null;
    let nearestDist = maxDist;
    for (const e of this.list) {
      if (!e.active) continue;
      const dist = ray.origin.distanceTo(e.obj.position);
      if (dist > nearestDist) continue;
      const distToRay = ray.distanceToPoint(e.obj.position);
      if (distToRay <= e.radius) {
        nearest = e;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  damage(enemy, amount = 1) {
    enemy.hp -= amount;
    if (enemy.hp > 0) enemy.hitFlashTimer = 0.08;
    return enemy.hp <= 0;
  }

  killAllNonBoss(callback) {
    for (const e of this.list) {
      if (!e.active || e.type === 'boss') continue;
      const slot = e;
      this.kill(slot);
      if (callback) callback(slot);
    }
  }

  kill(enemy) {
    enemy.active = false;
    enemy.obj.visible = false;
  }

  reset() {
    for (const e of this.list) this.kill(e);
  }
}

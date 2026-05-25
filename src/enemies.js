import * as THREE from 'three';

const SPAWN_RADIUS = 40;
const POOL_SIZE = 30;
const COLLISION_DIST_SQ = 2.0 * 2.0;
const FORWARD_AVOID_COS = Math.cos((30 * Math.PI) / 180);
const ENEMY_RADIUS = 0.8;

const _forward = new THREE.Vector3();
const _toCenter = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

function makeEnemyMesh() {
  const geo = new THREE.OctahedronGeometry(0.6);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({ color: 0xff3366 });
  const mesh = new THREE.LineSegments(edges, mat);
  mesh.visible = false;
  return mesh;
}

export class EnemyPool {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const obj = makeEnemyMesh();
      scene.add(obj);
      this.list.push({
        obj,
        active: false,
        speed: 0,
        fireInterval: 0,
        fireTimer: 0,
      });
    }
  }

  countActive() {
    let n = 0;
    for (const e of this.list) if (e.active) n++;
    return n;
  }

  spawn(wave, camera) {
    let target = null;
    for (const e of this.list) {
      if (!e.active) { target = e; break; }
    }
    if (!target) return null;

    camera.getWorldDirection(_forward);
    const dir = new THREE.Vector3();
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
    target.obj.position.copy(dir).multiplyScalar(SPAWN_RADIUS);
    target.obj.visible = true;
    target.active = true;
    target.speed = 1.5 + wave * 0.2;
    target.fireInterval = Math.max(0.6, 2 - wave * 0.05);
    target.fireTimer = target.fireInterval * (0.5 + Math.random() * 0.5);
    return target;
  }

  update(dt, projectiles, onPlayerHit) {
    for (const e of this.list) {
      if (!e.active) continue;

      _toCenter.copy(e.obj.position).negate().normalize();
      e.obj.position.addScaledVector(_toCenter, e.speed * dt);
      e.obj.rotation.x += dt * 0.8;
      e.obj.rotation.y += dt * 0.6;

      if (e.obj.position.lengthSq() < COLLISION_DIST_SQ) {
        this.kill(e);
        onPlayerHit(10);
        continue;
      }

      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireInterval;
        projectiles.spawnEnemy(e.obj.position, _origin);
      }
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
      if (distToRay <= ENEMY_RADIUS) {
        nearest = e;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  kill(enemy) {
    enemy.active = false;
    enemy.obj.visible = false;
  }

  reset() {
    for (const e of this.list) this.kill(e);
  }
}

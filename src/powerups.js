import * as THREE from 'three';

const LIFETIME = 10;
const FADE_TAIL = 1;
const COLLECT_TIME = 0.6;
const COLLECT_RADIUS_DEG = 5;
const _v = new THREE.Vector3();

const TYPE_DEFS = {
  shield: {
    color: 0x44aaff,
    radius: 0.7,
    make: () => {
      const geo = new THREE.IcosahedronGeometry(0.6);
      return new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color: 0x44aaff,
          transparent: true,
          blending: THREE.AdditiveBlending,
        })
      );
    },
  },
  multishot: {
    color: 0xffdd33,
    radius: 0.7,
    make: () => {
      const geo = new THREE.TetrahedronGeometry(0.75);
      return new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color: 0xffdd33,
          transparent: true,
          blending: THREE.AdditiveBlending,
        })
      );
    },
  },
  pulse: {
    color: 0x66ffff,
    radius: 0.7,
    make: () => {
      const group = new THREE.Group();
      const inner = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.5)),
        new THREE.LineBasicMaterial({
          color: 0x66ffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
        })
      );
      const outer = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.9)),
        new THREE.LineBasicMaterial({
          color: 0x66ffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
        })
      );
      group.add(inner);
      group.add(outer);
      return group;
    },
  },
};

const POOL_SIZE_PER_TYPE = 6;
const TYPE_NAMES = Object.keys(TYPE_DEFS);

export function randomPowerupType() {
  return TYPE_NAMES[Math.floor(Math.random() * TYPE_NAMES.length)];
}

function getMaterials(obj) {
  if (obj.material) return [obj.material];
  const list = [];
  obj.traverse((child) => {
    if (child.material) list.push(child.material);
  });
  return list;
}

export class PowerupPool {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (const type of TYPE_NAMES) {
      const def = TYPE_DEFS[type];
      for (let i = 0; i < POOL_SIZE_PER_TYPE; i++) {
        const obj = def.make();
        obj.visible = false;
        scene.add(obj);
        this.list.push({
          type,
          obj,
          materials: getMaterials(obj),
          radius: def.radius,
          color: def.color,
          active: false,
          lifetime: 0,
          hoverTimer: 0,
        });
      }
    }
    this.currentHover = null;
  }

  spawn(type, position) {
    let target = null;
    for (const p of this.list) {
      if (p.type === type && !p.active) { target = p; break; }
    }
    if (!target) return null;
    target.active = true;
    target.lifetime = LIFETIME;
    target.hoverTimer = 0;
    target.obj.visible = true;
    target.obj.position.copy(position);
    target.obj.rotation.set(0, 0, 0);
    for (const m of target.materials) m.opacity = 1;
    return target;
  }

  _aimedAt(ray) {
    let nearest = null;
    let nearestDist = Infinity;
    const tanLimit = Math.tan(COLLECT_RADIUS_DEG * Math.PI / 180);
    for (const p of this.list) {
      if (!p.active) continue;
      const dist = ray.origin.distanceTo(p.obj.position);
      const distToRay = ray.distanceToPoint(p.obj.position);
      // Angular threshold: keep collection radius proportional to distance.
      const allowed = Math.max(p.radius, tanLimit * dist);
      if (distToRay <= allowed && dist < nearestDist) {
        nearest = p;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  update(dt, ray, onCollect) {
    const target = ray ? this._aimedAt(ray) : null;
    this.currentHover = null;

    for (const p of this.list) {
      if (!p.active) continue;

      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        this.kill(p);
        continue;
      }

      p.obj.rotation.y += dt * 0.8;
      p.obj.rotation.x += dt * 0.3;

      // Fade out in the last FADE_TAIL seconds
      const opacity = p.lifetime < FADE_TAIL ? p.lifetime / FADE_TAIL : 1;
      for (const m of p.materials) m.opacity = opacity;

      if (p === target) {
        p.hoverTimer += dt;
        this.currentHover = p;
        if (p.hoverTimer >= COLLECT_TIME) {
          const type = p.type;
          this.kill(p);
          if (onCollect) onCollect(type);
        }
      } else {
        p.hoverTimer = 0;
      }
    }
  }

  getCollectionProgress() {
    if (!this.currentHover) return null;
    return {
      type: this.currentHover.type,
      color: this.currentHover.color,
      progress: Math.min(1, this.currentHover.hoverTimer / COLLECT_TIME),
    };
  }

  kill(p) {
    p.active = false;
    p.obj.visible = false;
    p.hoverTimer = 0;
  }

  reset() {
    for (const p of this.list) this.kill(p);
    this.currentHover = null;
  }
}

import * as THREE from 'three';

const SPAWN_INTERVAL = 0.3;
const WAVE_BREAK = 2.0;
const BOSS_EVERY = 5;

const _dir = new THREE.Vector3();

function randomDirection() {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
}

export class Waves {
  constructor(enemies) {
    this.enemies = enemies;
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.breakTimer = 0;
    this.state = 'break';
  }

  reset() {
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.breakTimer = WAVE_BREAK;
    this.state = 'break';
    this.enemies.reset();
  }

  current() {
    return this.wave;
  }

  isBossWave(w = this.wave) {
    return w > 0 && w % BOSS_EVERY === 0;
  }

  _compose(wave) {
    if (this.isBossWave(wave)) return [{ type: 'boss' }];

    const queue = [];

    // Snipers (introduced once we've passed the first boss wave)
    if (wave >= 6) {
      const snipers = Math.min(3, 1 + Math.floor((wave - 6) / 3));
      for (let i = 0; i < snipers; i++) queue.push({ type: 'sniper' });
    }

    // Drifters scale with the wave number.
    const drifterCount = Math.max(
      1,
      wave + 2 - (wave >= 3 ? 4 : 0) - (wave >= 6 ? 1 : 0)
    );
    for (let i = 0; i < drifterCount; i++) queue.push({ type: 'drifter' });

    // Swarmer cluster (same incoming direction)
    if (wave >= 3) {
      const dir = randomDirection();
      const clusterSize = Math.min(5, 3 + Math.floor((wave - 3) / 2));
      for (let i = 0; i < clusterSize; i++) {
        queue.push({ type: 'swarmer', dir });
      }
    }

    return queue;
  }

  update(dt, camera) {
    if (this.state === 'break') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) {
        this.wave += 1;
        this.queue = this._compose(this.wave);
        this.spawnTimer = 0;
        this.state = 'spawning';
      }
      return;
    }
    if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      while (this.queue.length > 0 && this.spawnTimer <= 0) {
        const entry = this.queue.shift();
        this.enemies.spawn(entry.type, this.wave, camera, entry.dir || null);
        this.spawnTimer += SPAWN_INTERVAL;
      }
      if (this.queue.length === 0) this.state = 'fighting';
    }
    if (this.state === 'fighting') {
      if (this.enemies.countActive() === 0) {
        this.state = 'break';
        this.breakTimer = WAVE_BREAK;
      }
    }
  }
}

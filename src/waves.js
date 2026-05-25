const SPAWN_INTERVAL = 0.3;
const WAVE_BREAK = 2.0;

export class Waves {
  constructor(enemies) {
    this.enemies = enemies;
    this.wave = 0;
    this.pending = 0;
    this.spawnTimer = 0;
    this.breakTimer = 0;
    this.state = 'break';
  }

  reset() {
    this.wave = 0;
    this.pending = 0;
    this.spawnTimer = 0;
    this.breakTimer = WAVE_BREAK;
    this.state = 'break';
    this.enemies.reset();
  }

  current() {
    return this.wave;
  }

  update(dt, camera) {
    if (this.state === 'break') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) {
        this.wave += 1;
        this.pending = this.wave + 2;
        this.spawnTimer = 0;
        this.state = 'spawning';
      }
      return;
    }
    if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      while (this.pending > 0 && this.spawnTimer <= 0) {
        this.enemies.spawn(this.wave, camera);
        this.pending -= 1;
        this.spawnTimer += SPAWN_INTERVAL;
      }
      if (this.pending === 0) this.state = 'fighting';
    }
    if (this.state === 'fighting') {
      if (this.enemies.countActive() === 0) {
        this.state = 'break';
        this.breakTimer = WAVE_BREAK;
      }
    }
  }
}

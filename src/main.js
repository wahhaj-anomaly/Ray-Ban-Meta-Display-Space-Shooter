import * as THREE from 'three';
import {
  initInput,
  requestOrientationPermission,
  getAimQuaternion,
  updateInput,
  firePressedThisFrame,
  backPressedThisFrame,
  endFrame,
} from './input.js';
import { EnemyPool } from './enemies.js';
import { ProjectilePool } from './projectiles.js';
import { EffectsPool } from './effects.js';
import { PowerupPool, randomPowerupType } from './powerups.js';
import { Waves } from './waves.js';
import {
  initHud,
  setScore,
  setWave,
  setHp,
  showMenu,
  showGameOver,
  showCrosshair,
  drawEnemyIndicators,
  drawCollectionProgress,
  flashHit,
  flashWin,
  pulseCrosshair,
  getStartButton,
  getRetryButton,
} from './hud.js';
import {
  initAudio,
  playLaser,
  playExplosion,
  playHit,
  playChime,
  playBossDeath,
} from './audio.js';
import { getHighScore, setHighScore } from './storage.js';

const MAX_HP = 100;
const STATE = { MENU: 0, PLAYING: 1, GAME_OVER: 2 };
const SCORE_KILL = 100;
const SCORE_BOSS = 500;
const POWERUP_DROP_CHANCE = 0.2;
const BOSS_DROPS = 3;
const SHIELD_HEAL = 30;
const MULTISHOT_CHARGES = 10;
const MULTISHOT_NDC_OFFSET = 0.08;

let renderer, scene, camera;
let enemies, projectiles, effects, powerups, waves;
let state = STATE.MENU;
let score = 0;
let hp = MAX_HP;
let multishotCharges = 0;
let highScore = 0;
let lastTime = 0;

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const _ndcL = new THREE.Vector2(-MULTISHOT_NDC_OFFSET, 0);
const _ndcR = new THREE.Vector2(MULTISHOT_NDC_OFFSET, 0);
const _dir = new THREE.Vector3();
const _powerupDropOffset = new THREE.Vector3();

function init() {
  const canvas = document.getElementById('game');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(600, 600, false);
  renderer.setClearColor(0x000000, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

  addStarfield(scene);

  enemies = new EnemyPool(scene);
  projectiles = new ProjectilePool(scene);
  effects = new EffectsPool(scene);
  powerups = new PowerupPool(scene);
  waves = new Waves(enemies);

  initInput();
  initHud();
  highScore = getHighScore();

  setScore(0);
  setWave(0);
  setHp(MAX_HP, MAX_HP);
  showMenu(true);

  getStartButton().addEventListener('click', onStart);
  getRetryButton().addEventListener('click', startGame);

  requestAnimationFrame(loop);
}

function addStarfield(scene) {
  scene.add(makeStarLayer(120, 3, 0xffffff));
  scene.add(makeStarLayer(400, 2, 0xaaccff));
  scene.add(makeStarLayer(600, 1, 0x6688bb));
}

function makeStarLayer(count, size, color) {
  const positions = new Float32Array(count * 3);
  const r = 300;
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: false,
  });
  return new THREE.Points(geo, mat);
}

async function onStart() {
  initAudio();
  await requestOrientationPermission();
  startGame();
}

function startGame() {
  score = 0;
  hp = MAX_HP;
  multishotCharges = 0;
  setScore(0);
  setHp(hp, MAX_HP);
  waves.reset();
  projectiles.reset();
  effects.reset();
  powerups.reset();
  showMenu(false);
  showGameOver(false);
  showCrosshair(true);
  state = STATE.PLAYING;
}

function onPlayerDamage(amount) {
  if (state !== STATE.PLAYING) return;
  hp -= amount;
  setHp(hp, MAX_HP);
  flashHit();
  playHit();
  if (hp <= 0) gameOver();
}

function applyPowerup(type) {
  playChime();
  if (type === 'shield') {
    hp = Math.min(MAX_HP, hp + SHIELD_HEAL);
    setHp(hp, MAX_HP);
  } else if (type === 'multishot') {
    multishotCharges += MULTISHOT_CHARGES;
  } else if (type === 'pulse') {
    effects.spawnPulse(new THREE.Vector3(0, 0, 0), camera);
    enemies.killAllNonBoss((slot) => {
      effects.spawnHit(slot.obj.position, camera);
      score += SCORE_KILL;
    });
    setScore(score);
    playExplosion();
  }
}

function maybeDropPowerup(position) {
  if (Math.random() > POWERUP_DROP_CHANCE) return;
  const type = randomPowerupType();
  powerups.spawn(type, position);
}

function dropBossPowerups(position) {
  for (let i = 0; i < BOSS_DROPS; i++) {
    _powerupDropOffset.set(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 6
    );
    _powerupDropOffset.add(position);
    powerups.spawn(randomPowerupType(), _powerupDropOffset);
  }
}

function handleHit(hit) {
  if (!hit) return;
  const wasBoss = hit.type === 'boss';
  const killed = enemies.damage(hit, 1);
  if (killed) {
    effects.spawnHit(hit.obj.position, camera);
    const pos = hit.obj.position.clone();
    enemies.kill(hit);
    if (wasBoss) {
      effects.spawnBigHit(pos, camera);
      flashWin();
      dropBossPowerups(pos);
      playBossDeath();
      score += SCORE_BOSS;
      setScore(score);
    } else {
      score += SCORE_KILL;
      setScore(score);
      playExplosion();
      maybeDropPowerup(pos);
    }
  }
}

function fire() {
  playLaser();
  pulseCrosshair();

  if (multishotCharges > 0) {
    multishotCharges -= 1;
    raycaster.setFromCamera(_ndcL, camera);
    const hitL = enemies.raycastHit(raycaster.ray, 100);
    _dir.copy(raycaster.ray.direction);
    projectiles.spawnPlayerInDirection(camera, _dir);
    handleHit(hitL);

    raycaster.setFromCamera(screenCenter, camera);
    const hitC = enemies.raycastHit(raycaster.ray, 100);
    _dir.copy(raycaster.ray.direction);
    projectiles.spawnPlayerInDirection(camera, _dir);
    handleHit(hitC);

    raycaster.setFromCamera(_ndcR, camera);
    const hitR = enemies.raycastHit(raycaster.ray, 100);
    _dir.copy(raycaster.ray.direction);
    projectiles.spawnPlayerInDirection(camera, _dir);
    handleHit(hitR);
  } else {
    raycaster.setFromCamera(screenCenter, camera);
    const hit = enemies.raycastHit(raycaster.ray, 100);
    projectiles.spawnPlayer(camera);
    handleHit(hit);
  }
}

function gameOver() {
  state = STATE.GAME_OVER;
  if (score > highScore) {
    highScore = score;
    setHighScore(highScore);
  }
  showCrosshair(false);
  showGameOver(true, score, highScore);
}

function updateWaveLabel() {
  if (waves.isBossWave()) {
    const boss = enemies.getBoss();
    if (boss) {
      setWave(`${waves.current()} — BOSS ${Math.max(0, boss.hp)}/${boss.maxHp}`);
      return;
    }
  }
  setWave(`${waves.current()}`);
}

function loop(t) {
  requestAnimationFrame(loop);
  const dt = lastTime ? Math.min(0.05, (t - lastTime) / 1000) : 0;
  lastTime = t;

  updateInput(dt);

  if (state === STATE.PLAYING) {
    getAimQuaternion(camera.quaternion);
    waves.update(dt, camera);
    enemies.update(dt, projectiles, onPlayerDamage);
    projectiles.update(dt, () => onPlayerDamage(10));
    effects.update(dt);

    raycaster.setFromCamera(screenCenter, camera);
    powerups.update(dt, raycaster.ray, applyPowerup);

    if (firePressedThisFrame()) fire();

    updateWaveLabel();
  } else if (state === STATE.GAME_OVER) {
    if (backPressedThisFrame()) {
      showGameOver(false);
      showMenu(true);
      state = STATE.MENU;
    }
  }

  renderer.render(scene, camera);
  drawEnemyIndicators(state === STATE.PLAYING ? enemies.list : null, camera);
  if (state === STATE.PLAYING) {
    const collection = powerups.getCollectionProgress();
    if (collection) {
      drawCollectionProgress(
        collection.progress,
        '#' + collection.color.toString(16).padStart(6, '0')
      );
    }
  }
  endFrame();
}

init();

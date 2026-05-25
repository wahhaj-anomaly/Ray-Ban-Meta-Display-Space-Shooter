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
import { Waves } from './waves.js';
import {
  initHud,
  setScore,
  setWave,
  setHp,
  showMenu,
  showGameOver,
  showCrosshair,
  flashHit,
  getStartButton,
  getRetryButton,
} from './hud.js';
import { initAudio, playLaser, playExplosion, playHit } from './audio.js';
import { getHighScore, setHighScore } from './storage.js';

const MAX_HP = 100;
const STATE = { MENU: 0, PLAYING: 1, GAME_OVER: 2 };

let renderer, scene, camera;
let enemies, projectiles, waves;
let state = STATE.MENU;
let score = 0;
let hp = MAX_HP;
let highScore = 0;
let lastTime = 0;

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

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
  // Two layers: bright big stars + dimmer small stars for depth.
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
  setScore(0);
  setHp(hp, MAX_HP);
  waves.reset();
  projectiles.reset();
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

function onEnemyKilled() {
  score += 100;
  setScore(score);
  playExplosion();
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

function loop(t) {
  requestAnimationFrame(loop);
  const dt = lastTime ? Math.min(0.05, (t - lastTime) / 1000) : 0;
  lastTime = t;

  updateInput(dt);

  if (state === STATE.PLAYING) {
    getAimQuaternion(camera.quaternion);
    waves.update(dt, camera);
    setWave(waves.current());
    enemies.update(dt, projectiles, onPlayerDamage);
    projectiles.update(dt, () => onPlayerDamage(10));

    if (firePressedThisFrame()) {
      playLaser();
      raycaster.setFromCamera(screenCenter, camera);
      const hit = enemies.raycastHit(raycaster.ray, 100);
      if (hit) {
        enemies.kill(hit);
        onEnemyKilled();
      }
      projectiles.spawnPlayer(camera);
    }
  } else if (state === STATE.GAME_OVER) {
    if (backPressedThisFrame()) {
      showGameOver(false);
      showMenu(true);
      state = STATE.MENU;
    }
  }

  renderer.render(scene, camera);
  endFrame();
}

init();

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
  const starCount = 200;
  const positions = new Float32Array(starCount * 6);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 200;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x * 1.002;
    positions[i * 6 + 4] = y * 1.002;
    positions[i * 6 + 5] = z * 1.002;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(
    new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x6666aa })
    )
  );
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

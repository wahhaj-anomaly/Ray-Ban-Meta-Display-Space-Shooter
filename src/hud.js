import * as THREE from 'three';

const els = {};
let indicatorCtx = null;

const _camSpace = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const ARROW_MARGIN = 0.88;

export function initHud() {
  els.score = document.getElementById('score');
  els.wave = document.getElementById('wave');
  els.hpFill = document.getElementById('hp-fill');
  els.menu = document.getElementById('menu');
  els.gameOver = document.getElementById('game-over');
  els.finalScore = document.getElementById('final-score');
  els.highScore = document.getElementById('high-score');
  els.flash = document.getElementById('flash');
  els.startBtn = document.getElementById('start-btn');
  els.retryBtn = document.getElementById('retry-btn');
  els.crosshair = document.getElementById('crosshair');
  els.indicators = document.getElementById('indicators');
  indicatorCtx = els.indicators.getContext('2d');
}

export function drawEnemyIndicators(enemyList, camera) {
  const ctx = indicatorCtx;
  if (!ctx) return;
  ctx.clearRect(0, 0, 600, 600);
  if (!enemyList) return;

  for (const e of enemyList) {
    if (!e.active) continue;

    // In camera-local space, +z is behind the camera in Three.js.
    _camSpace.copy(e.obj.position).applyMatrix4(camera.matrixWorldInverse);
    const behind = _camSpace.z > 0;

    _ndc.copy(e.obj.position).project(camera);
    let nx = _ndc.x;
    let ny = _ndc.y;
    // Perspective divide flips sign for behind-camera points; undo that.
    if (behind) {
      nx = -nx;
      ny = -ny;
    }

    const onScreen =
      !behind && Math.abs(_ndc.x) <= 1 && Math.abs(_ndc.y) <= 1;
    if (onScreen) continue;

    const m = Math.max(Math.abs(nx), Math.abs(ny));
    if (m === 0) continue;
    nx = (nx / m) * ARROW_MARGIN;
    ny = (ny / m) * ARROW_MARGIN;

    const sx = (nx * 0.5 + 0.5) * 600;
    const sy = (-ny * 0.5 + 0.5) * 600;
    const angle = Math.atan2(-ny, nx);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function showCrosshair(show) {
  els.crosshair.style.display = show ? 'block' : 'none';
}

export function setScore(s) {
  els.score.textContent = `SCORE ${s}`;
}

export function setWave(w) {
  els.wave.textContent = `WAVE ${w}`;
}

export function setHp(hp, max) {
  const pct = Math.max(0, hp / max);
  els.hpFill.style.width = `${pct * 100}%`;
  els.hpFill.style.background = pct < 0.3 ? '#ff3333' : '#33ff66';
}

export function showMenu(show) {
  els.menu.style.display = show ? 'flex' : 'none';
  if (show) requestAnimationFrame(() => els.startBtn.focus());
}

export function showGameOver(show, finalScore = 0, highScore = 0) {
  els.gameOver.style.display = show ? 'flex' : 'none';
  if (show) {
    els.finalScore.textContent = `SCORE ${finalScore}`;
    els.highScore.textContent = `BEST  ${highScore}`;
    requestAnimationFrame(() => els.retryBtn.focus());
  }
}

export function flashHit() {
  els.flash.style.opacity = '1';
  setTimeout(() => {
    els.flash.style.opacity = '0';
  }, 120);
}

export function getStartButton() {
  return els.startBtn;
}

export function getRetryButton() {
  return els.retryBtn;
}

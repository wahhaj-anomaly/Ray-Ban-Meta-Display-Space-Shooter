const els = {};

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

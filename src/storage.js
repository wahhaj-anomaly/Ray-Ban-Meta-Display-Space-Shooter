const KEY = 'space_shooter_high_score';

export function getHighScore() {
  try {
    const v = localStorage.getItem(KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setHighScore(score) {
  try {
    localStorage.setItem(KEY, String(score));
  } catch {}
}

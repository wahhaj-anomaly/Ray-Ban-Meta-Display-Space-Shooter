import * as THREE from 'three';

const DPAD = {
  UP: 'ArrowUp', DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
  SELECT: 'Enter', BACK: 'Escape',
};

const keysDown = new Set();
const keysPressedThisFrame = new Set();

let orientation = null;
let lastOrientationTs = 0;
const ORIENT_TIMEOUT_MS = 2000;

let yaw = 0;
let pitch = 0;
const KEY_TURN_RATE = Math.PI / 2;
const PITCH_LIMIT = (85 * Math.PI) / 180;

const DEG = Math.PI / 180;

const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion();
// Device frame -> Three.js camera frame: rotate -90deg around X so the
// "look forward" direction reported by the sensor maps to looking along -Z.
const _qScreen = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2
);

function onKeyDown(e) {
  if (e.repeat) return;
  keysDown.add(e.key);
  keysPressedThisFrame.add(e.key);
  // Block arrow-key page scroll only; leave Enter/Escape alone so they
  // can still activate focused buttons.
  if (
    e.key === DPAD.UP || e.key === DPAD.DOWN ||
    e.key === DPAD.LEFT || e.key === DPAD.RIGHT
  ) {
    e.preventDefault();
  }
}

function onKeyUp(e) {
  keysDown.delete(e.key);
}

function onOrientation(e) {
  if (e.alpha == null) return;
  orientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
  lastOrientationTs = performance.now();
}

export function initInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('deviceorientation', onOrientation, true);
}

export function requestOrientationPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    return DeviceOrientationEvent.requestPermission().catch(() => 'denied');
  }
  return Promise.resolve('granted');
}

function orientationActive() {
  return (
    orientation !== null &&
    performance.now() - lastOrientationTs < ORIENT_TIMEOUT_MS
  );
}

export function getAimQuaternion(target = new THREE.Quaternion()) {
  if (orientationActive()) {
    // YXZ Euler order with screen-up correction is the standard mapping.
    const { alpha, beta, gamma } = orientation;
    _euler.set(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ');
    _q0.setFromEuler(_euler);
    _q0.multiply(_qScreen);
    const angle = (screen.orientation && screen.orientation.angle) || 0;
    if (angle) {
      _q1.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle * DEG);
      _q0.multiply(_q1);
    }
    target.copy(_q0);
    return target;
  }
  target.setFromEuler(_euler.set(pitch, yaw, 0, 'YXZ'));
  return target;
}

export function updateInput(dt) {
  if (orientationActive()) return;
  let dy = 0, dx = 0;
  if (keysDown.has(DPAD.LEFT)) dy += 1;
  if (keysDown.has(DPAD.RIGHT)) dy -= 1;
  if (keysDown.has(DPAD.UP)) dx -= 1;
  if (keysDown.has(DPAD.DOWN)) dx += 1;
  yaw += dy * KEY_TURN_RATE * dt;
  pitch += dx * KEY_TURN_RATE * dt;
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}

export function firePressedThisFrame() {
  return keysPressedThisFrame.has(DPAD.SELECT);
}

export function backPressedThisFrame() {
  return keysPressedThisFrame.has(DPAD.BACK);
}

export function endFrame() {
  keysPressedThisFrame.clear();
}

export { DPAD };

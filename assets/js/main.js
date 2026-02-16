import { Game } from './game.js';
import { UI } from './ui.js';
import * as THREE from 'three';

let ui = null;

const stageEl = document.getElementById('stage');

const game = new Game({
  stageEl,
  onHud: (snapshot) => ui?.updateHud(snapshot),
  onSessionEnd: (summary) => ui?.onSessionEnd(summary),
  onToast: (msg) => ui?.toast(msg),
  onTargetStatus: (onTarget) => ui?.setCrosshairGlow(onTarget),
  onTargetHit: () => ui?.playSound('hit'),
});

ui = new UI({ game });

if (!localStorage.getItem('aimforge.firstRun.v2')) {
  localStorage.setItem('aimforge.firstRun.v2', '1');
  ui.toast('Tip: press F for fullscreen.');
}

// #####################
// NO CLIP FOR DEBUGGING (if you're a developer, use this for testing/contribution purposes :>)
// Disabled by default for normal users
// #####################

/*
window.noclipEnabled = false;
const noclipSpeed = 0.1;

const noclipKeys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  shift: false
};

let noclipYaw = 0;
let noclipPitch = 0;

window.addEventListener('keydown', (e) => {
  if (e.key === 'n' || e.key === 'N') {
    window.noclipEnabled = !window.noclipEnabled;

    if (window.noclipEnabled) {
      // Copy current camera rotation
      noclipYaw = game.yaw || 0;
      noclipPitch = game.pitch || 0;
      document.exitPointerLock();
      ui?.toast('Noclip ON - Move mouse + WASD/Space/Shift');
    } else {
      ui?.toast('Noclip OFF');
    }
    return;
  }

  if (!window.noclipEnabled) return;

  const key = e.key.toLowerCase();
  if (key === 'w') noclipKeys.w = true;
  if (key === 'a') noclipKeys.a = true;
  if (key === 's') noclipKeys.s = true;
  if (key === 'd') noclipKeys.d = true;
  if (key === ' ') { e.preventDefault(); noclipKeys.space = true; }
  if (e.key === 'Shift') noclipKeys.shift = true;
}, true);

window.addEventListener('keyup', (e) => {
  if (!window.noclipEnabled) return;

  const key = e.key.toLowerCase();
  if (key === 'w') noclipKeys.w = false;
  if (key === 'a') noclipKeys.a = false;
  if (key === 's') noclipKeys.s = false;
  if (key === 'd') noclipKeys.d = false;
  if (key === ' ') noclipKeys.space = false;
  if (e.key === 'Shift') noclipKeys.shift = false;
}, true);

window.addEventListener('mousemove', (e) => {
  if (!window.noclipEnabled) return;

  const sens = 0.002;
  noclipYaw -= e.movementX * sens;
  noclipPitch -= e.movementY * sens;
  noclipPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, noclipPitch));
}, true);

function updateNoclip() {
  if (window.noclipEnabled && game?.camera) {
    const cam = game.camera;

    // Apply rotation
    cam.rotation.y = noclipYaw;
    cam.rotation.x = noclipPitch;

    // Movement
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    if (noclipKeys.w) cam.position.addScaledVector(forward, noclipSpeed);
    if (noclipKeys.s) cam.position.addScaledVector(forward, -noclipSpeed);
    if (noclipKeys.a) cam.position.addScaledVector(right, -noclipSpeed);
    if (noclipKeys.d) cam.position.addScaledVector(right, noclipSpeed);
    if (noclipKeys.space) cam.position.addScaledVector(up, noclipSpeed);
    if (noclipKeys.shift) cam.position.addScaledVector(up, -noclipSpeed);
  }

  requestAnimationFrame(updateNoclip);
}

updateNoclip();
*/
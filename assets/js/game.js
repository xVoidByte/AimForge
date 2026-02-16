import * as THREE from 'three';
import { clamp } from './util.js';
import { buildArena } from './world.js';
import { SnapTilesMode } from './modes/snap.js';
import { WallClusterMode } from './modes/cluster.js';
import { StrafeTrailMode } from './modes/track.js';

const MODE_REGISTRY = {
  snap: SnapTilesMode,
  cluster: WallClusterMode,
  track: StrafeTrailMode,
};

export class Game {
  constructor({ stageEl, onHud, onSessionEnd, onToast, onTargetStatus, onTargetHit }) {
    this.stageEl = stageEl;
    this.onHud = onHud;
    this.onSessionEnd = onSessionEnd;
    this.onToast = onToast;
    this.onTargetStatus = onTargetStatus; // callback for crosshair glow
    this.onTargetHit = onTargetHit; // callback for hit sound

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.stageEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(103, 1, 0.05, 250);
    this.camera.position.set(0, 1.6, 0);
    this.camera.rotation.order = 'YXZ';
    this.yaw = 0;
    this.pitch = 0;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x101018, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.65);
    key.position.set(2, 4, 1);
    this.scene.add(key);

    this.arena = buildArena({ scene: this.scene });

    this.raycaster = new THREE.Raycaster();

    this.state = 'menu';
    this.settings = {
      timer: 60,
      fov: 103,
      sensitivity: 1,
      targetSize: 1,
      targetShape: 'circle',
      motionSpeed: 1.5,
      trackInputMode: 'passive',
      crosshairGlow: false,
    };

    this.session = {
      duration: 60,
      startMs: 0,
      elapsed: 0,
    };

    this._raf = 0;
    this._lastFrameMs = performance.now();
    this._hudAccumulator = 0;

    // FPS sampling (smoothed over a short window)
    this._fps = 0;
    this._fpsFrames = 0;
    this._fpsAccum = 0;

    this.mode = null;
    this.modeId = null;

    this._bindEvents();
    this._resize();
    this._loop();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());

    this.renderer.domElement.addEventListener('mousedown', () => {
      if (!this.isPointerLocked() && (this.state === 'ready' || this.state === 'running')) {
        this.requestPointerLock().catch(() => { });
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked()) return;
      if (this.state !== 'running') return;

      const baseDegPerUnit = 0.115;
      const deg = baseDegPerUnit * (this.settings.sensitivity ?? 1);
      const sens = THREE.MathUtils.degToRad(deg);
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;

      const limit = Math.PI / 2 - 0.02;
      this.pitch = clamp(this.pitch, -limit, limit);

      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    });

    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'running') return;
      if (e.button === 0) {
        this.mode?.onPointerDown?.(performance.now());
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (this.state !== 'running') return;
      if (e.button === 0) {
        this.mode?.onPointerUp?.(performance.now());
      }
    });

    document.addEventListener('pointerlockchange', () => {
      if (this.state === 'running' && !this.isPointerLocked()) {
        this.pause(true);
        this.onToast?.('Pointer unlocked - paused. Press P to resume (and click to lock).');
      }
    });
  }

  _resize() {
    const rect = this.stageEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _applyViewSettings() {
    const fov = clamp(Number(this.settings.fov ?? 103), 50, 140);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  isPointerLocked() {
    return document.pointerLockElement === this.renderer.domElement;
  }

  async requestPointerLock() {
    const el = this.renderer.domElement;
    el.focus?.();
    el.requestPointerLock();

    return new Promise((resolve, reject) => {
      const start = performance.now();
      const tick = () => {
        if (this.isPointerLocked()) return resolve(true);
        if (performance.now() - start > 1200) return reject(new Error('pointerlock-timeout'));
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  setSettings(next) {
    this.settings = { ...this.settings, ...next };
    this._applyViewSettings();
  }

  loadMode(modeId) {
    const Mode = MODE_REGISTRY[modeId];
    if (!Mode) throw new Error(`Unknown mode: ${modeId}`);

    this.mode?.dispose?.();
    this.mode = new Mode(this);
    this.modeId = modeId;
  }

  resetView() {
    this.yaw = 0;
    this.pitch = 0;
    this.camera.rotation.y = 0;
    this.camera.rotation.x = 0;
  }

  async prepareSession({ modeId, settings }) {
    this.setSettings(settings);
    this.loadMode(modeId);
    this.resetView();

    this.session.duration = Number(settings.timer ?? 60);
    this.session.startMs = 0;
    this.session.elapsed = 0;

    this.mode.start?.(this.settings);
    this.state = 'ready';

    try {
      await this.requestPointerLock();
    } catch {
      this.onToast?.('Click the stage to lock the mouse (recommended).');
    }
  }

  beginSession() {
    this.session.startMs = performance.now();
    this.session.elapsed = 0;
    this._hudAccumulator = 0;

    this.state = 'running';
    this.onHud?.(this.getHudSnapshot());
  }

  pause(fromPointerUnlock = false) {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.mode?.pause?.();

    if (!fromPointerUnlock) {
      this.onToast?.('Paused');
    }
  }

  async resume() {
    if (this.state !== 'paused') return;

    if (!this.isPointerLocked()) {
      try {
        await this.requestPointerLock();
      } catch {
        // User can still resume without pointer lock.
      }
    }

    const now = performance.now();
    const alreadyElapsed = this.session.elapsed;
    this.session.startMs = now - alreadyElapsed * 1000;

    this.mode?.resume?.();
    this.state = 'running';
  }

  exitToMenu() {
    this.state = 'menu';
    this.mode?.dispose?.();
    this.mode = null;
    this.modeId = null;

    if (this.isPointerLocked()) document.exitPointerLock();
  }

  finishSession() {
    if (this.state === 'results' || this.state === 'menu') return;
    this.state = 'results';

    const elapsed = this.session.elapsed;
    const summary = this.mode?.getSummary?.({ elapsed, settings: this.settings }) ?? {};
    this.onSessionEnd?.(summary);

    if (this.isPointerLocked()) document.exitPointerLock();
  }

  toggleFullscreen() {
    const root = document.getElementById('app');
    if (!root) return;

    if (!document.fullscreenElement) {
      root.requestFullscreen?.().catch(() => { });
    } else {
      document.exitFullscreen?.().catch(() => { });
    }
  }

  shootRaycast(objects) {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  // Check if crosshair is on target (for passive tracking and glow)
  isOnTarget() {
    if (!this.mode || !this.mode.getTargetObjects) return false;
    const targets = this.mode.getTargetObjects();
    if (!targets || targets.length === 0) return false;
    const hits = this.shootRaycast(targets);
    return hits.length > 0;
  }

  getHudSnapshot() {
    const duration = Number(this.session.duration ?? 60);
    const remaining = duration <= 0 ? Infinity : Math.max(0, duration - this.session.elapsed);

    const metrics = this.mode?.getMetrics?.({ elapsed: this.session.elapsed, remaining }) ?? {
      accuracy01: 0,
      avgResponseMs: null,
      extraLabel: '',
      extraValue: '',
    };

    return {
      state: this.state,
      modeId: this.modeId,
      elapsed: this.session.elapsed,
      remaining,
      duration,
      fps: this._fps,
      ...metrics,
    };
  }

  _loop() {
    const now = performance.now();
    const dt = Math.max(0, (now - this._lastFrameMs) / 1000);
    this._lastFrameMs = now;

    // FPS sampling (independent of game state)
    this._fpsFrames++;
    this._fpsAccum += dt;
    if (this._fpsAccum >= 0.25) {
      const fps = this._fpsAccum > 0 ? this._fpsFrames / this._fpsAccum : 0;
      this._fps = Math.max(0, Math.min(999, fps));
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    if (this.state === 'running') {
      this.session.elapsed = Math.max(0, (now - this.session.startMs) / 1000);

      const duration = Number(this.session.duration ?? 60);
      if (duration > 0 && this.session.elapsed >= duration) {
        this.finishSession();
      } else {
        this.mode?.update?.(dt);
      }

      // Check target status for glow feedback
      if (this.settings.crosshairGlow && this.onTargetStatus) {
        const onTarget = this.isOnTarget();
        this.onTargetStatus(onTarget);
      } else if (this.onTargetStatus) {
        this.onTargetStatus(false);
      }

      this._hudAccumulator += dt;
      if (this._hudAccumulator >= 0.016) {
        this._hudAccumulator = 0;
        this.onHud?.(this.getHudSnapshot());
      }
    }

    this.mode?.render?.(dt);

    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(() => this._loop());
  }
}
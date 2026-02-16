import * as THREE from 'three';
import { clamp, mean, formatPct } from '../util.js';
import { createTargetMesh, pickTargetFromHits, isPointInTarget } from '../targets.js';

export class StrafeTrailMode {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.game.scene.add(this.group);

    this.target = null;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.desiredVel = new THREE.Vector3();
    this.turnTimer = 0;
    this.firing = false;
    this.fireAccum = 0;

    this.stats = {
      shots: 0,
      hits: 0,
      onTargetTime: 0,
      reacquireTimes: [],
      wasOnTarget: false,
      lostAtMs: null,
      reacquireCount: 0,
      segments: [],
      lastSegmentStart: null,
    };
  }

  start(settings) {
    this.settings = settings;
    this._resetStats();
    this._spawnTarget();
    this._resetMotion();
    this.sessionStartMs = performance.now();
  }

  _resetStats() {
    this.stats.shots = 0;
    this.stats.hits = 0;
    this.stats.onTargetTime = 0;
    this.stats.reacquireTimes = [];
    this.stats.wasOnTarget = false;
    this.stats.lostAtMs = performance.now();
    this.stats.reacquireCount = 0;
    this.stats.segments = [];
    this.stats.lastSegmentStart = null;
    this.firing = false;
    this.fireAccum = 0;
  }

  _getTargetBounds() {
    const shape = this.settings.targetShape ?? 'circle';
    const r = this._radius();

    if (shape === 'ball') {
      return { halfW: r * 0.85, halfH: r * 0.85 };
    } else if (shape === 'capsule') {
      return { halfW: r * 0.5, halfH: r * 1.1 }; // Vertical capsule
    }
    return { halfW: r, halfH: r };
  }

  _radius() {
    const baseR = 0.46;
    const scale = Number(this.settings.targetSize ?? 1);
    return clamp(baseR * scale, 0.12, baseR);
  }

  _spawnTarget() {
    if (this.target) {
      this.group.remove(this.target);
      this.target.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) o.material.dispose?.();
      });
      this.target = null;
    }

    const shape = this.settings.targetShape ?? 'circle';
    this.target = createTargetMesh(shape, this.settings.targetSize ?? 1);

    const w = this.game.arena?.wall;
    this.target.position.set(0, w?.centerY ?? 3, (w?.z ?? -12) + 0.6);
    this.group.add(this.target);
  }

  _resetMotion() {
    const w = this.game.arena?.wall;
    const halfW = (w?.width ?? 14) / 2;
    const halfH = (w?.height ?? 8) / 2;
    const cy = w?.centerY ?? 3;
    const bounds = this._getTargetBounds();
    const pad = 0.2;

    // Floor is at y=0, ensure 3D targets don't clip through
    const shape = this.settings.targetShape ?? 'circle';
    const floorY = 0;
    const floorConstraint = shape === 'ball' || shape === 'capsule' ? floorY + bounds.halfH + 0.3 : -Infinity;
    const minY = Math.max(floorConstraint, cy - (halfH - bounds.halfH - pad));

    // Start in center area
    let startY = cy + (Math.random() * 2 - 1) * (halfH - bounds.halfH - pad) * 0.5;
    startY = Math.max(minY, startY);

    this.pos.set(
      (Math.random() * 2 - 1) * (halfW - bounds.halfW - pad) * 0.5,
      startY,
      (w?.z ?? -12) + 0.02
    );

    const s = clamp(Number(this.settings.motionSpeed ?? 1.5), 0.4, 4);
    const baseSpeed = 2.6 + s * 2.2;

    const angle = Math.random() * Math.PI * 2;
    this.vel.set(Math.cos(angle) * baseSpeed, Math.sin(angle) * baseSpeed * 0.65, 0);
    this.desiredVel.copy(this.vel);

    this.turnTimer = 0.65 + Math.random() * 0.85;
    if (this.target) this.target.position.copy(this.pos);
  }

  onPointerDown(_nowMs) {
    this.firing = true;
  }

  onPointerUp(_nowMs) {
    this.firing = false;
  }

  _checkOnTarget() {
    if (!this.target) return false;
    const hits = this.game.shootRaycast([this.target]);
    return hits.length > 0;
  }

  update(dt) {
    const w = this.game.arena?.wall;
    const halfW = (w?.width ?? 14) / 2;
    const halfH = (w?.height ?? 8) / 2;
    const cy = w?.centerY ?? 3;
    const z = (w?.z ?? -12) + 0.02;

    const bounds = this._getTargetBounds();
    const pad = 0.2;
    const minX = -halfW + bounds.halfW + pad;
    const maxX = halfW - bounds.halfW - pad;

    // Floor is at y=0, ensure 3D targets don't clip through
    const shape = this.settings.targetShape ?? 'circle';
    const floorY = 0;
    const floorConstraint = shape === 'ball' || shape === 'capsule' ? floorY + bounds.halfH + 0.3 : -Infinity;
    const minY = Math.max(floorConstraint, cy - halfH + bounds.halfH + pad);
    const maxY = cy + halfH - bounds.halfH - pad;

    // Direction changes
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) {
      const s = clamp(Number(this.settings.motionSpeed ?? 1.5), 0.4, 4);
      const baseSpeed = 2.6 + s * 2.2;

      const dir = Math.random() < 0.5 ? -1 : 1;
      const vx = dir * baseSpeed * (0.85 + Math.random() * 0.35);
      const vy = (Math.random() * 2 - 1) * baseSpeed * 0.35;

      this.desiredVel.set(vx, vy, 0);
      this.turnTimer = 0.55 + Math.random() * 0.95;
    }

    // Smooth velocity transition
    const t = 1 - Math.exp(-dt * 7.5);
    this.vel.lerp(this.desiredVel, t);

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z = z;

    // Bounce off bounds
    if (this.pos.x < minX) {
      this.pos.x = minX;
      this.vel.x = Math.abs(this.vel.x);
      this.desiredVel.x = Math.abs(this.desiredVel.x);
    }
    if (this.pos.x > maxX) {
      this.pos.x = maxX;
      this.vel.x = -Math.abs(this.vel.x);
      this.desiredVel.x = -Math.abs(this.desiredVel.x);
    }
    if (this.pos.y < minY) {
      this.pos.y = minY;
      this.vel.y = Math.abs(this.vel.y);
      this.desiredVel.y = Math.abs(this.desiredVel.y);
    }
    if (this.pos.y > maxY) {
      this.pos.y = maxY;
      this.vel.y = -Math.abs(this.vel.y);
      this.desiredVel.y = -Math.abs(this.desiredVel.y);
    }

    if (this.target) {
      this.target.position.copy(this.pos);
      // Gentle rotation for 3D shapes
      if (this.target.userData.shape !== 'circle') {
        this.target.rotation.y += dt * 0.3;
      }
    }

    const onTarget = this._checkOnTarget();
    const inputMode = this.settings.trackInputMode ?? 'passive';

    // Only track onTargetTime when firing in hold mode, or always in passive mode
    if (inputMode === 'passive' && onTarget) {
      this.stats.onTargetTime += dt;
    } else if (inputMode === 'hold' && this.firing && onTarget) {
      this.stats.onTargetTime += dt;
    }

    const nowMs = performance.now();
    const elapsed = (nowMs - this.sessionStartMs) / 1000;

    // Track segments for timeline visualization
    const shouldBeOn = (inputMode === 'passive' && onTarget) || (inputMode === 'hold' && this.firing && onTarget);

    if (shouldBeOn && this.stats.lastSegmentStart === null) {
      // Starting a new "on target" segment
      this.stats.lastSegmentStart = elapsed;
    } else if (!shouldBeOn && this.stats.lastSegmentStart !== null) {
      // Ending current "on target" segment
      this.stats.segments.push({
        start: this.stats.lastSegmentStart,
        end: elapsed,
        on: true
      });
      this.stats.lastSegmentStart = null;
    }

    if (this.stats.wasOnTarget && !onTarget) {
      this.stats.lostAtMs = nowMs;
    }
    if (!this.stats.wasOnTarget && onTarget) {
      if (this.stats.lostAtMs != null) {
        const t = nowMs - this.stats.lostAtMs;
        if (Number.isFinite(t) && t >= 0) {
          this.stats.reacquireTimes.push(t);
          this.stats.reacquireCount++;
        }
      }
      this.stats.lostAtMs = null;
    }
    this.stats.wasOnTarget = onTarget;

    if (inputMode === 'passive') {
      if (onTarget) {
        this.fireAccum += dt;
        const hitInterval = 0.1;
        while (this.fireAccum >= hitInterval) {
          this.fireAccum -= hitInterval;
          this.stats.shots += 1;
          this.stats.hits += 1;
          this.game.onTargetHit?.();
        }
      } else {
        this.fireAccum = 0;
      }
    } else if (inputMode === 'hold') {
      if (this.firing) {
        const fireRate = 12;
        this.fireAccum += dt;
        const step = 1 / fireRate;
        while (this.fireAccum >= step) {
          this.fireAccum -= step;
          this.stats.shots += 1;
          if (onTarget) {
            this.stats.hits += 1;
            this.game.onTargetHit?.();
          }
        }
      } else {
        this.fireAccum = 0;
      }
    }
  }

  getMetrics({ elapsed, remaining }) {
    const accuracy01 = elapsed > 0 ? this.stats.onTargetTime / elapsed : 0;
    const avgResponseMs = mean(this.stats.reacquireTimes);

    return {
      accuracy01,
      avgResponseMs,
      extraLabel: 'On target',
      extraValue: formatPct(accuracy01),
      timerRemaining: remaining,
      timerElapsed: elapsed,
    };
  }

  getSummary({ elapsed, settings }) {
    const accuracy01 = elapsed > 0 ? this.stats.onTargetTime / elapsed : 0;
    const avgResponseMs = mean(this.stats.reacquireTimes);

    // Close the final segment if still on target
    if (this.stats.lastSegmentStart !== null) {
      this.stats.segments.push({
        start: this.stats.lastSegmentStart,
        end: elapsed,
        on: true
      });
    }

    return {
      modeId: 'track',
      modeName: 'Strafe Trail',
      elapsed,
      settings,
      shots: this.stats.shots,
      hits: this.stats.hits,
      accuracy01,
      avgResponseMs,
      onTarget01: accuracy01,
      reacquireCount: this.stats.reacquireCount,
      details: {
        segments: this.stats.segments,
        reacquireTimes: this.stats.reacquireTimes.slice(),
      },
    };
  }

  getTargetObjects() {
    return this.target ? [this.target] : [];
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
  }
}
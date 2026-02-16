import * as THREE from 'three';
import { mean, clamp } from '../util.js';
import { createTargetMesh, pickTargetFromHits } from '../targets.js';

export class SnapTilesMode {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.game.scene.add(this.group);

    this.stats = {
      shots: 0,
      hits: 0,
      streak: 0,
      bestStreak: 0,
      reactionTimes: [],
      streakTimeline: [],
    };

    this.target = null;
    this.targetSpawnMs = 0;
  }

  start(settings) {
    this.settings = settings;
    this._reset();
    this._spawnTarget();
  }

  _reset() {
    this.stats = {
      shots: 0,
      hits: 0,
      streak: 0,
      bestStreak: 0,
      reactionTimes: [],
      streakTimeline: [],
    };
  }

  _getTargetBounds() {
    const shape = this.settings.targetShape ?? 'circle';
    const r = this._radius();
    if (shape === 'ball') return { halfW: r * 0.85, halfH: r * 0.85 };
    if (shape === 'capsule') return { halfW: r * 0.5, halfH: r * 1.1 };
    return { halfW: r, halfH: r };
  }

  _radius() {
    const baseR = 0.48;
    const scale = Number(this.settings.targetSize ?? 1);
    return clamp(baseR * scale, 0.12, baseR);
  }

  _randomWallPos() {
    const w = this.game.arena?.wall;
    const halfW = (w?.width ?? 14) / 2;
    const halfH = (w?.height ?? 8) / 2;
    const cy = w?.centerY ?? 3;
    const z = (w?.z ?? -12) + 0.6;
    const bounds = this._getTargetBounds();
    const pad = 0.5;
    const maxX = halfW - bounds.halfW - pad;
    const maxY = halfH - bounds.halfH - pad;

    // Floor is at y=0, add extra padding for 3D shapes (ball/capsule)
    const shape = this.settings.targetShape ?? 'circle';
    const floorY = 0;
    const minY = shape === 'ball' || shape === 'capsule' ? floorY + bounds.halfH + 0.3 : cy - maxY;

    let y = cy + (Math.random() * 2 - 1) * maxY;
    y = Math.max(minY, y); // Prevent floor clipping

    return new THREE.Vector3((Math.random() * 2 - 1) * maxX, y, z);
  }

  _spawnTarget() {
    if (this.target) {
      this.group.remove(this.target);
      this.target.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) o.material.dispose?.();
      });
    }

    const shape = this.settings.targetShape ?? 'circle';
    const color = this.settings.target3DColor ?? '#ffffff';
    const colorHex = parseInt(color.replace('#', ''), 16);

    this.target = createTargetMesh(shape, this.settings.targetSize ?? 1, colorHex);
    this.target.position.copy(this._randomWallPos());
    this.target.rotation.z = Math.random() * Math.PI * 2;
    this.group.add(this.target);

    this.targetSpawnMs = performance.now();
  }

  onPointerDown(nowMs) {
    this.stats.shots++;

    const hits = this.game.shootRaycast([this.target]);
    const tgt = pickTargetFromHits(hits);

    let hit = false;

    if (tgt) {
      hit = true;
      this.game.onTargetHit?.();
      this.stats.hits++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);

      const rt = nowMs - this.targetSpawnMs;
      if (Number.isFinite(rt) && rt >= 0) this.stats.reactionTimes.push(rt);

      this._spawnTarget();
    } else {
      this.stats.streak = 0;
    }

    // shot-by-shot timeline for streak chart
    const startMs = this.game?.session?.startMs ?? 0;
    const tSec = startMs ? (nowMs - startMs) / 1000 : (this.game?.session?.elapsed ?? 0);
    if (Number.isFinite(tSec) && tSec >= 0) {
      this.stats.streakTimeline.push({ t: tSec, streak: this.stats.streak, hit });
    }
  }

  update() { }

  getMetrics({ elapsed, remaining }) {
    const shots = this.stats.shots;
    const hits = this.stats.hits;
    return {
      accuracy01: shots > 0 ? hits / shots : 0,
      avgResponseMs: mean(this.stats.reactionTimes),
      extraLabel: 'Hits',
      extraValue: String(hits),
      timerRemaining: remaining,
      timerElapsed: elapsed,
    };
  }

  getSummary({ elapsed, settings }) {
    const shots = this.stats.shots;
    const hits = this.stats.hits;
    return {
      modeId: 'snap',
      modeName: 'Snap Tiles',
      elapsed,
      settings,
      shots,
      hits,
      accuracy01: shots > 0 ? hits / shots : 0,
      avgResponseMs: mean(this.stats.reactionTimes),
      bestStreak: this.stats.bestStreak,
      details: {
        reactionTimes: this.stats.reactionTimes.slice(),
        streakTimeline: this.stats.streakTimeline.slice(),
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
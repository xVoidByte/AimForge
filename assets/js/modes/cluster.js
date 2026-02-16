import * as THREE from 'three';
import { mean, clamp } from '../util.js';
import { createTargetMesh, pickTargetFromHits } from '../targets.js';

export class WallClusterMode {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.game.scene.add(this.group);

    this.targetCount = 6;

    this.stats = {
      shots: 0,
      hits: 0,
      streak: 0,
      bestStreak: 0,
      reactionTimes: [],
      streakTimeline: [],
    };

    this.targets = [];
  }

  start(settings) {
    this.settings = settings;
    this._reset();
    this._spawnAll();
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

    this.targets.forEach((t) => {
      this.group.remove(t);
      t.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) o.material.dispose?.();
      });
    });
    this.targets = [];
  }

  _getTargetBounds() {
    const shape = this.settings.targetShape ?? 'circle';
    const r = this._radius();
    if (shape === 'ball') return { halfW: r * 0.85, halfH: r * 0.85 };
    if (shape === 'capsule') return { halfW: r * 0.5, halfH: r * 1.1 };
    return { halfW: r, halfH: r };
  }

  _radius() {
    const baseR = 0.44;
    const scale = Number(this.settings.targetSize ?? 1);
    return clamp(baseR * scale, 0.12, baseR);
  }

  _randomWallPos(existing) {
    const w = this.game.arena?.wall;
    const halfW = (w?.width ?? 14) / 2;
    const halfH = (w?.height ?? 8) / 2;
    const cy = w?.centerY ?? 3;
    const z = (w?.z ?? -12) + 0.6;
    const bounds = this._getTargetBounds();
    const pad = 0.6;
    const minDist = bounds.halfW * 2.8;
    const maxX = halfW - bounds.halfW - pad;
    const maxY = halfH - bounds.halfH - pad;

    for (let i = 0; i < 80; i++) {
      const x = (Math.random() * 2 - 1) * maxX;
      const y = cy + (Math.random() * 2 - 1) * maxY;

      let ok = true;
      for (const p of existing) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (ok) return new THREE.Vector3(x, y, z);
    }

    return new THREE.Vector3((Math.random() * 2 - 1) * maxX, cy + (Math.random() * 2 - 1) * maxY, z);
  }

  _spawnAll() {
    const shape = this.settings.targetShape ?? 'circle';
    const color = this.settings.target3DColor ?? '#ffffff';
    const colorHex = parseInt(color.replace('#', ''), 16);
    const existing = [];

    for (let i = 0; i < this.targetCount; i++) {
      const mesh = createTargetMesh(shape, this.settings.targetSize ?? 1, colorHex);
      mesh.position.copy(this._randomWallPos(existing));
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.userData.spawnMs = performance.now();
      existing.push(mesh.position);
      this.group.add(mesh);
      this.targets.push(mesh);
    }
  }

  _respawn(target) {
    const existing = this.targets
      .filter((t) => t !== target)
      .map((t) => ({ x: t.position.x, y: t.position.y }));
    target.position.copy(this._randomWallPos(existing));
    target.rotation.z = Math.random() * Math.PI * 2;
    target.userData.spawnMs = performance.now();
  }

  onPointerDown(nowMs) {
    this.stats.shots++;

    const hits = this.game.shootRaycast(this.targets);
    const tgt = pickTargetFromHits(hits);

    let hit = false;

    if (tgt) {
      hit = true;
      this.game.onTargetHit?.();
      this.stats.hits++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);

      const rt = nowMs - (tgt.userData.spawnMs ?? nowMs);
      if (Number.isFinite(rt) && rt >= 0) this.stats.reactionTimes.push(rt);

      this._respawn(tgt);
    } else {
      this.stats.streak = 0;
    }

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
      modeId: 'cluster',
      modeName: 'Wall Cluster',
      elapsed,
      settings,
      shots,
      hits,
      accuracy01: shots > 0 ? hits / shots : 0,
      avgResponseMs: mean(this.stats.reactionTimes),
      bestStreak: this.stats.bestStreak,
      targetCount: this.targetCount,
      details: {
        reactionTimes: this.stats.reactionTimes.slice(),
        streakTimeline: this.stats.streakTimeline.slice(),
      },
    };
  }

  getTargetObjects() {
    return this.targets;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
  }
}
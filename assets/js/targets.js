import * as THREE from 'three';
import { clamp } from './util.js';

const DEFAULT_3D_COLOR = 0xffffff;

export function createTargetMesh(shape, sizeScale = 1, color = DEFAULT_3D_COLOR) {
  const baseR = 0.45;
  const r = clamp(baseR * sizeScale, 0.12, baseR * 2);

  switch (shape) {
    case 'capsule':
      return makeCapsuleTargetMesh3D(r, color);
    case 'ball':
      return makeBallTargetMesh(r, color);
    case 'circle':
    default:
      return makeCircleTargetMesh(r);
  }
}

function makeCircleTargetMesh(r) {
  const ringGeo = new THREE.RingGeometry(r * 0.62, r, 56);
  const fillGeo = new THREE.CircleGeometry(r * 0.6, 56);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x6aa7ff,
    emissive: 0x1d2e55,
    emissiveIntensity: 0.85,
    metalness: 0.1,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });

  const fillMat = new THREE.MeshStandardMaterial({
    color: 0x0b1326,
    emissive: 0x071225,
    emissiveIntensity: 0.55,
    metalness: 0.0,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });

  const ring = new THREE.Mesh(ringGeo, ringMat);
  const fill = new THREE.Mesh(fillGeo, fillMat);
  ring.position.z = 0.001;

  const g = new THREE.Group();
  g.add(fill);
  g.add(ring);
  g.userData.isTarget = true;
  g.userData.shape = 'circle';
  g.userData.radius = r;
  return g;
}

function makeCapsuleTargetMesh3D(r, color) {
  const radius = r * 0.5;
  const length = r * 1.2;

  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.1,
    roughness: 0.3,
  });

  let capsuleMesh;
  try {
    const geo = new THREE.CapsuleGeometry(radius, length, 8, 16);
    capsuleMesh = new THREE.Mesh(geo, bodyMat);
  } catch (e) {
    const cylGeo = new THREE.CylinderGeometry(radius, radius, length, 32);
    const sphereGeo = new THREE.SphereGeometry(radius, 32, 24);

    capsuleMesh = new THREE.Group();
    const cyl = new THREE.Mesh(cylGeo, bodyMat);
    const top = new THREE.Mesh(sphereGeo, bodyMat);
    top.position.y = length / 2;
    const bottom = new THREE.Mesh(sphereGeo, bodyMat);
    bottom.position.y = -length / 2;

    capsuleMesh.add(cyl);
    capsuleMesh.add(top);
    capsuleMesh.add(bottom);
  }

  group.add(capsuleMesh);
  group.position.z = radius * 0.6;

  const totalHeight = length + radius * 2;
  const totalWidth = radius * 2;

  group.userData.isTarget = true;
  group.userData.shape = 'capsule';
  group.userData.radius = radius;
  group.userData.halfHeight = totalHeight / 2;
  group.userData.halfWidth = totalWidth / 2;

  return group;
}

function makeBallTargetMesh(r, color) {
  const radius = r * 0.85;
  const geo = new THREE.SphereGeometry(radius, 48, 36);

  const mat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.2,
    roughness: 0.2,
  });

  const mesh = new THREE.Mesh(geo, mat);

  const group = new THREE.Group();
  group.add(mesh);
  group.position.z = radius * 0.8;

  group.userData.isTarget = true;
  group.userData.shape = 'ball';
  group.userData.radius = radius;

  return group;
}

export function pickTargetFromHits(hits) {
  if (!hits || hits.length === 0) return null;
  const hit = hits[0]?.object;
  if (!hit) return null;
  let o = hit;
  while (o) {
    if (o.userData?.isTarget) return o;
    o = o.parent;
  }
  return null;
}

export function isPointInTarget(target, localPoint) {
  const shape = target.userData.shape;
  const x = localPoint.x;
  const y = localPoint.y;

  if (shape === 'circle') {
    const r = target.userData.radius;
    return (x * x + y * y) <= (r * r);
  } else if (shape === 'capsule') {
    const hw = target.userData.halfWidth;
    const hh = target.userData.halfHeight;
    return Math.abs(x) <= hw && Math.abs(y) <= hh;
  } else if (shape === 'ball') {
    const r = target.userData.radius;
    const z = localPoint.z - target.position.z;
    return (x * x + y * y + z * z) <= (r * r);
  }
  return false;
}

export function makeDiskTarget({ radius = 0.45, ringColor = 0x6aa7ff, fillColor = 0x0b1326 } = {}) {
  return createTargetMesh('circle', radius / 0.45);
}

export function makeCapsuleTarget({ width = 0.9, height = 0.55, radius = 0.22, ringColor = 0x7affd1, fillColor = 0x081b17 } = {}) {
  const r = Math.max(width, height) / 2 / 1.05;
  return createTargetMesh('capsule', r / 0.45);
}
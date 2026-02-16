import * as THREE from 'three';

export function buildArena({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a1020,
    roughness: 0.95,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = false;
  group.add(floor);

  const grid = new THREE.GridHelper(60, 60, 0x233055, 0x141a2e);
  grid.position.y = 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  group.add(grid);

  const wall = {
    z: -12,
    width: 14,
    height: 8,
    centerY: 3.0,
  };

  const wallGeo = new THREE.PlaneGeometry(wall.width, wall.height);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0b1326,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x02040a,
    emissiveIntensity: 0.4,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.set(0, wall.centerY, wall.z);
  group.add(wallMesh);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f1730,
    roughness: 0.75,
    metalness: 0.1,
  });
  const frameThickness = 0.15;

  const makeFrame = (w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameThickness), frameMat);
    m.position.set(x, y, z);
    group.add(m);
  };

  makeFrame(frameThickness, wall.height + 0.35, -wall.width / 2 - frameThickness / 2, wall.centerY, wall.z);
  makeFrame(frameThickness, wall.height + 0.35, wall.width / 2 + frameThickness / 2, wall.centerY, wall.z);
  makeFrame(wall.width + 0.35, frameThickness, 0, wall.centerY + wall.height / 2 + frameThickness / 2, wall.z);
  makeFrame(wall.width + 0.35, frameThickness, 0, wall.centerY - wall.height / 2 - frameThickness / 2, wall.z);

  return {
    group,
    wall,
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) o.material.dispose?.();
      });
      group.removeFromParent();
    },
  };
}
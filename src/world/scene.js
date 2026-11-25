import * as THREE from 'three';

export function createScene(quality) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, quality.far * 0.6, quality.far);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a7d3a, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality.shadows;
  scene.add(ground);

  // House body
  const houseGeo = new THREE.BoxGeometry(6, 4, 8);
  const houseMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
  const house = new THREE.Mesh(houseGeo, houseMat);
  house.position.set(0, 2, -10);
  house.castShadow = quality.shadows;
  house.receiveShadow = quality.shadows;
  scene.add(house);

  // Roof
  const roofGeo = new THREE.ConeGeometry(5, 3, 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 5.5, -10);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = quality.shadows;
  scene.add(roof);

  // Door
  const doorGeo = new THREE.BoxGeometry(1.4, 2.4, 0.1);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.2, -6);
  door.castShadow = quality.shadows;
  scene.add(door);
  door.userData.isDoor = true;
  door.userData.open = false;

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
  sun.position.set(20, 30, 10);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
  }
  scene.add(sun);

  scene.userData.door = door;
  return scene;
}

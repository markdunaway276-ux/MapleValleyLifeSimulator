import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

  // Real house model (Kenney City Kit Suburban, CC0). The procedural box house,
  // roof and door above stay as a fallback until the model has loaded.
  const HOUSE_URL = './assets/models/house_type02.glb'; // relative to the page, so it works under the Pages subpath
  const HOUSE_CENTER = new THREE.Vector3(0, 0, -10);    // same spot as the old box house
  const HOUSE_TARGET = { x: 6.5, z: 8 };                // approximate footprint in metres
  // Front door of house_type02 in the model's own units (before scaling/centering)
  const MODEL_FRONT_DOOR = { x: 0.004, y: 0.135, z: 0.535, w: 0.14, h: 0.27 };

  new GLTFLoader().load(
    HOUSE_URL,
    (gltf) => {
      const model = gltf.scene;

      // Uniform scale so the footprint fits roughly 6.5 x 8 m
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawCenter = rawBox.getCenter(new THREE.Vector3());
      const s = Math.min(HOUSE_TARGET.x / rawSize.x, HOUSE_TARGET.z / rawSize.z);
      model.scale.setScalar(s);

      // Base on y = 0, centered on HOUSE_CENTER (the model's front already faces +z)
      model.position.set(
        HOUSE_CENTER.x - rawCenter.x * s,
        -rawBox.min.y * s,
        HOUSE_CENTER.z - rawCenter.z * s
      );

      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = quality.shadows;
          o.receiveShadow = quality.shadows;
        }
      });
      scene.add(model);

      // Swap out the placeholder box house + roof
      scene.remove(house);
      scene.remove(roof);
      houseGeo.dispose(); houseMat.dispose();
      roofGeo.dispose(); roofMat.dispose();

      // Fit the interactable door over the model's own front door
      model.updateMatrixWorld(true);
      const d = MODEL_FRONT_DOOR;
      const doorWorld = model.localToWorld(new THREE.Vector3(d.x, d.y, d.z));
      door.scale.set((d.w * s) / 1.4, (d.h * s) / 2.4, 1);
      door.position.set(doorWorld.x, doorWorld.y, doorWorld.z + 0.06);
    },
    undefined,
    (err) => {
      console.warn('House model failed to load, keeping the placeholder house', err);
    }
  );

  return scene;
}

import * as THREE from 'three';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function oval(material, position, scale) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  return mesh;
}

// Bend a closed, tapered surface around the phone's edge. The finger has
// rounded ends and a continuous silhouette through both knuckles.
function curledFinger(material, points, radius) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const geometry = new THREE.SphereGeometry(1, 12, 12);
  const positions = geometry.attributes.position;
  const center = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const t = THREE.MathUtils.clamp((positions.getY(i) + 1) / 2, 0, 1);
    const r = radius * THREE.MathUtils.lerp(1, 0.78, t);
    curve.getPoint(t, center);
    curve.getTangent(t, tangent);
    across.crossVectors(Y_AXIS, tangent).normalize();
    center.addScaledVector(Y_AXIS, positions.getX(i) * r);
    center.addScaledVector(across, positions.getZ(i) * r);
    positions.setXYZ(i, center.x, center.y, center.z);
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function addPhoneGrip(phone, material, includePalm) {
  if (includePalm) {
    const palm = oval(material, [0.036, -0.062, -0.020], [0.024, 0.038, 0.015]);
    palm.rotation.set(0.15, 0.2, -0.19);
    phone.add(palm);
  }
  for (const [y, reach, radius] of [
    [-0.024, 0.025, 0.0065],
    [-0.038, 0.032, 0.0068],
    [-0.052, 0.025, 0.0061],
    [-0.064, 0.015, 0.0051]
  ]) {
    phone.add(curledFinger(material, [
      [0.056, y - 0.021, -0.018],
      [0.043, y, -0.016],
      [0.030, y + 0.001, -0.014],
      [0.026 - reach, y + 0.005, -0.013]
    ], radius));
  }

  const lower = oval(material, [0, 0, 0], [0.008, 1, 0.0075]);
  const tip = oval(material, [0, 0, 0], [0.007, 1, 0.0062]);
  lower.name = 'phone-thumb-base';
  tip.name = 'phone-thumb-tip';
  phone.add(lower, tip);

  const base = new THREE.Vector3(0.049, -0.068, -0.012);
  const knuckle = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();

  function placeSegment(mesh, a, b, overlap) {
    mesh.position.copy(a).lerp(b, 0.5);
    direction.subVectors(b, a);
    mesh.scale.y = direction.length() / 2 + overlap;
    mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  }

  function pose(x = 0, y = 0, pressing = false) {
    knuckle.set(0.050 + x * 0.42, -0.052 + y * 0.42, 0.004);
    end.set(0.044 + x, -0.034 + y, pressing ? 0.012 : 0.008);
    placeSegment(lower, base, knuckle, 0.006);
    placeSegment(tip, knuckle, end, 0.004);
  }

  pose();
  return pose;
}

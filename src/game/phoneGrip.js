import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

function oval(material, position, scale) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  return mesh;
}

function skinSurface(material, radial, length, radius) {
  const template = new THREE.SphereGeometry(1, radial, length);
  template.deleteAttribute('normal');
  template.deleteAttribute('uv');
  const geometry = mergeVertices(template);
  template.dispose();

  const points = geometry.attributes.position;
  const bind = points.array.slice();
  const center = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const mesh = new THREE.Mesh(geometry, material);

  function bend(curve, frameAxis) {
    for (let i = 0; i < points.count; i++) {
      const j = i * 3;
      const t = THREE.MathUtils.clamp((bind[j + 1] + 1) / 2, 0, 1);
      const r = radius(t);
      curve.getPoint(t, center);
      curve.getTangent(t, tangent).normalize();
      across.crossVectors(frameAxis, tangent).normalize();
      normal.crossVectors(tangent, across);
      center.addScaledVector(normal, bind[j] * r);
      center.addScaledVector(across, bind[j + 2] * r);
      points.setXYZ(i, center.x, center.y, center.z);
    }
    points.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  return { mesh, bend };
}

function fingerRadius(base, t) {
  const knuckle = Math.exp(-((t - 0.36) ** 2) / 0.018);
  const joint = Math.exp(-((t - 0.68) ** 2) / 0.01);
  return base * (1.07 - t * 0.43 + knuckle * 0.15 + joint * 0.12);
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
    const finger = skinSurface(material, 12, 18, t => fingerRadius(radius, t));
    const joints = [
      [0.055, y - 0.018, -0.021],
      [0.046, y - 0.002, -0.020],
      [0.032, y + 0.002, -0.016],
      [0.026 - reach * 0.45, y + 0.005, -0.015],
      [0.026 - reach, y + 0.008, -0.012]
    ];
    finger.bend(new THREE.CatmullRomCurve3(joints.map(p => new THREE.Vector3(...p))), Y_AXIS);
    phone.add(finger.mesh);
  }

  const thumb = skinSurface(material, 12, 20, t => 0.008 * (1 - 0.30 * t + 0.12 * Math.sin(t * Math.PI)));
  thumb.mesh.name = 'phone-thumb';
  phone.add(thumb.mesh);
  const root = new THREE.Vector3(0.051, -0.069, -0.014);
  const aroundEdge = new THREE.CubicBezierCurve3(
    root,
    new THREE.Vector3(0.057, -0.065, -0.007),
    new THREE.Vector3(0.054, -0.064, 0.016),
    new THREE.Vector3(0.054, -0.053, 0.017)
  );
  const aboveGlass = new THREE.CubicBezierCurve3(
    aroundEdge.v3,
    new THREE.Vector3(0.054, -0.044, 0.017),
    new THREE.Vector3(),
    new THREE.Vector3()
  );
  const blend = {
    getPoint(t, out) { return t < 0.47 ? aroundEdge.getPoint(t / 0.47, out) : aboveGlass.getPoint((t - 0.47) / 0.53, out); },
    getTangent(t, out) { return t < 0.47 ? aroundEdge.getTangent(t / 0.47, out) : aboveGlass.getTangent((t - 0.47) / 0.53, out); }
  };
  let lastX = Infinity;
  let lastY = Infinity;
  let lastPress = false;

  function pose(x = 0, y = 0, pressing = false) {
    const endX = 0.048 + Math.max(-0.032, Math.min(0, x));
    const endY = -0.032 + Math.max(-0.013, Math.min(0.034, y));
    x = endX - 0.048;
    y = endY + 0.032;
    if (Math.abs(x - lastX) < 0.0002 && Math.abs(y - lastY) < 0.0002 && pressing === lastPress) return;
    lastX = x;
    lastY = y;
    lastPress = pressing;
    // The turn happens outside the case. Only the last segment moves inward,
    // and its radius fits entirely in front of the display even when pressed.
    aboveGlass.v2.set(endX + 0.010, endY - 0.012, 0.0155);
    aboveGlass.v3.set(endX, endY, pressing ? 0.014 : 0.016);
    thumb.bend(blend, X_AXIS);
  }

  pose();
  return pose;
}

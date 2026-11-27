import * as THREE from 'three';
import { importedCartonGeometry } from './marketCarton.js';

const GOODS = {
  oats: ['OATS', '#426b70', 'box', 0.21, 0.28, 0.10],
  cereal: ['CEREAL', '#956143', 'box', 0.22, 0.30, 0.11],
  pasta: ['PASTA', '#7e503d', 'box', 0.13, 0.26, 0.09],
  tomatoes: ['TOMATOES', '#a94f39', 'can', 0.13, 0.16, 0.13],
  beans: ['BEANS', '#695044', 'can', 0.13, 0.16, 0.13],
  soup: ['SOUP', '#bd8544', 'can', 0.13, 0.16, 0.13],
  chips: ['CHIPS', '#ad6b37', 'pouch', 0.19, 0.24, 0.11],
  crackers: ['CRACKERS', '#896354', 'box', 0.19, 0.21, 0.10],
  juice: ['JUICE', '#a76829', 'bottle', 0.13, 0.26, 0.13],
  milk: ['MILK', '#4e7399', 'carton', 0.14, 0.24, 0.14],
  yogurt: ['YOGURT', '#90638b', 'can', 0.115, 0.10, 0.115],
  sandwich: ['SANDWICH', '#587653', 'wedge', 0.19, 0.13, 0.15],
  apples: ['', '#a54232', 'fruit', 0.135, 0.125, 0.13],
  pears: ['', '#82914a', 'fruit', 0.13, 0.16, 0.13],
  oranges: ['', '#cb8239', 'fruit', 0.132, 0.13, 0.132]
};

export const AISLE_STOCK = [
  ['oats', 'cereal', 'pasta'],
  ['tomatoes', 'beans', 'soup'],
  ['chips', 'crackers', 'chips'],
  ['juice', 'crackers', 'oats']
];

function labelTexture(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f3ead6';
  ctx.fillRect(5, 34, 118, 64);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#292b25';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('MAPLE PANTRY', 64, 24);
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText(name, 64, 73, 110);
  ctx.fillStyle = '#f3ead6';
  ctx.fillRect(95, 107, 22, 11);
  ctx.fillStyle = '#272721';
  for (const x of [98, 101, 103, 108, 111, 114]) ctx.fillRect(x, 108, 1, 9);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

function shape(type, w, h, d) {
  if (type === 'carton') return importedCartonGeometry(w, h, d);
  if (type === 'can') return new THREE.CylinderGeometry(w / 2, w / 2, h, 10);
  if (type === 'bottle' || type === 'fruit') {
    const profile = type === 'fruit'
      ? [[0,0],[.26,.02],[.47,.25],[.49,.57],[.40,.82],[.17,1],[0,1]]
      : [[0,0],[.42,.02],[.49,.08],[.49,.67],[.36,.78],[.18,.84],[.18,.92],[.25,.92],[.25,1],[0,1]];
    return new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r*w,(y-.5)*h)), 10);
  }
  if (type === 'pouch' || type === 'wedge') {
    const geo = new THREE.BoxGeometry(w, h, d, 1, type === 'pouch' ? 3 : 1, 1);
    const pos = geo.attributes.position;
    for (let i=0; i<pos.count; i++) {
      const y = pos.getY(i) / h + .5;
      const factor = type === 'wedge' ? 1-y*.75 : 1-Math.abs(y-.5)*.52;
      pos.setZ(i,pos.getZ(i)*factor);
    }
    geo.computeVertexNormals();
    return geo;
  }
  return new THREE.BoxGeometry(w,h,d);
}

export function buildMarketStock(parent, placements, quality) {
  const batches = new Map();
  for (const placement of placements) {
    if (!batches.has(placement.sku)) batches.set(placement.sku, []);
    batches.get(placement.sku).push(placement);
  }
  const transform = new THREE.Object3D();
  for (const [sku, rows] of batches) {
    const [name, color, type, w, h, d] = GOODS[sku];
    const carton = type === 'carton';
    const material = new THREE.MeshStandardMaterial({
      color: carton ? 0xffffff : color, map: carton ? labelTexture(name, color) : null, roughness: 0.76
    });
    const items = new THREE.InstancedMesh(shape(type,w,h,d), material, rows.length);
    items.name = 'market-stock-' + sku;
    items.receiveShadow = !!quality.shadows;
    const labels = name && !carton ? new THREE.InstancedMesh(
      new THREE.PlaneGeometry(w*.77,h*(type === 'bottle' ? .49 : .63)),
      new THREE.MeshStandardMaterial({map:labelTexture(name,color),roughness:0.88}), rows.length
    ) : null;
    rows.forEach(({x,y,z,yaw=0},i) => {
      transform.position.set(x,y+h/2,z);
      transform.rotation.set(0,yaw,0);
      transform.updateMatrix();
      items.setMatrixAt(i,transform.matrix);
      if (labels) {
        const offset = d/2+.001;
        transform.position.x += Math.sin(yaw)*offset;
        transform.position.z += Math.cos(yaw)*offset;
        transform.updateMatrix();
        labels.setMatrixAt(i,transform.matrix);
      }
    });
    parent.add(items);
    if (labels) parent.add(labels);
  }
}

import * as THREE from 'three';
import { Parts } from './parts.js';

const DASH = 0x2d3032;
const FABRIC = 0x555c5f;
const TRIM = 0x9ea5a5;
const BLACK = 0x17191a;
const WHEEL = { x: 0.37, y: 1.13, z: -0.42 };

function plate(width, height, resolution, paint, glow = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = Math.round(resolution * height / width);
  const context = canvas.getContext('2d');
  paint(context, canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({
    map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow, roughness: 0.88
  }));
  mesh.rotation.y = -Math.PI / 2;
  return { mesh, context, canvas, map };
}

function dial(radius, top, step, label) {
  const { mesh } = plate(radius * 2, radius * 2, 128, (ctx, w) => {
    ctx.fillStyle = '#161c22';
    ctx.fillRect(0, 0, w, w);
    ctx.translate(w / 2, w / 2);
    ctx.strokeStyle = '#a9bac0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 61, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#edf1e5';
    for (let v = 0; v <= top; v += step) {
      const a = 2.32 + (v / top) * 4.78;
      ctx.fillText(String(v), Math.cos(a) * 46, Math.sin(a) * 46);
    }
    ctx.font = '9px sans-serif';
    ctx.fillText(label, 0, 21);
  }, 0.42);
  const pivot = new THREE.Group();
  pivot.position.z = 0.002;
  const needle = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.7, 0.004, 0.002),
    new THREE.MeshBasicMaterial({color:0xff7856}));
  needle.position.x = radius * 0.32;
  pivot.add(needle);
  mesh.add(pivot);
  return { mesh, set(value) { pivot.rotation.z = -(2.32 + THREE.MathUtils.clamp(value / top, 0, 1) * 4.78); } };
}

export function createCarInterior(car) {
  const cabin = new THREE.Group();
  cabin.name = 'driving-interior';
  cabin.visible = false;
  car.add(cabin);
  const exterior = ['car-cabin','car-rear-window','car-steering'].map(name => car.getObjectByName(name)).filter(Boolean);
  const shape = new Parts(true);
  const box = (...args) => shape.box(...args);
  shape.bevelMax = 0.045;

  // A separate soft-touch top gives the dash a quiet grain in side light.
  const dash = new Parts(false);
  dash.bevelMax = 0.07;
  dash.bevelSegments = 2;
  dash.box(DASH,0.32,0.16,1.59,0.70,1.18,0,0,0,-0.08);
  const grain = document.createElement('canvas');
  grain.width = grain.height = 64;
  const grainContext = grain.getContext('2d');
  const pixels = grainContext.createImageData(64,64);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const hash= Math.imul(i ^ 0x41df2a,0x45d9f3b);
    pixels.data[i] = 128 + ((hash >>> 12) % 17 - 8);
    pixels.data[i+1] = 128 + ((hash >>> 19) % 17 - 8);
    pixels.data[i+2] = 255;
    pixels.data[i+3] = 255;
  }
  grainContext.putImageData(pixels,0,0);
  const grainMap = new THREE.CanvasTexture(grain);
  grainMap.wrapS = grainMap.wrapT = THREE.RepeatWrapping;
  grainMap.repeat.set(8,4);
  cabin.add(new THREE.Mesh(dash.merge(),new THREE.MeshStandardMaterial({
    color:DASH,roughness:0.85,normalMap:grainMap,normalScale:new THREE.Vector2(0.14,0.14)
  })));
  box(FABRIC,0.23,0.13,1.55,0.69,1.06,0);
  box(TRIM,0.018,0.017,1.5,0.525,1.13,0);
  shape.bevelSegments = 2;
  box(BLACK,0.15,0.12,0.49,0.59,1.31,-0.42);
  shape.bevelSegments = 1;
  box(BLACK,0.12,0.25,0.39,0.56,1.055,0.08,0,0,-0.12);
  for(const z of [-0.72,-0.06,0.21,0.72]) {
    box(BLACK,0.025,0.064,0.17,0.523,1.199,z);
    for(const y of [1.182,1.2,1.218]) box(TRIM,0.008,0.006,0.14,0.508,y,z);
  }
  for(const z of [-0.038,0.087,0.21]) shape.cylinder(TRIM,0.022,0.023,0.025,0.478,0.995,z,0,0,Math.PI/2,12);
  box(0x9f3730,0.02,0.025,0.051,0.48,1.067,0.087);
  box(BLACK,0.81,0.16,0.31,-0.04,0.9,0.05);
  box(TRIM,0.16,0.023,0.122,0.235,0.992,0.042);
  box(BLACK,0.045,0.112,0.04,0.223,1.037,0.042,0,0,0.26);
  box(FABRIC,0.079,0.042,0.071,0.211,1.094,0.042);
  box(BLACK,0.15,0.025,0.042,-0.27,1.008,0.17,0,0,0.15);
  for(const x of [-0.05,-0.2]) {
    shape.cylinder(TRIM,0.064,0.064,0.008,x,0.985,0.045,0,0,0,14);
    shape.cylinder(BLACK,0.052,0.052,0.009,x,0.991,0.045,0,0,0,14);
  }
  box(DASH,0.155,0.015,0.105,-0.02,0.987,0.178);

  shape.bevelSegments = 2;
  for(const z of [-0.43,0.46]) {
    box(FABRIC,0.61,0.15,0.43,-0.36,0.87,z);
    box(0x656c6d,0.50,0.025,0.29,-0.34,0.954,z);
    box(FABRIC,0.16,0.49,0.44,-0.67,1.10,z,0,0,0.13);
    box(0x656c6d,0.035,0.37,0.29,-0.57,1.09,z,0,0,0.13);
    box(BLACK,0.15,0.15,0.24,-0.71,1.41,z);
    for(const edge of [-1,1]) {
      box(FABRIC,0.50,0.072,0.085,-0.35,0.959,z+edge*0.172,edge*0.17);
      box(TRIM,0.42,0.005,0.006,-0.34,0.971,z+edge*0.132);
    }
  }
  shape.bevelSegments = 1;
  box(FABRIC,0.48,0.19,1.39,-1.03,0.89,0);
  box(BLACK,0.035,0.58,0.04,-0.52,1.15,-0.64,0.3,0,0.34);
  for(const side of [-1,1]) {
    const z=side*0.73;
    box(DASH,1.44,0.27,0.09,-0.16,1.04,z);
    box(FABRIC,1.38,0.048,0.112,-0.18,1.21,z);
    box(BLACK,0.41,0.071,0.12,-0.08,1.113,z-side*0.065);
    box(TRIM,0.13,0.028,0.04,0.23,1.16,z-side*0.08);
    for(let i=0;i<3;i++) box(BLACK,0.031,0.013,0.031,-0.01-i*0.041,1.154,z-side*0.063);
    shape.cylinder(BLACK,0.078,0.078,0.015,0.29,1.001,z-side*0.065,Math.PI/2,0,0,18);
    box(DASH,0.075,0.5,0.07,0.60,1.41,z-side*0.095,0,0,-0.59);
    box(FABRIC,0.18,0.026,0.37,0.30,1.71,side*0.365);
  }
  box(FABRIC,1.18,0.032,1.29,-0.23,1.73,0);
  box(DASH,0.07,0.084,0.28,0.365,1.62,0);
  box(0x455358,0.008,0.058,0.248,0.325,1.62,0);
  box(BLACK,0.018,0.075,0.022,0.375,1.68,0);
  box(BLACK,0.19,0.078,0.11,0.47,WHEEL.y,WHEEL.z);
  for(const side of [-1,1]) box(BLACK,0.022,0.023,0.16,0.43,WHEEL.y+0.03,WHEEL.z+side*0.14,0,side*0.3,0);
  cabin.add(new THREE.Mesh(shape.merge(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85})));

  const glass = new THREE.MeshStandardMaterial({color:0xb4d3d6,transparent:true,opacity:0.055,depthWrite:false,side:THREE.DoubleSide,roughness:0.18});
  for(const side of [-1,1]) {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(1.20,0.47),glass);
    window.position.set(-0.15,1.454,side*0.700);
    cabin.add(window);
  }
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.29,0.52),glass);
  windshield.rotation.set(0,-Math.PI/2,0);
  windshield.rotateX(-0.55);
  windshield.position.set(0.66,1.44,0);
  cabin.add(windshield);

  const wheel = new THREE.Group();
  wheel.position.set(WHEEL.x,WHEEL.y,WHEEL.z);
  wheel.rotation.order = 'YXZ';
  wheel.rotation.y = -Math.PI / 2;
  const rubber = new THREE.MeshStandardMaterial({color:BLACK,roughness:0.88});
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.181,0.022,10,40),rubber));
  const spokes = new Parts(true);
  for(const a of [0,Math.PI,3*Math.PI/2]) spokes.box(DASH,0.14,0.028,0.022,Math.cos(a)*0.091,Math.sin(a)*0.091,0,0,0,a);
  spokes.box(BLACK,0.136,0.095,0.049,0,0,0.011);
  wheel.add(new THREE.Mesh(spokes.merge(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.76})));
  const grips = [-1,1].map(side => {
    const grip = new THREE.Object3D();
    grip.position.set(side*0.169,0.065,0.034);
    wheel.add(grip);
    return grip;
  });
  cabin.add(wheel);

  const gauges = [[dial(0.09,120,20,'MPH'),0.49,1.292,-0.51],[dial(0.075,8,2,'RPM × 1000'),0.49,1.286,-0.33],
    [dial(0.035,4,2,'FUEL'),0.481,1.21,-0.51],[dial(0.035,4,2,'TEMP'),0.481,1.21,-0.32]];
  for(const [d,x,y,z] of gauges) { d.mesh.position.set(x,y,z); cabin.add(d.mesh); }
  const screen = plate(0.29,0.12,256,()=>{},0.62);
  screen.mesh.position.set(0.485,1.047,0.083);
  cabin.add(screen.mesh);
  const phone = plate(0.08,0.126,128,()=>{},0.62);
  phone.mesh.rotation.set(-Math.PI/2,0,-Math.PI/2);
  phone.mesh.position.set(-0.006,0.998,0.174);
  cabin.add(phone.mesh);

  const moving = new Parts(true);
  for(const [x,y,z,w,h,d] of [[-0.35,1.08,0.43,0.43,0.25,0.38],[-0.91,1.12,0.29,0.38,0.36,0.42],[-1.09,1.08,-0.34,0.34,0.29,0.33]]) {
    moving.box(0xab8150,w,h,d,x,y,z);
    moving.box(0xd7b882,w+0.004,0.006,0.06,x,y+h/2,z);
  }
  moving.cylinder(0x7b775a,0.074,0.074,0.58,-1,1.35,-0.06,Math.PI/2,0,0,12);
  moving.cylinder(TRIM,0.016,0.016,0.34,-0.37,1.3,0.43);
  moving.cylinder(0xd7c4a0,0.07,0.13,0.14,-0.37,1.49,0.43);
  moving.cylinder(0xe9ddc6,0.042,0.048,0.124,-0.073,1.055,0.043);
  moving.cylinder(0x6e593e,0.047,0.047,0.015,-0.073,1.122,0.043);
  const props = new THREE.Mesh(moving.merge(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.94}));
  cabin.add(props);

  const fill = new THREE.HemisphereLight(0xffecce,0x737d91,0.43);
  cabin.add(fill);
  let lastScreen = '';
  let lastPhone = null;
  function display(target, lines) {
    const {context:ctx,canvas,map} = target;
    ctx.fillStyle = '#111b22';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#d8f0eb';
    ctx.font = `${Math.floor(canvas.width/15)}px sans-serif`;
    lines.forEach((line,i)=>ctx.fillText(line,8,24+i*21,canvas.width-16));
    map.needsUpdate = true;
  }
  return {
    grips,
    update({ visible, speed=0, steer=0, fuel=1, opening=false, boxes=false, notice=false, clock='', shade=1 }) {
      if (cabin.visible !== visible) {
        cabin.visible = visible;
        for(const mesh of exterior) mesh.visible = !visible;
      }
      if (!visible) return;
      props.visible = opening || boxes;
      fill.intensity = 0.43 * shade;
      wheel.rotation.z = -steer * 2.6;
      gauges[0][0].set(Math.abs(speed)*2.237);
      gauges[1][0].set(0.8+Math.abs(speed)*0.115);
      gauges[2][0].set(fuel*4);
      gauges[3][0].set(1.65+Math.abs(speed)*0.025);
      const glow = clock && (Number(clock.slice(0,2)) >= 19 || Number(clock.slice(0,2)) < 6) ? 0.7 : 0.42;
      for(const [gauge] of gauges) gauge.mesh.material.emissiveIntensity = glow;
      const label = opening ? 'radio' : clock;
      if (lastScreen !== label) {
        lastScreen = label;
        display(screen,opening ? ['WMPL 98.1 · Maple Lane Radio','Carefree'] : ['MAPLE LANE',clock,'Local route']);
      }
      if (lastPhone !== notice) {
        lastPhone = notice;
        display(phone,notice ? ['RITA','Keys are ready!', 'See you at 8:30.'] : []);
      }
    }
  };
}

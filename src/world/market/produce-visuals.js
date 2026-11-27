// From Night Stock (the user's grocery game), via the Maple Lane Market kit.
import * as T from 'three';
export const VEGETABLES=['Lettuce','Carrots','Broccoli','Red peppers','Yellow peppers','Cucumbers','Eggplant','Tomatoes'];
export function createVegetables(texture){
 let seed=7331;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const skin=(base,specks,roughness=.6,veins=false)=>{const material=new T.MeshStandardMaterial({color:0xffffff,roughness,map:texture((c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);for(let i=0;i<900;i++){c.fillStyle=specks[i%2];c.globalAlpha=.12+random()*.20;c.beginPath();c.ellipse(random()*w,random()*h,.7+random()*2,.6+random()*2,0,0,Math.PI*2);c.fill();}c.globalAlpha=1;if(veins){c.strokeStyle='#c9e49855';c.lineWidth=2;c.beginPath();c.moveTo(w/2,h);c.quadraticCurveTo(w*.42,h*.5,w/2,0);c.stroke();for(let i=1;i<7;i++)for(const side of [-1,1]){c.beginPath();c.moveTo(w/2,h*i/7);c.quadraticCurveTo(w*(.5+side*.13),h*(i-.4)/7,w*(.5+side*.39),h*(i-1.7)/7);c.stroke();}}},128,128)});material.userData.fallbackColor=base;return material;};
 const greens=[skin('#5d903c',['#d3dd88','#325c25'],.84,true),skin('#83ad4f',['#d3df8c','#4c7933'],.84,true),skin('#a0bc63',['#e4e7a8','#638941'],.84,true)],stalk=skin('#86a85a',['#d5dc9e','#416735']),broccoli=skin('#315f30',['#9bab59','#142f1e'],.94),orange=skin('#dd7928',['#f5b15c','#a95820'],.74),red=skin('#b93626',['#e66340','#812623'],.31),yellow=skin('#e3b336',['#f6d970','#ad7b27'],.33),cucumber=skin('#365d2a',['#9ca355','#1c3d20'],.52),purple=skin('#50314d',['#98658a','#302130'],.28),tomato=skin('#c3442d',['#ea7a4c','#942e23'],.37);
 const sphere=new T.SphereGeometry(1,12,8),leaf=new T.SphereGeometry(1,12,6),stemGeo=new T.CylinderGeometry(.013,.019,.10,7);
 // Ripple the margins of each lettuce leaf; veins follow its surface texture.
 const lp=leaf.attributes.position;for(let i=0;i<lp.count;i++){const x=lp.getX(i),y=lp.getY(i),z=lp.getZ(i),a=Math.atan2(z,x),r=1+.075*Math.sin(a*9+y*5);lp.setXYZ(i,x*r,y*(1+.035*Math.cos(a*7)),z*r);}leaf.computeVertexNormals();
 const pepper=new T.SphereGeometry(1,16,10),pp=pepper.attributes.position;for(let i=0;i<pp.count;i++){let x=pp.getX(i),y=pp.getY(i),z=pp.getZ(i),a=Math.atan2(z,x),r=1+.15*Math.cos(4*a);pp.setXYZ(i,x*r*.115,y*.13+Math.max(0,y)*-.018,z*r*.115);}pepper.computeVertexNormals();
 const carrot=new T.LatheGeometry([[0,0],[.009,.018],[.025,.10],[.039,.22],[.047,.29],[.042,.32],[.014,.332],[0,.333]].map(([r,y])=>new T.Vector2(r,y)),12);
 const egg=new T.LatheGeometry([[0,0],[.065,.015],[.105,.07],[.112,.16],[.087,.24],[.055,.30],[.021,.34],[0,.35]].map(([r,y])=>new T.Vector2(r,y)),12);
 const broccoliStem=new T.CylinderGeometry(.042,.029,.16,8),broccoliBranch=new T.CylinderGeometry(.020,.025,.11,6);
 const curvedStem=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.007,.046,.006),new T.Vector3(.027,.076,.008)]),6,.012,5,false);
 function build(name,variant=0){if(!VEGETABLES.includes(name))throw Error('Unknown vegetable');const g=new T.Group();g.name='Fresh '+name;g.userData.vegetable=name;
 const mesh=(geo,material,x,y,z,sx=1,sy=sx,sz=sx,parent=g)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
 const ellipsoid=(material,x,y,z,sx,sy,sz,parent=g)=>mesh(sphere,material,x,y,z,sx,sy,sz,parent);
 if(name==='Lettuce'){
  ellipsoid(greens[2],0,.12,0,.12,.115,.12);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7,m=mesh(leaf,greens[i%2],Math.cos(a)*.085,.103,Math.sin(a)*.085,.11,.052,.14);m.rotation.set(Math.sin(a)*.55,a,Math.cos(a)*-.55);}
  for(let i=0;i<3;i++){const m=mesh(leaf,greens[1+i%2],Math.cos(i*2.4)*.035,.193,Math.sin(i*2.4)*.035,.084,.041,.093);m.rotation.z=(i-1)*.25;}
 }else if(name==='Carrots'){
  const bunch=new T.Group();g.add(bunch);mesh(carrot,orange,0,0,0,1,1,1,bunch);
  for(let i=0;i<5;i++){const blade=ellipsoid(greens[i%2],(i-2)*.014,.375+Math.sin(i)*.012,0,.014,.069,.009,bunch);blade.rotation.z=(2-i)*.18;}
  bunch.rotation.z=-Math.PI/2;bunch.position.set(-.17,.052,0);
 }else if(name==='Broccoli'){
  mesh(broccoliStem,stalk,0,.08,0);
  for(let i=0;i<6;i++){const a=i*2.399,r=i===0?0:.075,x=Math.cos(a)*r,z=Math.sin(a)*r,y=i===0?.22:.18;const branch=mesh(broccoliBranch,stalk,x*.6,.14,z*.6);branch.rotation.z=-x*5;branch.rotation.x=z*5;ellipsoid(broccoli,x,y,z,.077,.063,.078);}
 }else if(name.endsWith('peppers')){mesh(pepper,name==='Red peppers'?red:yellow,0,.137,0);mesh(curvedStem,stalk,0,.244,0);ellipsoid(stalk,0,.246,0,.038,.009,.037);
 }else if(name==='Cucumbers'){
  const body=ellipsoid(cucumber,0,.067,0,.062,.06,.225);body.rotation.x=.04;mesh(stemGeo,stalk,0,.068,-.222,.45,.33,.45).rotation.x=Math.PI/2;
 }else if(name==='Eggplant'){
  const body=new T.Group();g.add(body);mesh(egg,purple,0,0,0,1,1,1,body);ellipsoid(stalk,0,.32,0,.05,.024,.05,body);mesh(curvedStem,stalk,0,.335,0,1,1,1,body);body.rotation.z=-.30;body.position.set(-.04,.01,0);
 }else{ellipsoid(tomato,0,.092,0,.125,.092,.125);for(let i=0;i<5;i++){const a=i*Math.PI*2/5,l=ellipsoid(stalk,Math.cos(a)*.028,.182,Math.sin(a)*.028,.014,.005,.042);l.rotation.y=-a+Math.PI/2;}mesh(curvedStem,stalk,0,.18,0,.55,.55,.55);}
 const bottom=new T.Box3().setFromObject(g).min.y;for(const child of g.children)child.position.y-=bottom;
 const size=1+((variant*7)%5-2)*.025;g.scale.setScalar(size);g.rotation.y=(variant*2.399)% (Math.PI*2);return g;
 }
 return {build};
}
export function populateProduceBins({scene,box,solid,wood,black,mat,sign,texture}){
 const vegetables=createVegetables(texture),liner=mat('#354b31'),rail=mat('#62472e');let display=0;
 for(const x of [178,193,208])for(const z of [109,120,131]){
  solid(5,1.03,4.5,wood,x,.515,z);box(4.8,.1,4.3,black,x,1.07,z);
  for(let bin=0;bin<4;bin++){
   const xx=x+(bin%2?1.2:-1.2),zz=z+(bin<2?-1.1:1.1),name=VEGETABLES[(display+bin)%VEGETABLES.length];
   box(2.2,.12,1.95,wood,xx,1.15,zz);box(2.10,.012,1.84,liner,xx,1.217,zz);
   for(const side of [-1,1]){box(2.2,.14,.045,rail,xx,1.27,zz+side*.95);box(.045,.14,1.9,rail,xx+side*1.08,1.27,zz);}
   for(let k=0;k<16;k++){const vegetable=vegetables.build(name,k+bin*13),u=(k%4)-1.5,v=Math.floor(k/4)-1.5;vegetable.position.set(xx+u*.43+Math.sin(k*5)*.023,1.225,zz+v*.39+Math.cos(k*3)*.019);scene.add(vegetable);}
   const price=sign(name.toUpperCase()+'  /  FRESH',1.25,.19,xx,1.17,zz+.992,'#234936','#f9efd0');price.name='Produce bin label · '+name;
  }
  display+=3;
 }
}

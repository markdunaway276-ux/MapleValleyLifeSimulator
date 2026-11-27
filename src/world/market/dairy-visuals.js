// From Night Stock (the user's grocery game), via the Maple Lane Market kit.
import * as T from 'three';
export const DAIRY_HEIGHTS={Milk:.38,Yogurt:.15,Butter:.10,Cheddar:.18};
export function createDairyPackaging(texture){
 const plastic=new T.MeshStandardMaterial({color:0xf1f2e8,roughness:.38}),foil=new T.MeshStandardMaterial({color:0xd5dce0,roughness:.32,metalness:.65}),blue=new T.MeshStandardMaterial({color:0x285a9b,roughness:.4}),yellow=new T.MeshStandardMaterial({color:0xefb94b,roughness:.55});
 const label=(name,sub,color)=>new T.MeshStandardMaterial({map:texture((c,w,h)=>{c.fillStyle='#f7f6ec';c.fillRect(0,0,w,h);c.fillStyle=color;c.fillRect(0,0,w,h*.24);c.fillRect(0,h*.88,w,h*.12);c.textAlign='center';c.fillStyle='#fff';c.font='bold 18px Arial';c.fillText('FRESH DAIRY',w/2,h*.17);c.fillStyle=color;c.font='bold 36px Arial';c.fillText(name,w/2,h*.48,w*.94);c.font='18px Arial';c.fillText(sub,w/2,h*.66,w*.95);c.font='13px Arial';c.fillText('KEEP REFRIGERATED',w/2,h*.81);},256,192),roughness:.65});
 const milkLabel=label('MILK','2% REDUCED FAT · 1 GAL','#285a9b'),yogurtLabel=label('YOGURT','STRAWBERRY · 5.3 OZ','#ae3b60'),butterLabel=label('BUTTER','SALTED · 8 OZ','#8b7130'),cheeseLabel=label('CHEDDAR','NATURAL CHEESE · 8 OZ','#9b5424');
 function jugGeo(){const s=new T.Shape();s.moveTo(-.105,-.18);s.quadraticCurveTo(-.11,-.18,-.11,-.15);s.lineTo(-.11,.045);s.quadraticCurveTo(-.11,.065,-.085,.09);s.lineTo(-.045,.133);s.lineTo(-.038,.155);s.lineTo(.012,.155);s.lineTo(.02,.125);s.lineTo(.105,.065);s.lineTo(.11,-.15);s.quadraticCurveTo(.11,-.18,.085,-.18);s.closePath();const hole=new T.Path();hole.moveTo(.044,.088);hole.lineTo(.081,.057);hole.lineTo(.080,.005);hole.quadraticCurveTo(.057,-.008,.043,.012);hole.closePath();s.holes.push(hole);const g=new T.ExtrudeGeometry(s,{depth:.128,bevelEnabled:true,bevelThickness:.009,bevelSize:.005,bevelSegments:2,curveSegments:5,steps:1});g.translate(0,0,-.064);return g;}
 const jug=jugGeo(),tub=new T.CylinderGeometry(.105,.080,.13,20),lid=new T.CylinderGeometry(.111,.111,.008,20),cap=new T.CylinderGeometry(.029,.029,.022,16),butterTub=new T.CylinderGeometry(.105,.09,.08,16),butterLid=new T.CylinderGeometry(.11,.11,.012,16),cheese=new T.BoxGeometry(.20,.15,.045);
 function build(name){const group=new T.Group();group.name='Retail dairy · '+name;const mesh=(geo,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);group.add(m);return m;};
  const front=(w,h,m,y,z)=>mesh(new T.PlaneGeometry(w,h),m,0,y,z);
  if(name==='Milk'){mesh(jug,plastic);mesh(cap,blue,-.013,.168);front(.148,.122,milkLabel,-.061,.074);front(.148,.122,milkLabel,-.061,-.074).rotation.y=Math.PI;}
  else if(name==='Yogurt'){mesh(tub,[yogurtLabel,plastic,plastic],0,-.005);mesh(lid,foil,0,.066);const top=mesh(new T.CircleGeometry(.104,20),yogurtLabel,0,.0705);top.rotation.x=-Math.PI/2;mesh(new T.BoxGeometry(.027,.002,.018),foil,.101,.069);}
  else if(name==='Butter'){mesh(butterTub,[butterLabel,plastic,plastic],0,-.006);mesh(butterLid,yellow,0,.04);const top=mesh(new T.CircleGeometry(.102,16),butterLabel,0,.0465);top.rotation.x=-Math.PI/2;}
  else {mesh(cheese,yellow,0,-.015);mesh(new T.BoxGeometry(.216,.18,.005),foil,0,0,-.026);front(.19,.08,cheeseLabel,.033,.024);}
  return group;
 }
 return {has:name=>name in DAIRY_HEIGHTS,height:name=>DAIRY_HEIGHTS[name],build};
}
export function addDairyCase({box,mat,texture,scene,start,end,origin,side}){
 const length=end-start,center=(start+end)/2,back=origin+side*2.65,face=origin+side*1.57;
 const enamel=mat('#e3e8e6'),trim=mat('#34474c',.3,.65),steel=mat('#aebabc',.28,.75),dark=mat('#28383d'),light=new T.MeshBasicMaterial({color:0xe4f6ff});
 for(let y=.22;y<2.62;y+=.44)box(.13,.44,length,enamel,back,y,center);box(1.13,.22,length,trim,origin+side*2.12,.12,center);box(1.13,.19,length,trim,origin+side*2.12,2.55,center);
 for(const z of [start,end])box(1.12,2.65,.12,enamel,origin+side*2.12,1.33,z);
 for(let z=start;z<end;z+=2.4){box(.09,2.42,.07,steel,back-side*.10,1.34,z);box(.025,2.10,.035,light,back-side*.16,1.35,z+.09);}
 // Open-front refrigerated merchandiser: accessible shelves and visible cold air return.
 for(const y of [.35,.86,1.37,1.88]){for(let depth=0;depth<6;depth++)box(.15,.025,length,steel,origin+side*(1.745+depth*.15),y+.015,center);box(.025,.066,length,enamel,face,y-.015,center);box(.025,.012,length,light,face+side*.04,y-.06,center);}
 for(let z=start+.12;z<end;z+=.18)box(.21,.012,.018,dark,origin+side*1.77,.245,z);
 const header=texture((c,w,h)=>{c.fillStyle='#234e64';c.fillRect(0,0,w,h);c.fillStyle='#f3f7f4';c.textAlign='center';c.font='bold 46px Arial';c.fillText('FRESH DAIRY',w/2,h*.67);},512,128);
 const headerMaterial=new T.MeshStandardMaterial({map:header});
 for(let z=start+1.2;z<end;z+=2.4)box(.025,.28,2.36,[headerMaterial,headerMaterial,trim,trim,trim,trim],face,2.68,z);
 const prices=['MILK  $3.49','YOGURT  $0.89','BUTTER  $3.29','CHEESE  $2.49'];
 for(let z=start+.9;z<end;z+=1.8)for(let row=0;row<4;row++){const map=texture((c,w,h)=>{c.fillStyle='#fffdf0';c.fillRect(0,0,w,h);c.fillStyle='#263c40';c.font='bold 23px Arial';c.textAlign='center';c.fillText(prices[row],w/2,h*.65,w*.94);},256,64),m=new T.MeshStandardMaterial({map});box(.014,.055,.28,[m,m,enamel,enamel,enamel,enamel],face-side*.018,[.35,.86,1.37,1.88][row]-.015,z);}
}

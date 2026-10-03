
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const socket=io();
let myId=null,loggedIn=false,chatOpen=false;

const $=id=>document.getElementById(id);
const loginScreen=$('loginScreen'),loginBtn=$('loginBtn'),nameInput=$('nameInput'),passwordInput=$('passwordInput'),loginMsg=$('loginMsg'),hud=$('hud'),menu=$('menu'),playBtn=$('playBtn');
const coords=$('coords'),biomeEl=$('biome'),online=$('online'),playersList=$('playersList'),chatInput=$('chatInput'),messages=$('messages'),selectedName=$('selectedName'),dayState=$('dayState');

loginBtn.onclick=()=>{loginMsg.textContent='Conectando...';socket.emit('login',{name:nameInput.value,password:passwordInput.value});};
passwordInput.addEventListener('keydown',e=>{if(e.key==='Enter')loginBtn.click();});

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x82c6f4);
scene.fog=new THREE.Fog(0x82c6f4,55,135);

const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,400);
camera.position.set(0,20,0);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
document.body.prepend(renderer.domElement);

const controls=new PointerLockControls(camera,document.body);
controls.addEventListener('lock',()=>menu.classList.add('hidden'));
controls.addEventListener('unlock',()=>{if(loggedIn&&!chatOpen)menu.classList.remove('hidden');});
playBtn.onclick=()=>controls.lock();

function makeTexture(base,colors){
  const c=document.createElement('canvas');c.width=c.height=32;
  const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,32,32);
  for(let i=0;i<150;i++){x.fillStyle=colors[Math.floor(Math.random()*colors.length)]||base;x.fillRect(Math.random()*32|0,Math.random()*32|0,Math.random()>.82?2:1,Math.random()>.82?2:1);}
  const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;return t;
}

const tex={
 grass:makeTexture('#5fa63c',['#4b8c31','#73bd50','#3f7929']),
 dirt:makeTexture('#80502d',['#6a4024','#9c683b','#75472a']),
 stone:makeTexture('#858585',['#6e6e6e','#a1a1a1','#777']),
 sand:makeTexture('#d6c27c',['#c8b36e','#e4d492','#bba663']),
 wood:makeTexture('#99683d',['#7f542f','#b17945','#6b4528']),
 leaves:makeTexture('#3e8b3f',['#2f7331','#54a94e','#347d38']),
 snow:makeTexture('#eef5fb',['#dbe6ee','#fff','#ccd8e1'])
};
const materials={};
for(const [k,t] of Object.entries(tex))materials[k]=new THREE.MeshLambertMaterial({map:t});
materials.water=new THREE.MeshPhongMaterial({color:0x4b92d1,transparent:true,opacity:.55,shininess:90});

const hemi=new THREE.HemisphereLight(0xffffff,0x495c43,1.35);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.7);sun.position.set(60,80,30);sun.castShadow=true;scene.add(sun);
const sunBall=new THREE.Mesh(new THREE.SphereGeometry(3,12,12),new THREE.MeshBasicMaterial({color:0xffef9d}));scene.add(sunBall);

const cloudMat=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.78});
const clouds=[];
for(let i=0;i<12;i++){const g=new THREE.Group();for(let j=0;j<4;j++){const m=new THREE.Mesh(new THREE.BoxGeometry(4,1.2,2.4),cloudMat);m.position.x=j*2.5;m.position.z=(Math.random()-.5)*2;g.add(m);}g.position.set((Math.random()-.5)*120,30+Math.random()*8,(Math.random()-.5)*120);scene.add(g);clouds.push(g);}

const blockGeo=new THREE.BoxGeometry(1,1,1),blocks=new Map(),worldEdits=new Map(),worldGroup=new THREE.Group();
scene.add(worldGroup);
const key=(x,y,z)=>`${x},${y},${z}`;

function biomeAt(x,z){
 const t=Math.sin(x*.018)+Math.cos(z*.014);
 if(t>1.05)return'Desierto'; if(t<-1.05)return'Nevado';
 if(Math.sin((x+z)*.02)>.55)return'Bosque'; return'Llanura';
}
function terrainHeight(x,z){
 const hills=Math.sin(x*.07)*2.6+Math.cos(z*.06)*2.4;
 const broad=Math.sin((x+z)*.018)*4;
 const mountain=Math.max(0,Math.sin(x*.015)+Math.cos(z*.017)-1)*12;
 return Math.floor(7+hills+broad+mountain);
}
function topType(x,z,h){
 const b=biomeAt(x,z);if(b==='Desierto')return'sand';if(b==='Nevado'&&h>8)return'snow';if(h<=5)return'sand';return'grass';
}
function addBlock(x,y,z,type){
 const k=key(x,y,z);if(blocks.has(k))return;
 const mesh=new THREE.Mesh(blockGeo,materials[type]||materials.grass);mesh.position.set(x,y,z);mesh.userData.blockType=type;mesh.castShadow=true;mesh.receiveShadow=true;worldGroup.add(mesh);blocks.set(k,mesh);
}
function removeBlock(x,y,z){const k=key(x,y,z),m=blocks.get(k);if(!m)return;worldGroup.remove(m);blocks.delete(k);}
function growTree(x,y,z){
 const trunk=4+Math.floor(Math.random()*2);
 for(let i=0;i<trunk;i++)addBlock(x,y+i,z,'wood');
 for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=trunk-2;dy<=trunk;dy++)if(Math.abs(dx)+Math.abs(dz)<4)addBlock(x+dx,y+dy,z+dz,'leaves');
}
function generateWorld(){
 if(blocks.size)return;
 const size=86;
 for(let x=-size/2;x<size/2;x++)for(let z=-size/2;z<size/2;z++){
   const h=terrainHeight(x,z),b=biomeAt(x,z);
   for(let y=h-5;y<=h;y++){
     const k=key(x,y,z),edit=worldEdits.get(k);if(edit==='removed')continue;
     if(edit?.type){addBlock(x,y,z,edit.type);continue;}
     let type='stone';if(y===h)type=topType(x,z,h);else if(y>=h-2)type=topType(x,z,h)==='sand'?'sand':'dirt';
     addBlock(x,y,z,type);
   }
   if(h<5)for(let y=h+1;y<=5;y++){const w=new THREE.Mesh(blockGeo,materials.water);w.position.set(x,y,z);w.userData.isWater=true;worldGroup.add(w);}
   if(((b==='Bosque'&&Math.random()<.055)||(b==='Llanura'&&Math.random()<.018))&&h>5&&Math.abs(x)>3&&Math.abs(z)>3)growTree(x,h+1,z);
 }
 for(const [k,e] of worldEdits){if(!e||e==='removed'||!e.type)continue;const [x,y,z]=k.split(',').map(Number);if(!blocks.has(k))addBlock(x,y,z,e.type);}
}

socket.on('login-result',data=>{
 if(!data.ok){loginMsg.textContent=data.message;return;}
 myId=data.id;loggedIn=true;loginScreen.classList.add('hidden');hud.classList.remove('hidden');
 for(const [k,v] of Object.entries(data.worldEdits||{}))worldEdits.set(k,v);
 generateWorld();
 for(const p of data.players||[])if(p.id!==myId)addRemotePlayer(p);
 updatePlayersList(data.players||[]);controls.lock();
});

const remotePlayers=new Map();
function nameTag(text){
 const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
 x.fillStyle='rgba(0,0,0,.58)';x.fillRect(0,0,256,64);x.fillStyle='#fff';x.font='bold 28px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,32);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true}));s.scale.set(3.8,.95,1);s.position.y=2.45;return s;
}
function addRemotePlayer(p){
 if(remotePlayers.has(p.id))return;
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(.72,1.05,.42),new THREE.MeshLambertMaterial({color:0x3977d6}));body.position.y=.65;
 const head=new THREE.Mesh(new THREE.BoxGeometry(.68,.68,.68),new THREE.MeshLambertMaterial({color:0xe2b28b}));head.position.y=1.52;
 const legMat=new THREE.MeshLambertMaterial({color:0x2d2d38});
 const l1=new THREE.Mesh(new THREE.BoxGeometry(.25,.9,.28),legMat);l1.position.set(-.2,-.25,0);const l2=l1.clone();l2.position.x=.2;
 g.add(body,head,l1,l2,nameTag(p.name));g.position.set(p.x,p.y-1.75,p.z);scene.add(g);remotePlayers.set(p.id,g);
}
socket.on('player-joined',addRemotePlayer);
socket.on('player-moved',p=>{let r=remotePlayers.get(p.id);if(!r){addRemotePlayer(p);r=remotePlayers.get(p.id);}r.position.lerp(new THREE.Vector3(p.x,p.y-1.75,p.z),.35);r.rotation.y=p.yaw||0;});
socket.on('player-left',id=>{const p=remotePlayers.get(id);if(p){scene.remove(p);remotePlayers.delete(id);}});

function updatePlayersList(ps){playersList.innerHTML='';online.textContent=`Jugadores: ${ps.length}`;for(const p of ps){const d=document.createElement('div');d.textContent=p.id===myId?`${p.name} (Tú)`:p.name;playersList.appendChild(d);}}
socket.on('players-list',updatePlayersList);

const choices=[['grass','Césped'],['dirt','Tierra'],['stone','Piedra'],['sand','Arena'],['wood','Madera'],['leaves','Hojas'],['snow','Nieve']];
let selectedType='grass',keys={};

document.addEventListener('keydown',e=>{
 if(!chatOpen)keys[e.code]=true;
 const n=Number(e.key);if(n>=1&&n<=7){selectedType=choices[n-1][0];selectedName.textContent=choices[n-1][1];document.querySelectorAll('.slot').forEach((el,i)=>el.classList.toggle('selected',i===n-1));}
 if(e.key==='Enter'&&loggedIn&&!chatOpen){chatOpen=true;chatInput.classList.add('visible');chatInput.focus();controls.unlock();}
});
document.addEventListener('keyup',e=>keys[e.code]=false);

const raycaster=new THREE.Raycaster();raycaster.far=7;
function targetBlock(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);for(const h of raycaster.intersectObjects(worldGroup.children,false)){if(!h.object.userData.isWater)return h;}return null;}
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousedown',e=>{
 if(!controls.isLocked||chatOpen)return;const h=targetBlock();if(!h)return;const p=h.object.position;
 if(e.button===0){worldEdits.set(key(p.x,p.y,p.z),'removed');removeBlock(p.x,p.y,p.z);socket.emit('block-edit',{action:'remove',x:p.x,y:p.y,z:p.z});}
 if(e.button===2){const n=h.face.normal,x=Math.round(p.x+n.x),y=Math.round(p.y+n.y),z=Math.round(p.z+n.z);worldEdits.set(key(x,y,z),{type:selectedType});addBlock(x,y,z,selectedType);socket.emit('block-edit',{action:'place',x,y,z,type:selectedType});}
});
socket.on('block-edited',e=>{if(e.action==='remove'){worldEdits.set(key(e.x,e.y,e.z),'removed');removeBlock(e.x,e.y,e.z);}else{worldEdits.set(key(e.x,e.y,e.z),{type:e.type});addBlock(e.x,e.y,e.z,e.type);}});

chatInput.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const t=chatInput.value.trim();if(t)socket.emit('chat-message',t);chatInput.value='';chatInput.classList.remove('visible');chatOpen=false;controls.lock();});
socket.on('chat-message',d=>{const el=document.createElement('div');el.textContent=`${d.name}: ${d.message}`;messages.appendChild(el);while(messages.children.length>8)messages.removeChild(messages.firstChild);});

const velocity=new THREE.Vector3(),direction=new THREE.Vector3();let canJump=false;
function exists(x,y,z){return blocks.has(key(Math.round(x),Math.round(y),Math.round(z)));}
function collides(x,y,z){const r=.31,h=1.75,min=y-h+.1,max=y-.05;for(const xx of [x-r,x+r])for(const zz of [z-r,z+r])for(let yy=Math.floor(min);yy<=Math.floor(max);yy++)if(exists(xx,yy,zz))return true;return false;}

const clk=new THREE.Clock();let moveSend=0,day=.18;
function updateSky(dt){
 day=(day+dt*.004)%1;const a=day*Math.PI*2,s=Math.sin(a),light=Math.max(.1,Math.min(1,(s+.25)*1.2));
 sun.position.set(Math.cos(a)*75,s*90,Math.sin(a*.6)*40);sunBall.position.copy(sun.position.clone().normalize().multiplyScalar(110));
 sun.intensity=.2+light*1.6;hemi.intensity=.2+light*1.2;
 const c=new THREE.Color(0x0d1630).lerp(new THREE.Color(0x82c6f4),light);scene.background.copy(c);scene.fog.color.copy(c);
 dayState.textContent=light>.55?'Día':light>.25?'Atardecer':'Noche';
 clouds.forEach((cl,i)=>{cl.position.x+=dt*(.8+i*.02);if(cl.position.x>70)cl.position.x=-70;});
}
function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clk.getDelta(),.05);updateSky(dt);
 if(loggedIn&&controls.isLocked&&!chatOpen){
  direction.set(0,0,0);if(keys.KeyW)direction.z-=1;if(keys.KeyS)direction.z+=1;if(keys.KeyA)direction.x-=1;if(keys.KeyD)direction.x+=1;direction.normalize();
  const speed=(keys.ShiftLeft||keys.ShiftRight)?9.5:5.8,old=camera.position.clone();
  if(direction.z){controls.moveForward(-direction.z*speed*dt);if(collides(camera.position.x,camera.position.y,camera.position.z))camera.position.copy(old);else old.copy(camera.position);}
  if(direction.x){controls.moveRight(direction.x*speed*dt);if(collides(camera.position.x,camera.position.y,camera.position.z))camera.position.copy(old);}
  velocity.y-=24*dt;canJump=exists(camera.position.x,Math.floor(camera.position.y-1.83),camera.position.z);
  if(keys.Space&&canJump){velocity.y=9;canJump=false;}
  const oy=camera.position.y;camera.position.y+=velocity.y*dt;if(collides(camera.position.x,camera.position.y,camera.position.z)){camera.position.y=oy;velocity.y=0;}
  if(camera.position.y<-20){camera.position.set(0,20,0);velocity.set(0,0,0);}
  moveSend+=dt;if(moveSend>=.05){const d=new THREE.Vector3();camera.getWorldDirection(d);socket.emit('player-move',{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw:Math.atan2(d.x,d.z)});moveSend=0;}
  const x=Math.round(camera.position.x),y=Math.round(camera.position.y),z=Math.round(camera.position.z);coords.textContent=`X ${x} Y ${y} Z ${z}`;biomeEl.textContent=`Bioma: ${biomeAt(x,z)}`;
 }
 renderer.render(scene,camera);
}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

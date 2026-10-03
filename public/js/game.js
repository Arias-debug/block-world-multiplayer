
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const socket = io();

let myId=null;
let loggedIn=false;
let chatOpen=false;

const $ = id => document.getElementById(id);

const loginScreen=$('loginScreen');
const pauseMenu=$('pauseMenu');
const nameInput=$('nameInput');
const passwordInput=$('passwordInput');
const loginBtn=$('loginBtn');
const loginMsg=$('loginMsg');
const resumeBtn=$('resumeBtn');
const hud=$('hud');
const coordsEl=$('coords');
const biomeEl=$('biome');
const timeState=$('timeState');
const onlineEl=$('online');
const playersList=$('playersList');
const selectedBlock=$('selectedBlock');
const chatInput=$('chatInput');
const messages=$('messages');

loginBtn.onclick=()=>{
  loginMsg.textContent='Conectando...';
  socket.emit('login',{
    name:nameInput.value,
    password:passwordInput.value
  });
};
passwordInput.addEventListener('keydown',e=>{
  if(e.key==='Enter') loginBtn.click();
});

// =============================================
// THREE SETUP
// =============================================
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x83c8f4);
scene.fog=new THREE.FogExp2(0x83c8f4,0.008);

const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,500);
camera.position.set(0,24,0);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const controls=new PointerLockControls(camera,document.body);

controls.addEventListener('lock',()=>pauseMenu.classList.add('hidden'));
controls.addEventListener('unlock',()=>{
  if(loggedIn&&!chatOpen) pauseMenu.classList.remove('hidden');
});
resumeBtn.onclick=()=>controls.lock();

// =============================================
// TEXTURES
// =============================================
function canvasTexture(base,pixels=[],grid=false){
  const c=document.createElement('canvas');
  c.width=c.height=64;
  const x=c.getContext('2d');

  x.fillStyle=base;
  x.fillRect(0,0,64,64);

  for(let i=0;i<420;i++){
    x.fillStyle=pixels[Math.floor(Math.random()*pixels.length)]||base;
    const px=(Math.random()*64)|0;
    const py=(Math.random()*64)|0;
    const s=Math.random()>.78?3:2;
    x.fillRect(px,py,s,s);
  }

  if(grid){
    x.strokeStyle='rgba(0,0,0,.18)';
    x.lineWidth=2;
    for(let y=0;y<64;y+=16){
      x.beginPath();x.moveTo(0,y);x.lineTo(64,y);x.stroke();
    }
    for(let y=0;y<64;y+=32){
      for(let xx=0;xx<64;xx+=32){
        x.beginPath();x.moveTo(xx,y);x.lineTo(xx,y+16);x.stroke();
      }
    }
  }

  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter;
  t.minFilter=THREE.NearestFilter;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

const tGrassTop=canvasTexture('#5ca63b',['#4a8e30','#6bb94b','#3f7928','#79c454']);
const tGrassSide=canvasTexture('#7e4f2d',['#6c4026','#916039','#734629']);
const tDirt=canvasTexture('#80502f',['#694025','#98633a','#754629']);
const tStone=canvasTexture('#888888',['#717171','#9b9b9b','#797979','#ababab']);
const tSand=canvasTexture('#d8c47e',['#c9b56d','#e5d493','#bda968']);
const tWood=canvasTexture('#8f5b32',['#744725','#aa7241','#6c4324']);
const tLeaves=canvasTexture('#3d8b40',['#2f7031','#4da44c','#347c36']);
const tSnow=canvasTexture('#f0f6fb',['#d8e5ed','#ffffff','#c9d7e0']);
const tBrick=canvasTexture('#a64d39',['#8d3f31','#bb5c45','#74362c'],true);

function mat(tex,extra={}){
  return new THREE.MeshLambertMaterial({map:tex,...extra});
}

const M={
  dirt:mat(tDirt),
  stone:mat(tStone),
  sand:mat(tSand),
  wood:mat(tWood),
  leaves:mat(tLeaves,{transparent:true,opacity:.95}),
  snow:mat(tSnow),
  brick:mat(tBrick)
};

const grassMats=[
  mat(tGrassSide),mat(tGrassSide),
  mat(tGrassTop),mat(tDirt),
  mat(tGrassSide),mat(tGrassSide)
];

const blockGeo=new THREE.BoxGeometry(1,1,1);

// =============================================
// LIGHT / SKY
// =============================================
const hemi=new THREE.HemisphereLight(0xdff4ff,0x3f4f36,1.4);
scene.add(hemi);

const sun=new THREE.DirectionalLight(0xfff1cf,2.0);
sun.position.set(60,90,35);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-65;
sun.shadow.camera.right=65;
sun.shadow.camera.top=65;
sun.shadow.camera.bottom=-65;
sun.shadow.camera.near=1;
sun.shadow.camera.far=180;
scene.add(sun);

const sunDisk=new THREE.Mesh(
  new THREE.SphereGeometry(4,18,18),
  new THREE.MeshBasicMaterial({color:0xfff1a0})
);
scene.add(sunDisk);

const moonDisk=new THREE.Mesh(
  new THREE.SphereGeometry(3,18,18),
  new THREE.MeshBasicMaterial({color:0xdbe7ff})
);
scene.add(moonDisk);

// clouds
const cloudMaterial=new THREE.MeshLambertMaterial({
  color:0xffffff,transparent:true,opacity:.80
});
const clouds=[];
for(let i=0;i<18;i++){
  const g=new THREE.Group();
  const parts=4+Math.floor(Math.random()*4);

  for(let j=0;j<parts;j++){
    const m=new THREE.Mesh(
      new THREE.BoxGeometry(4+Math.random()*3,1.1+Math.random()*.7,2.6+Math.random()*2),
      cloudMaterial
    );
    m.position.set(j*2.6,(Math.random()-.5)*.5,(Math.random()-.5)*2);
    g.add(m);
  }

  g.position.set(
    (Math.random()-.5)*180,
    36+Math.random()*12,
    (Math.random()-.5)*180
  );

  scene.add(g);
  clouds.push(g);
}

// =============================================
// WORLD
// =============================================
const blocks=new Map();
const waterMeshes=[];
const worldEdits=new Map();
const worldGroup=new THREE.Group();
scene.add(worldGroup);

const key=(x,y,z)=>`${x},${y},${z}`;

function biomeAt(x,z){
  const climate=Math.sin(x*.014)+Math.cos(z*.012);
  const wet=Math.sin((x-z)*.018)+Math.cos((x+z)*.008);

  if(climate>1.05) return'Desierto';
  if(climate<-1.05) return'Nevado';
  if(wet>.9) return'Bosque';
  return'Llanura';
}

function terrainHeight(x,z){
  const broad=Math.sin(x*.021)*4 + Math.cos(z*.018)*4;
  const hills=Math.sin(x*.075)*2.5 + Math.cos(z*.063)*2.5;
  const ridge=Math.max(0,Math.sin(x*.011)+Math.cos(z*.013)-.85);
  const mountain=Math.pow(ridge,2.2)*18;
  return Math.floor(8+broad+hills+mountain);
}

function topType(x,z,h){
  const b=biomeAt(x,z);

  if(b==='Desierto') return'sand';
  if(b==='Nevado'&&h>9) return'snow';
  if(h<=5) return'sand';
  return'grass';
}

function blockMaterial(type){
  if(type==='grass') return grassMats;
  return M[type]||M.dirt;
}

function addBlock(x,y,z,type){
  const k=key(x,y,z);
  if(blocks.has(k)) return;

  const mesh=new THREE.Mesh(blockGeo,blockMaterial(type));
  mesh.position.set(x,y,z);
  mesh.userData.blockType=type;
  mesh.castShadow=true;
  mesh.receiveShadow=true;

  worldGroup.add(mesh);
  blocks.set(k,mesh);
}

function removeBlock(x,y,z){
  const k=key(x,y,z);
  const m=blocks.get(k);
  if(!m) return;
  worldGroup.remove(m);
  blocks.delete(k);
}

function seededChance(x,z,salt=1){
  const v=Math.sin(x*12.9898+z*78.233+salt*37.719)*43758.5453;
  return v-Math.floor(v);
}

function growTree(x,y,z,snow=false){
  const trunk=4+(seededChance(x,z,2)>.5?1:0);

  for(let i=0;i<trunk;i++) addBlock(x,y+i,z,'wood');

  for(let dx=-2;dx<=2;dx++){
    for(let dz=-2;dz<=2;dz++){
      for(let dy=trunk-2;dy<=trunk+1;dy++){
        const d=Math.abs(dx)+Math.abs(dz)+Math.abs(dy-trunk)*.55;
        if(d<3.6) addBlock(x+dx,y+dy,z+dz,'leaves');
      }
    }
  }

  if(snow){
    addBlock(x,y+trunk+2,z,'snow');
  }
}

function addWater(x,y,z){
  const geo=new THREE.BoxGeometry(1,.84,1);
  const matW=new THREE.MeshPhongMaterial({
    color:0x3d8dd0,
    transparent:true,
    opacity:.54,
    shininess:100,
    specular:0xaedcff
  });
  const w=new THREE.Mesh(geo,matW);
  w.position.set(x,y-.08,z);
  w.userData.isWater=true;
  worldGroup.add(w);
  waterMeshes.push(w);
}

function addFlower(x,y,z,color){
  const matF=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
  const g=new THREE.Group();
  const p1=new THREE.Mesh(new THREE.PlaneGeometry(.45,.7),matF);
  const p2=p1.clone();
  p1.rotation.y=Math.PI/4;
  p2.rotation.y=-Math.PI/4;
  g.add(p1,p2);
  g.position.set(x,y+.35,z);
  scene.add(g);
}

function generateWorld(){
  if(blocks.size) return;

  const size=110;

  for(let x=-size/2;x<size/2;x++){
    for(let z=-size/2;z<size/2;z++){
      const h=terrainHeight(x,z);
      const biome=biomeAt(x,z);

      for(let y=h-6;y<=h;y++){
        const k=key(x,y,z);
        const edit=worldEdits.get(k);

        if(edit==='removed') continue;

        if(edit?.type){
          addBlock(x,y,z,edit.type);
          continue;
        }

        let type='stone';

        if(y===h){
          type=topType(x,z,h);
        }else if(y>=h-2){
          type=topType(x,z,h)==='sand'?'sand':'dirt';
        }

        addBlock(x,y,z,type);
      }

      if(h<5){
        for(let y=h+1;y<=5;y++) addWater(x,y,z);
      }

      const r=seededChance(x,z,4);

      if(
        biome==='Bosque' &&
        h>5 &&
        r>.93 &&
        Math.abs(x)>4 &&
        Math.abs(z)>4
      ){
        growTree(x,h+1,z,false);
      }

      if(
        biome==='Llanura' &&
        h>5 &&
        r>.985 &&
        Math.abs(x)>4 &&
        Math.abs(z)>4
      ){
        growTree(x,h+1,z,false);
      }

      if(
        biome==='Nevado' &&
        h>8 &&
        r>.975 &&
        Math.abs(x)>4 &&
        Math.abs(z)>4
      ){
        growTree(x,h+1,z,true);
      }

      if(
        biome==='Llanura' &&
        h>5 &&
        r>.965 && r<.974
      ){
        addFlower(x,h+1,z,0xffe84d);
      }
    }
  }

  for(const [k,e] of worldEdits){
    if(!e||e==='removed'||!e.type) continue;
    const [x,y,z]=k.split(',').map(Number);
    if(!blocks.has(k)) addBlock(x,y,z,e.type);
  }
}

// =============================================
// LOGIN
// =============================================
socket.on('login-result',data=>{
  if(!data.ok){
    loginMsg.textContent=data.message;
    return;
  }

  myId=data.id;
  loggedIn=true;

  for(const [k,v] of Object.entries(data.worldEdits||{})){
    worldEdits.set(k,v);
  }

  generateWorld();

  const spawnH=terrainHeight(0,0);
  camera.position.set(0,spawnH+6,0);

  loginScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  for(const p of data.players||[]){
    if(p.id!==myId) addRemotePlayer(p);
  }

  updatePlayers(data.players||[]);
  controls.lock();
});

// =============================================
// REMOTE PLAYERS
// =============================================
const remotePlayers=new Map();

function makeTag(text){
  const c=document.createElement('canvas');
  c.width=300;c.height=72;
  const x=c.getContext('2d');

  x.fillStyle='rgba(0,0,0,.6)';
  x.fillRect(0,0,300,72);
  x.strokeStyle='rgba(255,255,255,.25)';
  x.strokeRect(1,1,298,70);

  x.fillStyle='#fff';
  x.font='bold 30px Arial';
  x.textAlign='center';
  x.textBaseline='middle';
  x.fillText(text,150,36);

  const tex=new THREE.CanvasTexture(c);
  const sprite=new THREE.Sprite(
    new THREE.SpriteMaterial({map:tex,transparent:true})
  );
  sprite.scale.set(4.2,1,1);
  sprite.position.y=2.65;
  return sprite;
}

function addRemotePlayer(p){
  if(remotePlayers.has(p.id)) return;

  const g=new THREE.Group();

  const skin=new THREE.MeshLambertMaterial({color:0xe0ad84});
  const shirt=new THREE.MeshLambertMaterial({color:0x3383d8});
  const pants=new THREE.MeshLambertMaterial({color:0x27365e});
  const shoe=new THREE.MeshLambertMaterial({color:0x252525});

  const head=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),skin);
  head.position.y=1.75;

  const body=new THREE.Mesh(new THREE.BoxGeometry(.78,1.05,.42),shirt);
  body.position.y=.85;

  const armL=new THREE.Mesh(new THREE.BoxGeometry(.24,.95,.24),shirt);
  armL.position.set(-.54,.86,0);
  const armR=armL.clone();armR.position.x=.54;

  const legL=new THREE.Mesh(new THREE.BoxGeometry(.27,.9,.3),pants);
  legL.position.set(-.2,-.12,0);
  const legR=legL.clone();legR.position.x=.2;

  const footL=new THREE.Mesh(new THREE.BoxGeometry(.29,.2,.4),shoe);
  footL.position.set(-.2,-.66,-.05);
  const footR=footL.clone();footR.position.x=.2;

  g.add(head,body,armL,armR,legL,legR,footL,footR,makeTag(p.name));
  g.position.set(p.x,p.y-1.75,p.z);

  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});

  scene.add(g);
  remotePlayers.set(p.id,g);
}

socket.on('player-joined',addRemotePlayer);

socket.on('player-moved',p=>{
  let r=remotePlayers.get(p.id);

  if(!r){
    addRemotePlayer(p);
    r=remotePlayers.get(p.id);
  }

  r.position.lerp(new THREE.Vector3(p.x,p.y-1.75,p.z),.35);
  r.rotation.y=p.yaw||0;
});

socket.on('player-left',id=>{
  const p=remotePlayers.get(id);
  if(p){
    scene.remove(p);
    remotePlayers.delete(id);
  }
});

// =============================================
// PLAYER LIST
// =============================================
function updatePlayers(ps){
  playersList.innerHTML='';
  onlineEl.textContent=`${ps.length} jugador${ps.length===1?'':'es'}`;

  for(const p of ps){
    const d=document.createElement('div');
    d.textContent=p.id===myId?`${p.name} (Tú)`:p.name;
    playersList.appendChild(d);
  }
}
socket.on('players-list',updatePlayers);

// =============================================
// INVENTORY
// =============================================
const choices=[
  ['grass','Césped'],
  ['dirt','Tierra'],
  ['stone','Piedra'],
  ['sand','Arena'],
  ['wood','Madera'],
  ['leaves','Hojas'],
  ['snow','Nieve'],
  ['brick','Ladrillo']
];

let selectedType='grass';
const keys={};

document.addEventListener('keydown',e=>{
  if(!chatOpen) keys[e.code]=true;

  const n=Number(e.key);

  if(n>=1&&n<=8){
    selectedType=choices[n-1][0];
    selectedBlock.textContent=choices[n-1][1];

    document.querySelectorAll('.slot').forEach((el,i)=>{
      el.classList.toggle('selected',i===n-1);
    });
  }

  if(e.key==='Enter'&&loggedIn&&!chatOpen){
    chatOpen=true;
    chatInput.classList.add('visible');
    chatInput.focus();
    controls.unlock();
  }
});
document.addEventListener('keyup',e=>keys[e.code]=false);

// =============================================
// BLOCK SELECTION OUTLINE
// =============================================
const outline=new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03,1.03,1.03)),
  new THREE.LineBasicMaterial({color:0xffffff})
);
outline.visible=false;
scene.add(outline);

const raycaster=new THREE.Raycaster();
raycaster.far=7;

function targetBlock(){
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);

  const hits=raycaster.intersectObjects(worldGroup.children,false);

  for(const h of hits){
    if(!h.object.userData.isWater) return h;
  }

  return null;
}

document.addEventListener('contextmenu',e=>e.preventDefault());

document.addEventListener('mousedown',e=>{
  if(!controls.isLocked||chatOpen) return;

  const h=targetBlock();
  if(!h) return;

  const p=h.object.position;

  if(e.button===0){
    worldEdits.set(key(p.x,p.y,p.z),'removed');
    removeBlock(p.x,p.y,p.z);

    socket.emit('block-edit',{
      action:'remove',
      x:p.x,y:p.y,z:p.z
    });
  }

  if(e.button===2){
    const n=h.face.normal;
    const x=Math.round(p.x+n.x);
    const y=Math.round(p.y+n.y);
    const z=Math.round(p.z+n.z);

    if(
      Math.abs(camera.position.x-x)<.8 &&
      Math.abs(camera.position.z-z)<.8 &&
      Math.abs((camera.position.y-1)-y)<1.8
    ) return;

    worldEdits.set(key(x,y,z),{type:selectedType});
    addBlock(x,y,z,selectedType);

    socket.emit('block-edit',{
      action:'place',
      x,y,z,
      type:selectedType
    });
  }
});

socket.on('block-edited',e=>{
  if(e.action==='remove'){
    worldEdits.set(key(e.x,e.y,e.z),'removed');
    removeBlock(e.x,e.y,e.z);
  }else{
    worldEdits.set(key(e.x,e.y,e.z),{type:e.type});
    addBlock(e.x,e.y,e.z,e.type);
  }
});

// =============================================
// CHAT
// =============================================
chatInput.addEventListener('keydown',e=>{
  if(e.key!=='Enter') return;

  const t=chatInput.value.trim();

  if(t) socket.emit('chat-message',t);

  chatInput.value='';
  chatInput.classList.remove('visible');
  chatOpen=false;
  controls.lock();
});

socket.on('chat-message',d=>{
  const line=document.createElement('div');
  line.textContent=`${d.name}: ${d.message}`;
  messages.appendChild(line);

  while(messages.children.length>9){
    messages.removeChild(messages.firstChild);
  }
});

// =============================================
// MOVEMENT
// =============================================
const velocity=new THREE.Vector3();
const direction=new THREE.Vector3();
let canJump=false;

function exists(x,y,z){
  return blocks.has(key(Math.round(x),Math.round(y),Math.round(z)));
}

function collides(x,y,z){
  const r=.31;
  const h=1.75;
  const min=y-h+.1;
  const max=y-.05;

  for(const xx of [x-r,x+r]){
    for(const zz of [z-r,z+r]){
      for(let yy=Math.floor(min);yy<=Math.floor(max);yy++){
        if(exists(xx,yy,zz)) return true;
      }
    }
  }
  return false;
}

// =============================================
// FIRST PERSON HAND
// =============================================
const handMat=new THREE.MeshLambertMaterial({color:0xe0ad84});
const hand=new THREE.Mesh(
  new THREE.BoxGeometry(.28,.7,.28),
  handMat
);
hand.position.set(.55,-.48,-1.05);
hand.rotation.z=-.18;
camera.add(hand);
scene.add(camera);

// =============================================
// LOOP
// =============================================
const clock=new THREE.Clock();
let sendTimer=0;
let day=.2;
let walkPhase=0;

function updateSky(dt){
  day=(day+dt*.0035)%1;
  const a=day*Math.PI*2;
  const s=Math.sin(a);
  const light=Math.max(.08,Math.min(1,(s+.3)*1.15));

  sun.position.set(Math.cos(a)*100,s*110,Math.sin(a*.6)*55);
  moonDisk.position.copy(sun.position.clone().multiplyScalar(-1).normalize().multiplyScalar(130));
  sunDisk.position.copy(sun.position.clone().normalize().multiplyScalar(130));

  sun.intensity=.15+light*2.0;
  hemi.intensity=.18+light*1.35;

  const night=new THREE.Color(0x091126);
  const sunset=new THREE.Color(0xe58e62);
  const daytime=new THREE.Color(0x83c8f4);

  let sky;

  if(light>.45){
    sky=daytime.clone();
  }else if(light>.2){
    sky=night.clone().lerp(sunset,(light-.2)/.25);
  }else{
    sky=night.clone();
  }

  scene.background.copy(sky);
  scene.fog.color.copy(sky);

  if(light>.55) timeState.textContent='Día';
  else if(light>.22) timeState.textContent='Atardecer';
  else timeState.textContent='Noche';

  clouds.forEach((c,i)=>{
    c.position.x+=dt*(.55+i*.015);
    if(c.position.x>95) c.position.x=-95;
  });

  waterMeshes.forEach((w,i)=>{
    w.material.opacity=.50+Math.sin(performance.now()*.001+i*.05)*.04;
  });
}

function animate(){
  requestAnimationFrame(animate);

  const dt=Math.min(clock.getDelta(),.05);

  updateSky(dt);

  const hit=targetBlock();

  if(hit){
    outline.visible=true;
    outline.position.copy(hit.object.position);
  }else{
    outline.visible=false;
  }

  if(loggedIn&&controls.isLocked&&!chatOpen){
    direction.set(0,0,0);

    if(keys.KeyW) direction.z-=1;
    if(keys.KeyS) direction.z+=1;
    if(keys.KeyA) direction.x-=1;
    if(keys.KeyD) direction.x+=1;

    direction.normalize();

    const moving=direction.lengthSq()>0;
    const speed=(keys.ShiftLeft||keys.ShiftRight)?10.2:6.2;

    const old=camera.position.clone();

    if(direction.z){
      controls.moveForward(-direction.z*speed*dt);

      if(collides(camera.position.x,camera.position.y,camera.position.z)){
        camera.position.copy(old);
      }else{
        old.copy(camera.position);
      }
    }

    if(direction.x){
      controls.moveRight(direction.x*speed*dt);

      if(collides(camera.position.x,camera.position.y,camera.position.z)){
        camera.position.copy(old);
      }
    }

    velocity.y-=25*dt;

    canJump=exists(
      camera.position.x,
      Math.floor(camera.position.y-1.84),
      camera.position.z
    );

    if(keys.Space&&canJump){
      velocity.y=9.3;
      canJump=false;
    }

    const oy=camera.position.y;
    camera.position.y+=velocity.y*dt;

    if(collides(camera.position.x,camera.position.y,camera.position.z)){
      camera.position.y=oy;
      velocity.y=0;
    }

    if(camera.position.y<-30){
      const h=terrainHeight(
        Math.round(camera.position.x),
        Math.round(camera.position.z)
      );

      camera.position.y=h+8;
      velocity.set(0,0,0);
    }

    if(moving){
      walkPhase+=dt*10;
      hand.position.y=-.48+Math.sin(walkPhase)*.025;
      hand.rotation.z=-.18+Math.sin(walkPhase*.5)*.03;
    }

    sendTimer+=dt;

    if(sendTimer>=.05){
      const d=new THREE.Vector3();
      camera.getWorldDirection(d);

      socket.emit('player-move',{
        x:camera.position.x,
        y:camera.position.y,
        z:camera.position.z,
        yaw:Math.atan2(d.x,d.z)
      });

      sendTimer=0;
    }

    const x=Math.round(camera.position.x);
    const y=Math.round(camera.position.y);
    const z=Math.round(camera.position.z);

    coordsEl.textContent=`X ${x} · Y ${y} · Z ${z}`;
    biomeEl.textContent=biomeAt(x,z);
  }

  renderer.render(scene,camera);
}

animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

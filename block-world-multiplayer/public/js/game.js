import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const socket = io();

let myId = null;
let loggedIn = false;

// ---------------------------
// LOGIN
// ---------------------------
const loginScreen = document.getElementById('loginScreen');
const nameInput = document.getElementById('nameInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginMsg = document.getElementById('loginMsg');
const hud = document.getElementById('hud');
const menu = document.getElementById('menu');
const playBtn = document.getElementById('playBtn');

loginBtn.addEventListener('click', () => {
  loginMsg.textContent = 'Ingresando...';
  socket.emit('login', {
    name: nameInput.value,
    password: passwordInput.value
  });
});

passwordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') loginBtn.click();
});

socket.on('login-result', data => {
  if (!data.ok) {
    loginMsg.textContent = data.message;
    return;
  }

  myId = data.id;
  loggedIn = true;
  loginScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  for (const [k, v] of Object.entries(data.worldEdits || {})) {
    worldEdits.set(k, v);
  }

  generateWorld();

  for (const p of data.players || []) {
    if (p.id !== myId) addRemotePlayer(p);
  }

  updatePlayersList(data.players || []);
  controls.lock();
});

// ---------------------------
// THREE
// ---------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 120);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 14, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

controls.addEventListener('unlock', () => {
  if (loggedIn && !chatOpen) menu.classList.remove('hidden');
});

controls.addEventListener('lock', () => menu.classList.add('hidden'));
playBtn.addEventListener('click', () => controls.lock());

scene.add(new THREE.HemisphereLight(0xffffff, 0x557755, 1.6));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(40, 60, 30);
scene.add(sun);

// ---------------------------
// WORLD
// ---------------------------
const blockGeo = new THREE.BoxGeometry(1, 1, 1);

const materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x59a73d }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x85532d }),
  stone: new THREE.MeshLambertMaterial({ color: 0x888888 }),
  sand: new THREE.MeshLambertMaterial({ color: 0xd8c27d }),
  wood: new THREE.MeshLambertMaterial({ color: 0x99673b })
};

const blocks = new Map();
const worldEdits = new Map();
const worldGroup = new THREE.Group();
scene.add(worldGroup);

const key = (x, y, z) => `${x},${y},${z}`;

function terrainHeight(x, z) {
  return Math.floor(
    5 +
    Math.sin(x * 0.12) * 2 +
    Math.cos(z * 0.1) * 2 +
    Math.sin((x + z) * 0.05) * 2
  );
}

function defaultType(x, y, z) {
  const h = terrainHeight(x, z);
  if (y > h || y < h - 4) return null;
  if (y === h) return h <= 4 ? 'sand' : 'grass';
  if (y >= h - 2) return 'dirt';
  return 'stone';
}

function addBlock(x, y, z, type) {
  const k = key(x, y, z);
  if (blocks.has(k)) return;

  const mesh = new THREE.Mesh(blockGeo, materials[type] || materials.grass);
  mesh.position.set(x, y, z);
  mesh.userData.blockType = type;
  worldGroup.add(mesh);
  blocks.set(k, mesh);
}

function removeBlock(x, y, z) {
  const k = key(x, y, z);
  const mesh = blocks.get(k);
  if (!mesh) return;
  worldGroup.remove(mesh);
  blocks.delete(k);
}

function generateWorld() {
  if (blocks.size) return;

  const size = 70;

  for (let x = -size / 2; x < size / 2; x++) {
    for (let z = -size / 2; z < size / 2; z++) {
      const h = terrainHeight(x, z);

      for (let y = h - 4; y <= h; y++) {
        const k = key(x, y, z);
        const edit = worldEdits.get(k);

        if (edit === 'removed') continue;

        if (edit?.type) {
          addBlock(x, y, z, edit.type);
        } else {
          const type = defaultType(x, y, z);
          if (type) addBlock(x, y, z, type);
        }
      }
    }
  }

  for (const [k, edit] of worldEdits) {
    if (!edit || edit === 'removed' || !edit.type) continue;

    const [x, y, z] = k.split(',').map(Number);
    if (!blocks.has(k)) addBlock(x, y, z, edit.type);
  }
}

// ---------------------------
// REMOTE PLAYERS
// ---------------------------
const remotePlayers = new Map();

function addRemotePlayer(p) {
  if (remotePlayers.has(p.id)) return;

  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x3977d6 })
  );
  body.position.y = 0.6;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 0.65),
    new THREE.MeshLambertMaterial({ color: 0xe0b18c })
  );
  head.position.y = 1.45;

  group.add(body, head);
  group.position.set(p.x, p.y - 1.75, p.z);

  scene.add(group);
  remotePlayers.set(p.id, group);
}

socket.on('player-joined', p => addRemotePlayer(p));

socket.on('player-moved', p => {
  let rp = remotePlayers.get(p.id);

  if (!rp) {
    addRemotePlayer(p);
    rp = remotePlayers.get(p.id);
  }

  rp.position.lerp(
    new THREE.Vector3(p.x, p.y - 1.75, p.z),
    0.45
  );

  rp.rotation.y = p.yaw || 0;
});

socket.on('player-left', id => {
  const rp = remotePlayers.get(id);
  if (rp) {
    scene.remove(rp);
    remotePlayers.delete(id);
  }
});

// ---------------------------
// PLAYERS LIST
// ---------------------------
const playersList = document.getElementById('playersList');
const online = document.getElementById('online');

function updatePlayersList(players) {
  playersList.innerHTML = '';
  online.textContent = `Jugadores: ${players.length}`;

  for (const p of players) {
    const div = document.createElement('div');
    div.textContent = p.id === myId ? `${p.name} (Tú)` : p.name;
    playersList.appendChild(div);
  }
}

socket.on('players-list', updatePlayersList);

// ---------------------------
// BLOCK INTERACTION
// ---------------------------
let selectedType = 'grass';

document.addEventListener('keydown', e => {
  const n = Number(e.key);

  if (n >= 1 && n <= 5) {
    selectedType = ['grass', 'dirt', 'stone', 'sand', 'wood'][n - 1];

    document.querySelectorAll('.slot').forEach((el, i) => {
      el.classList.toggle('selected', i === n - 1);
    });
  }
});

const raycaster = new THREE.Raycaster();
raycaster.far = 7;

function targetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(worldGroup.children, false);
  return hits.length ? hits[0] : null;
}

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousedown', e => {
  if (!controls.isLocked || chatOpen) return;

  const hit = targetBlock();
  if (!hit) return;

  const p = hit.object.position;

  if (e.button === 0) {
    worldEdits.set(key(p.x, p.y, p.z), 'removed');
    removeBlock(p.x, p.y, p.z);

    socket.emit('block-edit', {
      action: 'remove',
      x: p.x,
      y: p.y,
      z: p.z
    });
  }

  if (e.button === 2) {
    const n = hit.face.normal;
    const x = Math.round(p.x + n.x);
    const y = Math.round(p.y + n.y);
    const z = Math.round(p.z + n.z);

    worldEdits.set(key(x, y, z), { type: selectedType });
    addBlock(x, y, z, selectedType);

    socket.emit('block-edit', {
      action: 'place',
      x, y, z,
      type: selectedType
    });
  }
});

socket.on('block-edited', edit => {
  if (edit.action === 'remove') {
    worldEdits.set(key(edit.x, edit.y, edit.z), 'removed');
    removeBlock(edit.x, edit.y, edit.z);
  } else {
    worldEdits.set(key(edit.x, edit.y, edit.z), { type: edit.type });
    addBlock(edit.x, edit.y, edit.z, edit.type);
  }
});

// ---------------------------
// MOVEMENT
// ---------------------------
const keys = {};
let chatOpen = false;

document.addEventListener('keydown', e => {
  if (!chatOpen) keys[e.code] = true;

  if (e.key === 'Enter' && loggedIn) {
    if (!chatOpen) {
      chatOpen = true;
      chatInput.classList.add('visible');
      chatInput.focus();
      controls.unlock();
    }
  }
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;

function blockExists(x, y, z) {
  return blocks.has(key(Math.round(x), Math.round(y), Math.round(z)));
}

function collidesAt(x, y, z) {
  const radius = 0.31;
  const height = 1.75;

  const minY = y - height + 0.1;
  const maxY = y - 0.05;

  for (const xx of [x - radius, x + radius]) {
    for (const zz of [z - radius, z + radius]) {
      for (let yy = Math.floor(minY); yy <= Math.floor(maxY); yy++) {
        if (blockExists(xx, yy, zz)) return true;
      }
    }
  }

  return false;
}

// ---------------------------
// CHAT
// ---------------------------
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');

chatInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;

  const text = chatInput.value.trim();

  if (text) socket.emit('chat-message', text);

  chatInput.value = '';
  chatInput.classList.remove('visible');
  chatOpen = false;
  controls.lock();
});

socket.on('chat-message', data => {
  const div = document.createElement('div');
  div.textContent = `${data.name}: ${data.message}`;
  messages.appendChild(div);

  while (messages.children.length > 8) {
    messages.removeChild(messages.firstChild);
  }
});

// ---------------------------
// LOOP
// ---------------------------
const coords = document.getElementById('coords');
const clock = new THREE.Clock();

let sendTimer = 0;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (loggedIn && controls.isLocked && !chatOpen) {
    direction.set(0, 0, 0);

    if (keys['KeyW']) direction.z -= 1;
    if (keys['KeyS']) direction.z += 1;
    if (keys['KeyA']) direction.x -= 1;
    if (keys['KeyD']) direction.x += 1;

    direction.normalize();

    const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 9 : 5.5;
    const old = camera.position.clone();

    if (direction.z) {
      controls.moveForward(-direction.z * speed * dt);

      if (collidesAt(camera.position.x, camera.position.y, camera.position.z)) {
        camera.position.copy(old);
      } else {
        old.copy(camera.position);
      }
    }

    if (direction.x) {
      controls.moveRight(direction.x * speed * dt);

      if (collidesAt(camera.position.x, camera.position.y, camera.position.z)) {
        camera.position.copy(old);
      }
    }

    velocity.y -= 24 * dt;

    const groundY = Math.floor(camera.position.y - 1.83);
    canJump = blockExists(camera.position.x, groundY, camera.position.z);

    if (keys['Space'] && canJump) {
      velocity.y = 9;
      canJump = false;
    }

    const oldY = camera.position.y;
    camera.position.y += velocity.y * dt;

    if (collidesAt(camera.position.x, camera.position.y, camera.position.z)) {
      camera.position.y = oldY;
      velocity.y = 0;
    }

    if (camera.position.y < -20) {
      camera.position.set(0, 14, 0);
      velocity.set(0, 0, 0);
    }

    sendTimer += dt;

    if (sendTimer >= 0.05) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const yaw = Math.atan2(dir.x, dir.z);

      socket.emit('player-move', {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        yaw
      });

      sendTimer = 0;
    }

    coords.textContent =
      `X ${Math.round(camera.position.x)} Y ${Math.round(camera.position.y)} Z ${Math.round(camera.position.z)}`;
  }

  renderer.render(scene, camera);
}

animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

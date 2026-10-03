import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// CONTRASEÑA DE PRUEBA.
// Cámbiala por la que quieras antes de publicar.
const GAME_PASSWORD = process.env.GAME_PASSWORD || 'apolo123';

app.use(express.static('public'));

const players = new Map();
const worldEdits = new Map();

function publicPlayers() {
  return [...players.entries()].map(([id, p]) => ({
    id,
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw
  }));
}

io.on('connection', (socket) => {
  let authenticated = false;

  socket.on('login', ({ name, password }) => {
    const cleanName = String(name || '').trim().slice(0, 20);

    if (!cleanName) {
      socket.emit('login-result', { ok: false, message: 'Ingresa un nombre.' });
      return;
    }

    if (password !== GAME_PASSWORD) {
      socket.emit('login-result', { ok: false, message: 'Contraseña incorrecta.' });
      return;
    }

    authenticated = true;

    players.set(socket.id, {
      name: cleanName,
      x: 0,
      y: 14,
      z: 0,
      yaw: 0
    });

    socket.emit('login-result', {
      ok: true,
      id: socket.id,
      worldEdits: Object.fromEntries(worldEdits),
      players: publicPlayers()
    });

    socket.broadcast.emit('player-joined', {
      id: socket.id,
      ...players.get(socket.id)
    });

    io.emit('players-list', publicPlayers());
  });

  socket.on('player-move', (data) => {
    if (!authenticated) return;

    const p = players.get(socket.id);
    if (!p) return;

    p.x = Number(data.x) || 0;
    p.y = Number(data.y) || 0;
    p.z = Number(data.z) || 0;
    p.yaw = Number(data.yaw) || 0;

    socket.broadcast.emit('player-moved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw
    });
  });

  socket.on('block-edit', (edit) => {
    if (!authenticated) return;

    const x = Math.round(Number(edit.x));
    const y = Math.round(Number(edit.y));
    const z = Math.round(Number(edit.z));

    if (![x, y, z].every(Number.isFinite)) return;

    const key = `${x},${y},${z}`;

    if (edit.action === 'remove') {
      worldEdits.set(key, 'removed');
      io.emit('block-edited', { action: 'remove', x, y, z });
      return;
    }

    if (edit.action === 'place') {
      const allowed = ['grass', 'dirt', 'stone', 'sand', 'wood'];
      const type = allowed.includes(edit.type) ? edit.type : 'grass';

      worldEdits.set(key, { type });
      io.emit('block-edited', { action: 'place', x, y, z, type });
    }
  });

  socket.on('chat-message', (message) => {
    if (!authenticated) return;

    const p = players.get(socket.id);
    if (!p) return;

    const text = String(message || '').trim().slice(0, 120);
    if (!text) return;

    io.emit('chat-message', {
      name: p.name,
      message: text
    });
  });

  socket.on('disconnect', () => {
    if (!players.has(socket.id)) return;

    players.delete(socket.id);
    socket.broadcast.emit('player-left', socket.id);
    io.emit('players-list', publicPlayers());
  });
});

server.listen(PORT, () => {
  console.log(`Block World Multiplayer ejecutándose en http://localhost:${PORT}`);
  console.log(`Contraseña de prueba: ${GAME_PASSWORD}`);
});

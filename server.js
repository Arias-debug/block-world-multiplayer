
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const GAME_PASSWORD = process.env.GAME_PASSWORD || 'apolo123';

app.use(express.static('public'));

const players = new Map();
const worldEdits = new Map();

function listPlayers() {
  return [...players.entries()].map(([id,p])=>({id,...p}));
}

io.on('connection', socket => {
  let ok = false;

  socket.on('login', ({name,password}) => {
    name = String(name||'').trim().slice(0,20);
    if (!name) return socket.emit('login-result',{ok:false,message:'Ingresa tu nombre.'});
    if (String(password||'') !== GAME_PASSWORD)
      return socket.emit('login-result',{ok:false,message:'Contraseña incorrecta.'});

    ok = true;
    players.set(socket.id,{name,x:0,y:20,z:0,yaw:0});
    socket.emit('login-result',{
      ok:true,id:socket.id,
      players:listPlayers(),
      worldEdits:Object.fromEntries(worldEdits)
    });
    socket.broadcast.emit('player-joined',{id:socket.id,...players.get(socket.id)});
    io.emit('players-list',listPlayers());
  });

  socket.on('player-move', d => {
    if (!ok) return;
    const p = players.get(socket.id);
    if (!p) return;
    p.x=Number(d.x)||0; p.y=Number(d.y)||0; p.z=Number(d.z)||0; p.yaw=Number(d.yaw)||0;
    socket.broadcast.emit('player-moved',{id:socket.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw});
  });

  socket.on('block-edit', e => {
    if (!ok) return;
    const x=Math.round(Number(e.x)), y=Math.round(Number(e.y)), z=Math.round(Number(e.z));
    if (![x,y,z].every(Number.isFinite)) return;
    const k=`${x},${y},${z}`;

    if (e.action==='remove') {
      worldEdits.set(k,'removed');
      io.emit('block-edited',{action:'remove',x,y,z});
    } else if (e.action==='place') {
      const allowed=['grass','dirt','stone','sand','wood','leaves','snow'];
      const type=allowed.includes(e.type)?e.type:'grass';
      worldEdits.set(k,{type});
      io.emit('block-edited',{action:'place',x,y,z,type});
    }
  });

  socket.on('chat-message', msg => {
    if (!ok) return;
    const p=players.get(socket.id);
    const message=String(msg||'').trim().slice(0,140);
    if (p && message) io.emit('chat-message',{name:p.name,message});
  });

  socket.on('disconnect',()=>{
    if (!players.has(socket.id)) return;
    players.delete(socket.id);
    socket.broadcast.emit('player-left',socket.id);
    io.emit('players-list',listPlayers());
  });
});

server.listen(PORT,'0.0.0.0',()=>console.log(`Block World V2 en puerto ${PORT}`));

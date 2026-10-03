
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.GAME_PASSWORD || 'apolo123';

app.use(express.static('public'));

const players = new Map();
const edits = new Map();

function playerList(){
  return [...players.entries()].map(([id,p]) => ({id,...p}));
}

io.on('connection', socket => {
  let auth = false;

  socket.on('login', ({name,password}) => {
    name = String(name || '').trim().slice(0,20);

    if(!name){
      socket.emit('login-result',{ok:false,message:'Ingresa un nombre.'});
      return;
    }

    if(String(password || '') !== PASSWORD){
      socket.emit('login-result',{ok:false,message:'Contraseña incorrecta.'});
      return;
    }

    auth = true;

    players.set(socket.id,{
      name,
      x:0,y:24,z:0,
      yaw:0
    });

    socket.emit('login-result',{
      ok:true,
      id:socket.id,
      players:playerList(),
      worldEdits:Object.fromEntries(edits)
    });

    socket.broadcast.emit('player-joined',{
      id:socket.id,
      ...players.get(socket.id)
    });

    io.emit('players-list',playerList());
  });

  socket.on('player-move', d => {
    if(!auth) return;
    const p = players.get(socket.id);
    if(!p) return;

    p.x = Number(d.x) || 0;
    p.y = Number(d.y) || 0;
    p.z = Number(d.z) || 0;
    p.yaw = Number(d.yaw) || 0;

    socket.broadcast.emit('player-moved',{
      id:socket.id,
      x:p.x,y:p.y,z:p.z,yaw:p.yaw
    });
  });

  socket.on('block-edit', e => {
    if(!auth) return;

    const x = Math.round(Number(e.x));
    const y = Math.round(Number(e.y));
    const z = Math.round(Number(e.z));

    if(![x,y,z].every(Number.isFinite)) return;

    const k = `${x},${y},${z}`;

    if(e.action === 'remove'){
      edits.set(k,'removed');
      io.emit('block-edited',{action:'remove',x,y,z});
      return;
    }

    if(e.action === 'place'){
      const allowed = ['grass','dirt','stone','sand','wood','leaves','snow','brick'];
      const type = allowed.includes(e.type) ? e.type : 'grass';

      edits.set(k,{type});
      io.emit('block-edited',{action:'place',x,y,z,type});
    }
  });

  socket.on('chat-message', msg => {
    if(!auth) return;
    const p = players.get(socket.id);
    if(!p) return;

    const message = String(msg || '').trim().slice(0,160);
    if(message){
      io.emit('chat-message',{name:p.name,message});
    }
  });

  socket.on('disconnect', () => {
    if(players.has(socket.id)){
      players.delete(socket.id);
      socket.broadcast.emit('player-left',socket.id);
      io.emit('players-list',playerList());
    }
  });
});

server.listen(PORT,'0.0.0.0',() => {
  console.log(`Block World V3 activo en puerto ${PORT}`);
});

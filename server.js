import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());

// Serve static files (our HTML/JS) from the root folder itself
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/room.html', (_req, res) => res.sendFile(path.join(__dirname, 'room.html')));
app.get('/client_main.js', (_req, res) => res.sendFile(path.join(__dirname, 'client_main.js')));
app.get('/room.js', (_req, res) => res.sendFile(path.join(__dirname, 'room.js')));

app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] },
  path: '/socket.io'
});

// In-memory rooms
const rooms = new Map(); // roomId -> { users: Map(socketId, {name, role}) }

io.of('/meet').on('connection', (socket) => {
  let currentRoom = null;
  let profile = { name: 'Guest', role: 'member' };

  socket.on('join_room', ({ roomId, displayName }) => {
    currentRoom = roomId;
    profile.name = displayName || 'Guest';
    if (!rooms.has(roomId)) rooms.set(roomId, { users: new Map() });
    rooms.get(roomId).users.set(socket.id, profile);

    socket.join(roomId);
    socket.to(roomId).emit('user_joined', { id: socket.id, displayName: profile.name });

    const users = [...rooms.get(roomId).users.entries()].map(([id,u])=>({ id, displayName: u.name }));
    io.of('/meet').to(socket.id).emit('room_users', { users });
  });

  // Signaling + Chat relay
  ['rtc_offer','rtc_answer','rtc_ice','chat_public','chat_private','control_mute','control_kick','promote_cohost']
  .forEach(evt => {
    socket.on(evt, (payload = {}) => {
      if (!currentRoom) return;
      if (payload.to) io.of('/meet').to(payload.to).emit(evt, { from: socket.id, ...payload });
      else socket.to(currentRoom).emit(evt, { from: socket.id, ...payload });
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).users.delete(socket.id);
      socket.to(currentRoom).emit('user_left', { id: socket.id });
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server listening on', PORT));
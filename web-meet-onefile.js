// Web Meet — ONE FILE ONLY
// Run locally:
//   npm i express socket.io cors dotenv
//   node web-meet-onefile.js
//
// Deploy on Render (single-file repo OK):
//   Build Command: npm i express socket.io cors dotenv
//   Start Command: node web-meet-onefile.js
//
// ENV (optional):
//   PORT=8080
//   CORS_ORIGIN=*
//   TURN_URI=stun:stun.l.google.com:19302
//   NODE_ENV=production

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());

// ---------- Inline Pages ----------
const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>منصة الاجتماعات — البداية</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:24px;max-width:780px;margin:auto;}
      input,button{font-size:16px;padding:10px 14px}
      input{width:260px} button{margin-inline-start:8px}
      .muted{opacity:.7}
      .card{border:1px solid #ddd;border-radius:12px;padding:16px}
      a.btn{display:inline-block;margin-top:14px;text-decoration:none;border:1px solid #333;border-radius:8px;padding:8px 12px}
    </style>
  </head>
  <body>
    <h1>منصة الاجتماعات — تجربة سريعة</h1>
    <div class="card">
      <p class="muted">اختَر Room ID أو استخدم الافتراضي ثم ادخل الغرفة. افتح نفس الرابط من نافذة/جهاز آخر للمكالمة.</p>
      <p>
        <label>Room ID: <input id="roomId" /></label>
        <button id="goBtn">دخول</button>
      </p>
      <a class="btn" href="/health" target="_blank">Health</a>
    </div>
    <script>
      (function(){
        const input = document.getElementById('roomId');
        const btn = document.getElementById('goBtn');
        input.value = 'room-' + Math.random().toString(36).slice(2,7);
        btn.addEventListener('click', () => {
          const id = input.value.trim() || 'demo';
          const u = new URL(window.location.href);
          u.pathname = '/room.html';
          u.search = '?room=' + encodeURIComponent(id);
          window.location.href = u.toString();
        });
      })();
    </script>
  </body>
</html>`;

const ROOM_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>غرفة الاجتماع</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:16px;max-width:1100px;margin:auto;}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
      video{width:100%;background:#000;border-radius:8px}
      .chat{margin-top:12px;border-top:1px solid #ddd;padding-top:12px}
      .row{display:flex;gap:8px}
      input,button{font-size:16px;padding:8px 10px}
      ul{list-style:none;padding:0} li{padding:4px 0}
      .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .muted{opacity:.7}
    </style>
  </head>
  <body>
    <div class="topbar">
      <h2 id="title">غرفة</h2>
      <a class="muted" href="/">الصفحة الرئيسية</a>
    </div>
    <div class="grid" id="videos">
      <video id="local" autoplay playsinline muted></video>
    </div>

    <div class="chat">
      <form id="chatForm" class="row">
        <input id="msg" placeholder="اكتب رسالة عامة" />
        <button>إرسال</button>
      </form>
      <ul id="msgs"></ul>
    </div>

    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js" crossorigin="anonymous"></script>
    <script>
      (function(){
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('room') || 'demo';
        document.getElementById('title').textContent = 'غرفة: ' + roomId;

        const socket = io(window.location.origin + '/meet', { path: '/socket.io' });
        const pcMap = new Map();
        const videos = document.getElementById('videos');
        const localVideo = document.getElementById('local');
        const msgs = document.getElementById('msgs');
        const form = document.getElementById('chatForm');
        const input = document.getElementById('msg');
        let localStream = null;

        function appendMsg(text, who){
          const li = document.createElement('li');
          li.innerHTML = '<b>' + who + ':</b> ' + text;
          msgs.appendChild(li);
          msgs.scrollTop = msgs.scrollHeight;
        }

        function createVideoEl(id){
          let v = document.getElementById('video-'+id);
          if (!v){
            v = document.createElement('video');
            v.id = 'video-' + id;
            v.autoplay = true;
            v.playsInline = true;
            videos.appendChild(v);
          }
          return v;
        }

        function createPC(peerId){
          const pc = new RTCPeerConnection();
          if (localStream){
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
          }
          pc.onicecandidate = (e)=> { if (e.candidate) socket.emit('rtc_ice', { to: peerId, candidate: e.candidate }); };
          pc.ontrack = (e)=>{
            const el = createVideoEl(peerId);
            el.srcObject = e.streams[0];
          };
          pcMap.set(peerId, pc);
          return pc;
        }

        async function boot(){
          try{
            localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
            localVideo.srcObject = localStream;
            socket.emit('join_room', { roomId, displayName: 'ضيف' });
          }catch(e){
            alert('لم يتم السماح للكاميرا/المايك: ' + e.message);
          }
        }

        socket.on('connect', boot);

        socket.on('room_users', async ({users})=>{
          for (const u of users){
            if (u.id === socket.id) continue;
            const pc = createPC(u.id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('rtc_offer', { to: u.id, sdp: offer });
          }
        });

        socket.on('user_left', ({ id })=>{
          const pc = pcMap.get(id); if (pc) pc.close(); pcMap.delete(id);
          const v = document.getElementById('video-'+id); if (v) v.remove();
        });

        socket.on('rtc_offer', async ({from, sdp})=>{
          const pc = createPC(from);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('rtc_answer', { to: from, sdp: answer });
        });

        socket.on('rtc_answer', async ({from, sdp})=>{
          const pc = pcMap.get(from);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        socket.on('rtc_ice', async ({from, candidate})=>{
          const pc = pcMap.get(from);
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on('chat_public', ({from, text})=> appendMsg(text, from));

        form.addEventListener('submit', (e)=>{
          e.preventDefault();
          const t = input.value.trim(); if (!t) return;
          socket.emit('chat_public', { text: t });
          input.value = '';
        });

        window.addEventListener('beforeunload', ()=>{
          pcMap.forEach(pc => pc.close());
          localStream && localStream.getTracks().forEach(t => t.stop());
        });
      })();
    </script>
  </body>
</html>`;

// ---------- Routes ----------
app.get('/', (_req, res) => res.type('html').send(INDEX_HTML));
app.get('/room.html', (_req, res) => res.type('html').send(ROOM_HTML));
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- Socket.io Signaling ----------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] },
  path: '/socket.io'
});

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
server.listen(PORT, () => console.log('ONEFILE listening on', PORT));

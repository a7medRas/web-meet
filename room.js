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

  socket.on('user_joined', ({ id, displayName })=>{
    // placeholder; video tag will appear when we receive ontrack
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
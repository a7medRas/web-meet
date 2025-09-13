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
# Web Meet — Flat Starter (Single Folder)

Fully working minimal WebRTC meetings app in **one folder** (no subdirectories).
- **Server**: Node.js + Express + Socket.io (signaling + static hosting)
- **Client**: Plain HTML + JS (no bundler), WebRTC + chat
- **DB**: Not required for MVP (in-memory rooms). Ready to add Mongo later.
- **ICE**: STUN only by default (TURN can be added later).

## Files
- `server.js` — Express + Socket.io signaling server
- `package.json` — scripts
- `.env.example` — environment variables
- `index.html` — landing page to enter/choose Room ID
- `room.html` — meeting page (grid video + chat)
- `client_main.js` — logic for index page
- `room.js` — logic for room page
- `README.md` — this file

## Run locally
```bash
cp .env.example .env
npm install
npm run dev
```
Open: http://localhost:8080

- Create/enter a Room ID on the home page.
- Open the same room link in another browser or device.
- Allow camera/microphone.

## Deploy (quick)
- **Render** (recommended): create a Web Service from this repo, set env from `.env.example`, Start Command: `node server.js`.
- The server serves both API and static HTML files (no separate frontend needed).
- Ensure HTTPS for getUserMedia (Render provides HTTPS by default).

## Env vars
- `PORT` (default 8080)
- `CORS_ORIGIN` (for Socket.io CORS; set to your domain in prod)
- `TURN_URI`, `TURN_USER`, `TURN_PASS` (optional; if not set, STUN-only is used)

## Notes
- This is an MVP for testing. For production: add auth, room passwords, roles, TURN, DB, and security hardening.
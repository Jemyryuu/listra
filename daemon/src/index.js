const http = require('http');
const { WebSocketServer } = require('ws');
const { DiscordRpcClient } = require('./discordRpc');

const PORT = 8989;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '383226320970055681';
const JOIN_BASE_URL = process.env.JOIN_BASE_URL || 'https://listen-together.pages.dev/join';

const arg = process.argv[2];
if (arg && arg.startsWith('listentogether://')) {
  try {
    const raw = arg.replace('listentogether://', '');
    const roomId = raw.split('/').pop()?.toUpperCase()?.trim();
    if (roomId && /^[A-Z0-9]{6}$/.test(roomId)) {
      console.log(`Forwarding join request for room: ${roomId}`);
      const req = http.get(`http://127.0.0.1:${PORT}/join?room=${roomId}`, (res) => {
        process.exit(0);
      });
      req.on('error', () => {
        console.error('Daemon not running or request failed.');
        process.exit(1);
      });
      setTimeout(() => process.exit(0), 1000);
      return;
    }
  } catch (err) {
    process.exit(1);
  }
}

const discord = new DiscordRpcClient(DISCORD_CLIENT_ID, JOIN_BASE_URL);
discord.connect();

let activeSpicetifyWs = null;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/join') {
    const room = url.searchParams.get('room')?.toUpperCase()?.trim();
    if (room && /^[A-Z0-9]{6}$/.test(room)) {
      console.log(`[Daemon] Received join request for room: ${room}`);
      if (activeSpicetifyWs && activeSpicetifyWs.readyState === 1) {
        activeSpicetifyWs.send(
          JSON.stringify({
            v: 1,
            type: 'join.request',
            roomId: room,
          })
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, room }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Spotify extension not connected' }));
      }
      return;
    }
  }

  res.writeHead(404);
  res.end('Not Found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[Daemon] Spicetify extension connected.');
  activeSpicetifyWs = ws;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.v !== 1) return;

      if (msg.type === 'presence.set') {
        discord.setActivity({
          roomId: msg.roomId,
          trackName: msg.trackName,
          artist: msg.artist,
          albumArtUrl: msg.albumArtUrl,
          isPlaying: msg.isPlaying,
        });
      } else if (msg.type === 'presence.clear') {
        discord.clearActivity();
      }
    } catch (err) {
      console.warn('[Daemon] Error processing Spicetify message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[Daemon] Spicetify extension disconnected.');
    if (activeSpicetifyWs === ws) {
      activeSpicetifyWs = null;
      discord.clearActivity();
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ListenTogether Daemon] Running on http://127.0.0.1:${PORT}`);
});

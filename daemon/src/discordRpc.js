const net = require('net');

class DiscordRpcClient {
  constructor(clientId, joinBaseUrl) {
    this.clientId = clientId;
    this.joinBaseUrl = joinBaseUrl;
    this.client = null;
    this.isReady = false;
    this.reconnectTimer = null;
    this.pipeIndex = 0;
  }

  getPipePath(index) {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${index}`;
    }
    const prefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
    return `${prefix.replace(/\/+$/, '')}/discord-ipc-${index}`;
  }

  connect() {
    if (this.client) return;

    const pipePath = this.getPipePath(this.pipeIndex);
    this.client = net.connect(pipePath);

    this.client.on('connect', () => {
      console.log(`[DiscordRPC] Connected to ${pipePath}`);
      this.sendHandshake();
    });

    this.client.on('data', (buf) => {
      try {
        const op = buf.readInt32LE(0);
        const len = buf.readInt32LE(4);
        const data = JSON.parse(buf.slice(8, 8 + len).toString());

        if (data.evt === 'READY') {
          console.log('[DiscordRPC] Handshake verified with Discord.');
          this.isReady = true;
        }
      } catch (err) {
        console.warn('[DiscordRPC] Error parsing Discord frame:', err.message);
      }
    });

    this.client.on('close', () => {
      this.cleanup();
      this.scheduleReconnect();
    });

    this.client.on('error', () => {
      // Try next pipe index in case Discord runs on pipe 1-9 (e.g. Canary, PTB)
      this.pipeIndex = (this.pipeIndex + 1) % 10;
      this.cleanup();
      this.scheduleReconnect();
    });
  }

  encode(op, payload) {
    const json = Buffer.from(JSON.stringify(payload));
    const packet = Buffer.alloc(8 + json.length);
    packet.writeInt32LE(op, 0);
    packet.writeInt32LE(json.length, 4);
    json.copy(packet, 8);
    return packet;
  }

  sendHandshake() {
    if (!this.client) return;
    this.client.write(this.encode(0, { v: 1, client_id: this.clientId }));
  }

  setActivity({ roomId, trackName, artist, albumArtUrl, durationMs, progressMs, isPlaying }) {
    if (!this.isReady || !this.client) return;

    const joinUrl = `${this.joinBaseUrl}?room=${encodeURIComponent(roomId)}`;

    let timestamps;
    if (isPlaying && durationMs && durationMs > 0) {
      const start = Math.max(0, Math.floor((Date.now() - (progressMs || 0)) / 1000));
      const end = start + Math.floor(durationMs / 1000);
      timestamps = { start, end };
    }

    const safeTitle = (trackName && trackName.trim()) ? trackName.trim().slice(0, 128) : 'Listening to Spotify';
    const safeArtist = (artist && artist.trim()) ? `by ${artist.trim().slice(0, 96)} · Listra` : 'Listra Party';

    const activity = {
      details: safeTitle,
      state: safeArtist,
      assets: {
        large_image: albumArtUrl || 'spotify',
        large_text: safeTitle,
      },
      party: {
        id: roomId,
        size: [1, 8],
      },
      buttons: [
        { label: 'Listra', url: joinUrl },
      ],
      timestamps,
    };

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: isPlaying ? activity : null,
      },
      nonce: `${Date.now()}`,
    };

    this.client.write(this.encode(1, payload));
  }

  clearActivity() {
    if (!this.isReady || !this.client) return;
    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null,
      },
      nonce: `${Date.now()}`,
    };
    this.client.write(this.encode(1, payload));
  }

  cleanup() {
    this.isReady = false;
    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
      this.client = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }
}

module.exports = { DiscordRpcClient };

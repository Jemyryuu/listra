# 🎧 Listen Together (Spotify + Discord RPC)

Listen Together is a Spicetify extension and companion daemon that synchronizes Spotify music playback across friends in real time, triggered directly via a **Discord Rich Presence (RPC) button**.

---

## 🌟 Key Features

* **Discord Rich Presence Button:** Broadcasts an interactive `[🎧 Listen Together]` button on your Discord profile.
* **Low-Latency Playback Sync:** Uses WebRTC DataChannels (UDP) and virtual clock synchronization (SNTP algorithm with lowest-RTT filtering).
* **Future Execution Scheduling:** Pre-seeks and coordinates playback at a future microsecond timestamp $T_{\text{target}}$ to eliminate network transit lag and audio buffer delay.
* **Drift Control:** Continuously corrects natural soundcard clock drift without audible popping or stuttering.
* **No Spotify Premium Restriction for Listeners:** Controls desktop Spotify directly via Spicetify's client APIs, bypassing Discord's native Premium lock.
* **No Voice Chat Pausing:** Talk freely in Discord voice channels without playback muting after 30 seconds.

---

## 🏗️ Repository Architecture

```
listen-together-plugin/
├── shared/
│   └── protocol.ts           # Shared message contracts (Version 1)
├── extension/                 # Spicetify client extension
│   ├── src/
│   │   ├── app.tsx            # Main lifecycle & room coordinator
│   │   ├── player/            # PlayerAdapter (Spicetify.Player abstraction)
│   │   ├── sync/              # ClockSync, Scheduler, DriftController, Engines
│   │   ├── net/               # PeerTransport (WebRTC) & DaemonBridge (WS)
│   │   └── ui/                # Playbar button & session modal
│   └── scripts/install.js     # Automatic bundle installer & Spicetify applier
├── daemon/                    # Background companion daemon
│   ├── src/
│   │   ├── index.js           # Local HTTP / WebSocket server (127.0.0.1:8989)
│   │   └── discordRpc.js      # Discord Named Pipe (\\.\pipe\discord-ipc-0) IPC client
│   └── scripts/register-protocol.js # Registers listentogether:// URL scheme in HKCU
├── web/
│   └── index.html             # Static landing page for Discord RPC button redirect
└── signaling/
    ├── src/index.ts           # Cloudflare Worker + Durable Objects WebRTC signaling
    └── wrangler.toml          # Worker configuration
```

---

## 🚀 Quick Start

### For Friends (1-Line Easy Install)
Your friends do **not** need to clone this repo or install Node.js. They just open PowerShell and paste this one command:

```powershell
irm https://raw.githubusercontent.com/Jemyryuu/listra/main/install.ps1 | iex
```

This will automatically:
1. Install Spicetify CLI (if they don't have it).
2. Download the pre-compiled `listen-together.js` directly into their Spicetify directory.
3. Register the Windows protocol handler for Discord links.
4. Apply the extension to their Spotify.

---

### For Developers & Hosts (Running the Daemon)

### 1. Register the Windows Protocol Handler
Registers the custom `listentogether://` scheme in Windows `HKCU` registry (no administrator privileges required):
```powershell
npm run register:protocol
```

### 2. Build & Apply the Spicetify Extension
Ensure Spotify is closed when applying changes so Spicetify can inject the bundle:
```powershell
npm run apply:extension
```
*(Alternatively, copy `extension/dist/listen-together.js` into `%localappdata%\spicetify\Extensions\` and run `spicetify apply`)*.

### 3. Start the Companion Daemon
```powershell
npm run start:daemon
```
The daemon will:
1. Connect to Discord's local IPC pipe (`\\.\pipe\discord-ipc-0`).
2. Listen on `http://127.0.0.1:8989` for local WebSocket and browser loopback signals.

---

## 🌐 Cloudflare Deployment (Free Tier)

### 1. Deploy the Static Join Page (Cloudflare Pages)
```powershell
npm run deploy:web
```
Or host the `web/index.html` file on any static host (GitHub Pages, Vercel, Netlify).

### 2. Deploy the Signaling Worker (Cloudflare Workers)
```powershell
npm run deploy:signaling
```

---

## ⚙️ Configuration & Environment Variables

You can customize the Discord Application and landing page by setting environment variables before starting the daemon:

```powershell
$env:DISCORD_CLIENT_ID = "YOUR_DISCORD_APP_ID"
$env:JOIN_BASE_URL = "https://your-custom-pages-domain.com/join"
npm run start:daemon
```

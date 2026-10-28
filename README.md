# Listra

[English](README.md) | [Bahasa Indonesia](README.id.md)

Listra synchronizes Spotify playback between friends in real time. It pairs a Spicetify extension with a background companion service to control playback and display a join button on your Discord profile.

## Features

- Broadcasts a clickable button on your Discord profile using Discord Rich Presence.
- Syncs playback directly over peer-to-peer WebRTC UDP data channels.
- Estimates clock offsets with an SNTP algorithm to schedule play and seek actions at a shared target timestamp.
- Corrects audio drift between sound cards without causing skips or audible pops.
- Works on desktop Spotify free and premium tiers because playback controls run inside the client.
- Keeps playing during Discord voice calls without muting after 30 seconds.

## Quick Start

### For Listeners (One-Line Installer)
Friends who only want to listen do not need Git, Node.js, or build tools. Run this command in Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Jemyryuu/listra/main/install.ps1 | iex
```

The script will:
1. Install Spicetify CLI if it is not already on your system.
2. Download the pre-built `listen-together.js` bundle into your Spicetify extensions folder.
3. Register the `listentogether://` protocol in your user registry.
4. Run `spicetify apply` to enable the extension in Spotify.

Restart Spotify after installation completes.

### For Hosts (Running the Daemon)

1. Register the URL protocol handler:
   ```powershell
   npm run register:protocol
   ```
2. Build and apply the Spicetify extension:
   ```powershell
   npm run apply:extension
   ```
3. Start the companion daemon:
   ```powershell
   npm run start:daemon
   ```

The daemon connects to your local Discord client through `\\.\pipe\discord-ipc-0` and listens for browser redirects on `http://127.0.0.1:8989`.

## Cloudflare Deployment

Deploy the static join page to Cloudflare Pages:
```powershell
npm run deploy:web
```

Deploy the WebRTC signaling worker:
```powershell
npm run deploy:signaling
```

## Configuration

Set environment variables before starting the daemon to use a custom Discord Application ID or custom landing page domain:

```powershell
$env:DISCORD_CLIENT_ID = "YOUR_DISCORD_APP_ID"
$env:JOIN_BASE_URL = "https://your-custom-pages-domain.com/join"
npm run start:daemon
```

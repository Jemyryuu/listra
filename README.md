# Listra

[English](README.md) | [Bahasa Indonesia](README.id.md)

Listra is a Spicetify extension that synchronizes Spotify playback between friends in real time. It pairs with a lightweight background companion service to control playback and display a join button on your Discord profile.

## Features

- Broadcasts a clickable button on your Discord profile using Discord Rich Presence.
- Syncs playback directly over peer-to-peer WebRTC UDP data channels.
- Estimates clock offsets with an SNTP algorithm to schedule play and seek actions at a shared target timestamp.
- Corrects audio drift between sound cards without causing skips or audible pops.
- Works on desktop Spotify free and premium tiers via Spicetify (note: does not work on regular, unmodified Spotify without Spicetify).
- Keeps playing during Discord voice calls without muting after 30 seconds.

## Quick Start

### Installation

> [!IMPORTANT]
> Listra requires the official desktop Spotify client patched with [Spicetify](https://spicetify.app). It **will not work on regular Spotify** (unpatched desktop client, Windows Store version, or mobile/web players). The one-line installer handles installing Spicetify and the Listra extension automatically.

Both hosts and listeners can install Listra with a single PowerShell command. No Git cloning or manual build steps required:

```powershell
irm https://raw.githubusercontent.com/Jemyryuu/listra/main/install.ps1 | iex
```

The script will:
1. Install Spicetify CLI if it is not already on your system.
2. Install Node.js LTS silently via winget if missing (required for hosting with Discord Rich Presence).
3. Download pre-built `listra.js` into your Spicetify extensions directory.
4. Download the standalone `daemon.js` companion service into `%LOCALAPPDATA%\listra\`.
5. Register the `listra://` protocol handler in your Windows user registry to auto-launch the daemon silently.
6. Add the `listra` command to your PATH.
7. Remove any legacy `listen-together.js` references and enable `listra.js` in Spotify via `spicetify apply`.

Restart Spotify (with Spicetify applied) after installation completes.

### Running Listra

- **To Host**: Open Spotify, click the **Listra** button, and click **Start Hosting Party**. Spotify launches the background daemon automatically.
- **To Join**: Click a friend's Discord profile button, follow a join link, or enter their 6-letter room code in the Listra menu.
- **Terminal Command (Optional)**: You can also start the companion daemon manually from any command line:
  ```powershell
  listra
  ```

---

## Development

If you are developing or modifying Listra from source:

1. Build both extension and daemon bundles:
   ```powershell
   npm run build
   ```
2. Apply the extension to your local Spotify client:
   ```powershell
   npm run apply:extension
   ```
3. Register the protocol handler for your development directory:
   ```powershell
   npm run register:protocol
   ```
4. Start the development daemon:
   ```powershell
   npm run start:daemon
   ```

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

Set environment variables before starting the daemon to use a custom Discord Application ID or landing page domain:

```powershell
$env:DISCORD_CLIENT_ID = "YOUR_DISCORD_APP_ID"
$env:JOIN_BASE_URL = "https://your-custom-pages-domain.com/join"
npm run start:daemon
```

"use strict";
(() => {
  // src/sync/ClockSync.ts
  var ClockSync = class {
    samples = [];
    maxSamples = 16;
    currentOffset = 0;
    bestRtt = Infinity;
    recordSample(t1, t2, t3, t4) {
      const rtt = t4 - t1 - (t3 - t2);
      if (rtt < 0) return;
      const offset = (t2 - t1 + (t3 - t4)) / 2;
      this.samples.push({ rtt, offset, timestamp: t4 });
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
      this.recomputeOffset();
    }
    recomputeOffset() {
      if (this.samples.length === 0) return;
      const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
      this.bestRtt = sorted[0].rtt;
      const topCount = Math.min(3, sorted.length);
      let offsetSum = 0;
      for (let i = 0; i < topCount; i++) {
        offsetSum += sorted[i].offset;
      }
      this.currentOffset = offsetSum / topCount;
    }
    now() {
      return performance.now() + this.currentOffset;
    }
    getOffset() {
      return this.currentOffset;
    }
    getBestRtt() {
      return this.bestRtt;
    }
    getConfidenceMs() {
      return this.bestRtt === Infinity ? 50 : this.bestRtt / 2;
    }
  };

  // src/sync/Scheduler.ts
  var Scheduler = class {
    clock;
    pendingTimer = null;
    audioPipelineLeadMs = 25;
    // Compensates for internal audio buffer delay
    constructor(clock) {
      this.clock = clock;
    }
    setAudioPipelineLead(ms) {
      this.audioPipelineLeadMs = Math.max(0, ms);
    }
    executeAt(targetHostTime, callback) {
      this.cancel();
      const adjustedTarget = targetHostTime - this.audioPipelineLeadMs;
      const checkTime = () => {
        const remaining = adjustedTarget - this.clock.now();
        if (remaining <= 0) {
          this.pendingTimer = null;
          callback();
        } else if (remaining <= 15) {
          while (adjustedTarget - this.clock.now() > 0.5) {
          }
          this.pendingTimer = null;
          callback();
        } else {
          this.pendingTimer = window.setTimeout(checkTime, remaining - 10);
        }
      };
      checkTime();
    }
    cancel() {
      if (this.pendingTimer !== null) {
        clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
      }
    }
  };

  // src/player/PlayerAdapter.ts
  var PlayerAdapter = class {
    static getCurrentTrack() {
      const data = Spicetify.Player.data;
      if (!data?.item) return null;
      const item = data.item;
      const meta = item.metadata || {};
      let albumArt = meta.image_xlarge_url || meta.image_large_url || meta.image_url || "";
      if (albumArt.startsWith("spotify:image:")) {
        albumArt = `https://i.scdn.co/image/${albumArt.slice(14)}`;
      }
      return {
        uri: item.uri,
        title: item.name || meta.title || "Unknown Title",
        artist: item.artists && item.artists[0]?.name || meta.artist_name || "Unknown Artist",
        albumArtUrl: albumArt,
        durationMs: data.duration || 0,
        progressMs: Spicetify.Player.getProgress(),
        isPlaying: Spicetify.Player.isPlaying()
      };
    }
    static isPlaying() {
      return Spicetify.Player.isPlaying();
    }
    static getProgressMs() {
      return Spicetify.Player.getProgress();
    }
    static async play() {
      if (!Spicetify.Player.isPlaying()) {
        await Spicetify.Player.play();
      }
    }
    static async pause() {
      if (Spicetify.Player.isPlaying()) {
        await Spicetify.Player.pause();
      }
    }
    static seek(positionMs) {
      Spicetify.Player.seek(positionMs);
    }
    static async playUri(uri) {
      await Spicetify.Player.playUri(uri);
    }
    static async prefetchNext(uri) {
      try {
        if (Spicetify.Platform?.PlayerAPI?.addToQueue) {
          await Spicetify.Platform.PlayerAPI.addToQueue([{ uri }]);
        }
      } catch (err) {
        console.warn("[ListenTogether] Failed to prefetch track into queue:", err);
      }
    }
    static onSongChange(callback) {
      Spicetify.Player.addEventListener("songchange", callback);
    }
    static onPlayPause(callback) {
      Spicetify.Player.addEventListener("onplaypause", callback);
    }
  };

  // ../shared/protocol.ts
  var PROTOCOL_VERSION = 1;

  // src/sync/HostEngine.ts
  var HostEngine = class {
    clock;
    scheduler;
    transport;
    daemon;
    roomId;
    seq = 0;
    heartbeatTimer = null;
    clockPingTimer = null;
    lastTrack = null;
    constructor(roomId, clock, transport, daemon) {
      this.roomId = roomId;
      this.clock = clock;
      this.transport = transport;
      this.daemon = daemon;
      this.scheduler = new Scheduler(clock);
    }
    start() {
      this.broadcastCurrentTrack();
      PlayerAdapter.onSongChange(() => this.handleTrackChange());
      PlayerAdapter.onPlayPause(() => this.handlePlayPauseChange());
      this.heartbeatTimer = window.setInterval(() => {
        this.sendHeartbeat();
      }, 2500);
      this.clockPingTimer = window.setInterval(() => {
        this.transport.sendClock({
          v: PROTOCOL_VERSION,
          type: "ping",
          t1: performance.now()
        });
      }, 2e3);
    }
    handleTrackChange() {
      const track = PlayerAdapter.getCurrentTrack();
      if (!track) return;
      this.lastTrack = track;
      const leadMs = 300;
      const executeAt = this.clock.now() + leadMs;
      this.transport.sendControl({
        v: PROTOCOL_VERSION,
        type: "schedule",
        seq: ++this.seq,
        action: "load",
        uri: track.uri,
        positionMs: 0,
        executeAtHostTime: executeAt
      });
      this.updateDiscordPresence(track);
    }
    handlePlayPauseChange() {
      const isPlaying = PlayerAdapter.isPlaying();
      const pos = PlayerAdapter.getProgressMs();
      const leadMs = 200;
      const executeAt = this.clock.now() + leadMs;
      this.transport.sendControl({
        v: PROTOCOL_VERSION,
        type: "schedule",
        seq: ++this.seq,
        action: isPlaying ? "play" : "pause",
        positionMs: pos,
        executeAtHostTime: executeAt
      });
      const track = PlayerAdapter.getCurrentTrack();
      if (track) {
        this.updateDiscordPresence(track);
      }
    }
    sendHeartbeat() {
      const track = PlayerAdapter.getCurrentTrack();
      if (!track) return;
      this.transport.sendControl({
        v: PROTOCOL_VERSION,
        type: "state",
        seq: ++this.seq,
        uri: track.uri,
        positionMs: track.progressMs,
        atHostTime: this.clock.now(),
        isPlaying: track.isPlaying
      });
    }
    updateDiscordPresence(track) {
      this.daemon.setPresence(
        this.roomId,
        track.title,
        track.artist,
        track.albumArtUrl,
        track.uri,
        track.durationMs,
        track.progressMs,
        track.isPlaying
      );
    }
    broadcastCurrentTrack() {
      const track = PlayerAdapter.getCurrentTrack();
      if (track) {
        this.lastTrack = track;
        this.updateDiscordPresence(track);
        this.sendHeartbeat();
      }
    }
    stop() {
      if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
      if (this.clockPingTimer !== null) clearInterval(this.clockPingTimer);
      this.daemon.clearPresence();
    }
  };

  // src/sync/DriftController.ts
  var DriftController = class {
    clock;
    moderateDriftCount = 0;
    maxModerateDriftStrikes = 3;
    constructor(clock) {
      this.clock = clock;
    }
    evaluateHeartbeat(hostPositionMs, hostSentAtMasterTime, isPlaying, onResyncNeeded) {
      if (!isPlaying || !PlayerAdapter.isPlaying()) {
        return { deltaMs: 0, status: "in-sync" };
      }
      const elapsedMasterMs = this.clock.now() - hostSentAtMasterTime;
      const expectedPositionMs = hostPositionMs + elapsedMasterMs;
      const localPositionMs = PlayerAdapter.getProgressMs();
      const deltaMs = Math.abs(localPositionMs - expectedPositionMs);
      if (deltaMs < 30) {
        this.moderateDriftCount = 0;
        return { deltaMs, status: "in-sync" };
      }
      if (deltaMs <= 150) {
        this.moderateDriftCount++;
        if (this.moderateDriftCount >= this.maxModerateDriftStrikes) {
          this.moderateDriftCount = 0;
          onResyncNeeded(expectedPositionMs);
          return { deltaMs, status: "nudge" };
        }
        return { deltaMs, status: "in-sync" };
      }
      this.moderateDriftCount = 0;
      onResyncNeeded(expectedPositionMs);
      return { deltaMs, status: "hard-resync" };
    }
  };

  // src/sync/ListenerEngine.ts
  var ListenerEngine = class {
    clock;
    scheduler;
    driftController;
    transport;
    currentUri = null;
    constructor(clock, transport) {
      this.clock = clock;
      this.transport = transport;
      this.scheduler = new Scheduler(clock);
      this.driftController = new DriftController(clock);
    }
    handleClockMessage(msg) {
      if (msg.type === "ping") {
        const now = performance.now();
        this.transport.sendClock({
          v: PROTOCOL_VERSION,
          type: "pong",
          t1: msg.t1,
          t2: now,
          t3: performance.now()
        });
      } else if (msg.type === "pong") {
        const t4 = performance.now();
        this.clock.recordSample(msg.t1, msg.t2, msg.t3, t4);
      }
    }
    async handleControlMessage(msg) {
      switch (msg.type) {
        case "schedule":
          await this.handleSchedule(msg);
          break;
        case "state":
          this.handleStateHeartbeat(msg);
          break;
        case "prefetch":
          PlayerAdapter.prefetchNext(msg.uri);
          break;
      }
    }
    async handleSchedule(msg) {
      if (msg.action === "load" && msg.uri) {
        this.currentUri = msg.uri;
        await PlayerAdapter.pause();
        await PlayerAdapter.playUri(msg.uri);
        if (msg.positionMs !== void 0) {
          PlayerAdapter.seek(msg.positionMs);
        }
        await PlayerAdapter.pause();
        this.scheduler.executeAt(msg.executeAtHostTime, () => {
          PlayerAdapter.play();
        });
      } else if (msg.action === "play") {
        this.scheduler.executeAt(msg.executeAtHostTime, () => {
          if (msg.positionMs !== void 0) {
            PlayerAdapter.seek(msg.positionMs);
          }
          PlayerAdapter.play();
        });
      } else if (msg.action === "pause") {
        this.scheduler.executeAt(msg.executeAtHostTime, () => {
          PlayerAdapter.pause();
          if (msg.positionMs !== void 0) {
            PlayerAdapter.seek(msg.positionMs);
          }
        });
      } else if (msg.action === "seek" && msg.positionMs !== void 0) {
        this.scheduler.executeAt(msg.executeAtHostTime, () => {
          PlayerAdapter.seek(msg.positionMs);
        });
      }
    }
    handleStateHeartbeat(msg) {
      if (this.currentUri !== msg.uri) {
        this.currentUri = msg.uri;
        PlayerAdapter.playUri(msg.uri);
      }
      this.driftController.evaluateHeartbeat(
        msg.positionMs,
        msg.atHostTime,
        msg.isPlaying,
        (targetPos) => {
          console.log(`[ListenTogether] Drift correction seeking to ${targetPos}ms`);
          PlayerAdapter.seek(targetPos);
        }
      );
    }
  };

  // src/net/PeerTransport.ts
  var PeerTransport = class {
    pc = null;
    clockChannel = null;
    controlChannel = null;
    callbacks;
    isHost;
    constructor(isHost, callbacks) {
      this.isHost = isHost;
      this.callbacks = callbacks;
    }
    initialize(iceServers) {
      this.pc = new RTCPeerConnection({
        iceServers
      });
      this.pc.oniceconnectionstatechange = () => {
        if (this.pc?.iceConnectionState === "disconnected" || this.pc?.iceConnectionState === "failed" || this.pc?.iceConnectionState === "closed") {
          this.callbacks.onDisconnected();
        }
      };
      if (this.isHost) {
        this.clockChannel = this.pc.createDataChannel("clock", {
          ordered: false,
          maxRetransmits: 0
        });
        this.setupClockChannel(this.clockChannel);
        this.controlChannel = this.pc.createDataChannel("control", {
          ordered: true
        });
        this.setupControlChannel(this.controlChannel);
      } else {
        this.pc.ondatachannel = (event) => {
          if (event.channel.label === "clock") {
            this.clockChannel = event.channel;
            this.setupClockChannel(this.clockChannel);
          } else if (event.channel.label === "control") {
            this.controlChannel = event.channel;
            this.setupControlChannel(this.controlChannel);
          }
        };
      }
    }
    setupClockChannel(ch) {
      ch.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.callbacks.onClockMessage(msg);
        } catch (err) {
        }
      };
    }
    setupControlChannel(ch) {
      ch.onopen = () => {
        this.callbacks.onConnected();
      };
      ch.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.callbacks.onControlMessage(msg);
        } catch (err) {
        }
      };
      ch.onclose = () => {
        this.callbacks.onDisconnected();
      };
    }
    sendClock(msg) {
      if (this.clockChannel && this.clockChannel.readyState === "open") {
        this.clockChannel.send(JSON.stringify(msg));
      }
    }
    sendControl(msg) {
      if (this.controlChannel && this.controlChannel.readyState === "open") {
        this.controlChannel.send(JSON.stringify(msg));
      }
    }
    getPeerConnection() {
      return this.pc;
    }
    close() {
      this.clockChannel?.close();
      this.controlChannel?.close();
      this.pc?.close();
      this.clockChannel = null;
      this.controlChannel = null;
      this.pc = null;
    }
  };

  // src/net/DaemonBridge.ts
  var DaemonBridge = class {
    ws = null;
    url = "ws://127.0.0.1:8989";
    token = "listen-together-local-token";
    isConnected = false;
    reconnectTimer = null;
    onJoinRequestHandler;
    constructor(onJoinRequest) {
      this.onJoinRequestHandler = onJoinRequest;
    }
    connect() {
      if (this.ws) return;
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.isConnected = true;
          console.log("[ListenTogether] Connected to companion daemon.");
          this.send({
            v: PROTOCOL_VERSION,
            type: "hello",
            token: this.token,
            clientVersion: "1.0.0"
          });
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.v === PROTOCOL_VERSION && msg.type === "join.request") {
              if (this.onJoinRequestHandler) {
                this.onJoinRequestHandler(msg.roomId);
              }
            }
          } catch (err) {
            console.warn("[ListenTogether] Malformed daemon message:", err);
          }
        };
        this.ws.onclose = () => {
          this.isConnected = false;
          this.ws = null;
          this.scheduleReconnect();
        };
        this.ws.onerror = () => {
        };
      } catch (err) {
        this.scheduleReconnect();
      }
    }
    scheduleReconnect() {
      if (this.reconnectTimer !== null) return;
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 4e3);
    }
    send(msg) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    }
    setPresence(roomId, trackName, artist, albumArtUrl, trackUri, durationMs, progressMs, isPlaying) {
      this.send({
        v: PROTOCOL_VERSION,
        type: "presence.set",
        roomId,
        trackName,
        artist,
        albumArtUrl,
        trackUri,
        durationMs,
        progressMs,
        isPlaying
      });
    }
    clearPresence() {
      this.send({
        v: PROTOCOL_VERSION,
        type: "presence.clear"
      });
    }
    hasConnection() {
      return this.isConnected;
    }
  };

  // src/ui/SessionUI.ts
  var SessionUI = class {
    button = null;
    actions;
    currentRoomId = null;
    isHost = false;
    constructor(actions) {
      this.actions = actions;
    }
    register() {
      const iconSvg = `
      <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5a6.5 6.5 0 0 0-6.5 6.5v4.5A2.5 2.5 0 0 0 4 15h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H2.5V8a5.5 5.5 0 1 1 11 0v1H12a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a2.5 2.5 0 0 0 2.5-2.5V8A6.5 6.5 0 0 0 8 1.5z"/>
      </svg>
    `;
      try {
        if (Spicetify.Topbar && Spicetify.Topbar.Button) {
          this.button = new Spicetify.Topbar.Button(
            "Listen Together",
            iconSvg,
            () => this.openModal(),
            false,
            false
          );
        } else if (Spicetify.Playbar && Spicetify.Playbar.Button) {
          this.button = new Spicetify.Playbar.Button(
            "Listen Together",
            iconSvg,
            () => this.openModal()
          );
        }
      } catch (err) {
        console.warn("[ListenTogether] Error creating UI button:", err);
      }
    }
    setSessionActive(roomId, isHost) {
      this.currentRoomId = roomId;
      this.isHost = isHost;
      try {
        if (this.button) {
          this.button.active = true;
          if (this.button.element) {
            this.button.element.style.color = "#1db954";
          }
        }
        Spicetify.showNotification(`[Listen Together] ${isHost ? "Hosting" : "Joined"} Room: ${roomId}`);
      } catch (e) {
      }
    }
    setSessionInactive() {
      this.currentRoomId = null;
      this.isHost = false;
      try {
        if (this.button) {
          this.button.active = false;
          if (this.button.element) {
            this.button.element.style.color = "";
          }
        }
        Spicetify.showNotification("[Listen Together] Left session.");
      } catch (e) {
      }
    }
    openModal() {
      if (!Spicetify.PopupModal) {
        if (this.currentRoomId) {
          if (confirm(`Active Session: ${this.currentRoomId}
Leave session?`)) {
            this.actions.onLeave();
          }
        } else {
          const code = prompt("Enter 6-letter Room ID (or leave blank to Host):", "");
          if (code === null) return;
          const trimmed = code.trim().toUpperCase();
          if (trimmed.length === 0) this.actions.onStartHost();
          else if (trimmed.length === 6) this.actions.onJoin(trimmed);
        }
        return;
      }
      const container = document.createElement("div");
      container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #fff;
      font-family: var(--font-family, sans-serif);
      padding: 8px 4px;
    `;
      if (this.currentRoomId) {
        container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #282828; padding: 12px 16px; border-radius: 8px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${this.isHost ? "#1db954" : "#3d91f4"}; font-weight: bold;">
              \u25CF ${this.isHost ? "Hosting Party" : "Listening In Sync"}
            </div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 3px; font-family: monospace; margin-top: 4px;">
              ${this.currentRoomId}
            </div>
          </div>
          <button id="lt-copy-btn" style="background: #3e3e3e; border: none; color: #fff; padding: 8px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; cursor: pointer; transition: 0.2s;">
            Copy Code
          </button>
        </div>

        <div style="font-size: 13px; color: #b3b3b3; line-height: 1.5;">
          ${this.isHost ? '<b>Discord RPC is active.</b> Friends can click <i>"Listen Together"</i> on your Discord profile to join automatically.' : "You are synchronized to the host. Any track changes or pauses will sync automatically."}
        </div>

        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button id="lt-copy-link-btn" style="flex: 1; background: #282828; border: 1px solid #3e3e3e; color: #fff; padding: 12px; border-radius: 24px; font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s;">
            Copy Join Link
          </button>
          <button id="lt-leave-btn" style="flex: 1; background: #e91429; border: none; color: #fff; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.2s;">
            Leave Party
          </button>
        </div>
      `;
        const copyBtn = container.querySelector("#lt-copy-btn");
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(this.currentRoomId);
          copyBtn.innerText = "Copied!";
          setTimeout(() => copyBtn.innerText = "Copy Code", 2e3);
        };
        const copyLinkBtn = container.querySelector("#lt-copy-link-btn");
        copyLinkBtn.onclick = () => {
          const link = `https://listen-together.pages.dev/join?room=${this.currentRoomId}`;
          navigator.clipboard.writeText(link);
          copyLinkBtn.innerText = "Link Copied!";
          setTimeout(() => copyLinkBtn.innerText = "Copy Join Link", 2e3);
        };
        const leaveBtn = container.querySelector("#lt-leave-btn");
        leaveBtn.onclick = () => {
          Spicetify.PopupModal.hide();
          this.actions.onLeave();
        };
      } else {
        container.innerHTML = `
        <div style="color: #b3b3b3; font-size: 14px; line-height: 1.5;">
          Synchronize Spotify playback in real time with friends via WebRTC and Discord Rich Presence.
        </div>

        <div style="background: #242424; padding: 16px; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">Host a Party</div>
          <div style="font-size: 12px; color: #a7a7a7; margin-bottom: 12px;">
            Creates a room code and sets your Discord status with a clickable join button.
          </div>
          <button id="lt-host-btn" style="width: 100%; background: #1db954; color: #000; border: none; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform 0.1s, background 0.2s;">
            Start Hosting Party
          </button>
        </div>

        <div style="display: flex; align-items: center; text-align: center; color: #535353; font-size: 12px; font-weight: bold; margin: 4px 0;">
          <div style="flex: 1; height: 1px; background: #333;"></div>
          <span style="padding: 0 10px;">OR JOIN A FRIEND</span>
          <div style="flex: 1; height: 1px; background: #333;"></div>
        </div>

        <div style="background: #242424; padding: 16px; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px;">Enter 6-Letter Room Code</div>
          <div style="display: flex; gap: 8px;">
            <input id="lt-join-input" type="text" maxlength="6" placeholder="ABC123" style="flex: 1; background: #121212; border: 1px solid #3e3e3e; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; text-align: center; outline: none;" />
            <button id="lt-join-btn" style="background: #fff; color: #000; border: none; padding: 0 20px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
              Join
            </button>
          </div>
        </div>
      `;
        const hostBtn = container.querySelector("#lt-host-btn");
        hostBtn.onclick = () => {
          this.actions.onStartHost();
          this.openModal();
        };
        const joinInput = container.querySelector("#lt-join-input");
        const joinBtn = container.querySelector("#lt-join-btn");
        const triggerJoin = () => {
          const val = joinInput.value.trim().toUpperCase();
          if (val.length === 6) {
            this.actions.onJoin(val);
            this.openModal();
          } else {
            joinInput.style.borderColor = "#e91429";
            Spicetify.showNotification("Room code must be exactly 6 characters.", true);
          }
        };
        joinBtn.onclick = triggerJoin;
        joinInput.onkeydown = (e) => {
          if (e.key === "Enter") triggerJoin();
        };
      }
      Spicetify.PopupModal.display({
        title: "Listen Together",
        content: container,
        isLarge: false
      });
    }
  };

  // src/app.tsx
  var ListenTogetherApp = class {
    clock;
    daemon;
    ui;
    transport = null;
    hostEngine = null;
    listenerEngine = null;
    constructor() {
      this.clock = new ClockSync();
      this.daemon = new DaemonBridge((roomId) => {
        this.joinRoom(roomId);
      });
      this.ui = new SessionUI({
        onStartHost: () => this.startHost(),
        onJoin: (roomId) => this.joinRoom(roomId),
        onLeave: () => this.leave()
      });
    }
    init() {
      console.log("[ListenTogether] Initializing extension...");
      try {
        this.daemon.connect();
      } catch (e) {
        console.warn("[ListenTogether] Daemon connection deferred:", e);
      }
      try {
        this.ui.register();
      } catch (e) {
        console.warn("[ListenTogether] UI registration deferred:", e);
      }
    }
    generateRoomId() {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let id = "";
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return id;
    }
    startHost() {
      try {
        this.leave();
        const roomId = this.generateRoomId();
        console.log(`[ListenTogether] Starting host session: ${roomId}`);
        this.transport = new PeerTransport(true, {
          onClockMessage: () => {
          },
          onControlMessage: () => {
          },
          onConnected: () => {
            console.log("[ListenTogether] Peer connected to host!");
            Spicetify.showNotification("Friend joined your Listen Together session!");
            this.hostEngine?.sendHeartbeat();
          },
          onDisconnected: () => {
            console.log("[ListenTogether] Peer disconnected from host.");
          }
        });
        this.transport.initialize([
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:stun.l.google.com:19302" }
        ]);
        this.hostEngine = new HostEngine(roomId, this.clock, this.transport, this.daemon);
        this.hostEngine.start();
        this.ui.setSessionActive(roomId, true);
      } catch (err) {
        console.error("[ListenTogether] Error starting host:", err);
      }
    }
    joinRoom(roomId) {
      try {
        this.leave();
        console.log(`[ListenTogether] Joining room: ${roomId}`);
        this.transport = new PeerTransport(false, {
          onClockMessage: (msg) => {
            this.listenerEngine?.handleClockMessage(msg);
          },
          onControlMessage: (msg) => {
            this.listenerEngine?.handleControlMessage(msg);
          },
          onConnected: () => {
            console.log("[ListenTogether] Successfully connected to host!");
            Spicetify.showNotification("Connected! Synchronizing playback...");
          },
          onDisconnected: () => {
            console.log("[ListenTogether] Disconnected from host.");
            this.leave();
          }
        });
        this.transport.initialize([
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:stun.l.google.com:19302" }
        ]);
        this.listenerEngine = new ListenerEngine(this.clock, this.transport);
        this.ui.setSessionActive(roomId, false);
      } catch (err) {
        console.error("[ListenTogether] Error joining room:", err);
      }
    }
    leave() {
      try {
        if (this.hostEngine) {
          this.hostEngine.stop();
          this.hostEngine = null;
        }
        if (this.transport) {
          this.transport.close();
          this.transport = null;
        }
        this.listenerEngine = null;
        this.ui.setSessionInactive();
      } catch (err) {
        console.error("[ListenTogether] Error leaving session:", err);
      }
    }
  };
  (function initWhenReady() {
    if (!window.Spicetify || !Spicetify.Player || !Spicetify.Topbar && !Spicetify.Playbar) {
      setTimeout(initWhenReady, 300);
      return;
    }
    try {
      const app = new ListenTogetherApp();
      app.init();
    } catch (err) {
      console.error("[ListenTogether] Uncaught init error:", err);
    }
  })();
})();

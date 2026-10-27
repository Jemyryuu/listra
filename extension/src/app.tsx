import { ClockSync } from './sync/ClockSync';
import { HostEngine } from './sync/HostEngine';
import { ListenerEngine } from './sync/ListenerEngine';
import { PeerTransport } from './net/PeerTransport';
import { DaemonBridge } from './net/DaemonBridge';
import { SessionUI } from './ui/SessionUI';

class ListenTogetherApp {
  private clock: ClockSync;
  private daemon: DaemonBridge;
  private ui: SessionUI;
  private transport: PeerTransport | null = null;
  private hostEngine: HostEngine | null = null;
  private listenerEngine: ListenerEngine | null = null;

  constructor() {
    this.clock = new ClockSync();

    this.daemon = new DaemonBridge((roomId) => {
      this.joinRoom(roomId);
    });

    this.ui = new SessionUI({
      onStartHost: () => this.startHost(),
      onJoin: (roomId) => this.joinRoom(roomId),
      onLeave: () => this.leave(),
    });
  }

  public init(): void {
    console.log('[ListenTogether] Initializing extension...');
    this.daemon.connect();
    this.ui.register();
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous 0/O/1/I
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  public startHost(): void {
    this.leave();

    const roomId = this.generateRoomId();
    console.log(`[ListenTogether] Starting host session: ${roomId}`);

    this.transport = new PeerTransport(true, {
      onClockMessage: (msg) => {
        // Host responds to listener clock pings if any
      },
      onControlMessage: (msg) => {
        // Host handles member join or auxiliary actions
      },
      onConnected: () => {
        console.log('[ListenTogether] Peer connected to host!');
        Spicetify.showNotification('Friend joined your Listen Together session!');
        this.hostEngine?.sendHeartbeat();
      },
      onDisconnected: () => {
        console.log('[ListenTogether] Peer disconnected from host.');
      },
    });

    this.transport.initialize([
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
    ]);

    this.hostEngine = new HostEngine(roomId, this.clock, this.transport, this.daemon);
    this.hostEngine.start();
    this.ui.setSessionActive(roomId, true);
  }

  public joinRoom(roomId: string): void {
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
        console.log('[ListenTogether] Successfully connected to host!');
        Spicetify.showNotification('Connected! Synchronizing playback...');
      },
      onDisconnected: () => {
        console.log('[ListenTogether] Disconnected from host.');
        this.leave();
      },
    });

    this.transport.initialize([
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
    ]);

    this.listenerEngine = new ListenerEngine(this.clock, this.transport);
    this.ui.setSessionActive(roomId, false);
  }

  public leave(): void {
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
  }
}

// Spicetify extension entry point
(function initWhenReady() {
  if (!Spicetify.Playbar || !Spicetify.Player) {
    setTimeout(initWhenReady, 250);
    return;
  }

  const app = new ListenTogetherApp();
  app.init();
})();

import { ClockSync } from './sync/ClockSync';

import { HostEngine } from './sync/HostEngine';

import { ListenerEngine } from './sync/ListenerEngine';

import { PeerTransport } from './net/PeerTransport';

import { DaemonBridge } from './net/DaemonBridge';

import { SessionUI } from './ui/SessionUI';



class ListraApp {

  private clock: ClockSync;

  private daemon: DaemonBridge;

  private ui: SessionUI;

  private transport: PeerTransport | null = null;

  private hostEngine: HostEngine | null = null;

  private listenerEngine: ListenerEngine | null = null;

  private isAutoLaunchingDaemon = false;

  private autoLaunchTimer: number | null = null;



  constructor() {

    this.clock = new ClockSync();



    this.daemon = new DaemonBridge(

      (roomId) => {

        this.joinRoom(roomId);

      },

      (connected) => {

        this.handleDaemonStatusChange(connected);

      }

    );



    this.ui = new SessionUI({

      onStartHost: () => this.startHost(),

      onJoin: (roomId) => this.joinRoom(roomId),

      onLeave: () => this.leave(),

      isDaemonConnected: () => this.daemon.hasConnection(),

      onLaunchDaemon: () => this.autoLaunchDaemonAndHost(),

    });

  }



  private handleDaemonStatusChange(connected: boolean): void {

    if (connected) {

      if (this.autoLaunchTimer !== null) {

        clearTimeout(this.autoLaunchTimer);

        this.autoLaunchTimer = null;

      }

      const wasAutoLaunching = this.isAutoLaunchingDaemon;

      this.isAutoLaunchingDaemon = false;

      this.ui.setDaemonLaunching(false);



      if (this.hostEngine) {

        this.hostEngine.broadcastCurrentTrack();

        Spicetify.showNotification('[Listra] Reconnected to companion daemon. Discord RPC restored.');

      } else if (wasAutoLaunching) {

        Spicetify.showNotification('[Listra] Daemon connected! Starting host session...');

        this.startHost();

        return;

      }

    } else {

      if (this.hostEngine) {

        Spicetify.showNotification('[Listra] Companion daemon disconnected. Discord RPC is inactive.', true);

      }

    }

    this.ui.updateDaemonStatus(connected);

  }



  public init(): void {

    console.log('[Listra] Initializing extension...');

    try {

      this.daemon.connect();

    } catch (e) {

      console.warn('[Listra] Daemon connection deferred:', e);

    }

    try {

      this.ui.register();

    } catch (e) {

      console.warn('[Listra] UI registration deferred:', e);

    }

  }



  private generateRoomId(): string {

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let id = '';

    for (let i = 0; i < 6; i++) {

      id += chars.charAt(Math.floor(Math.random() * chars.length));

    }

    return id;

  }



  private autoLaunchDaemonAndHost(): void {

    if (this.isAutoLaunchingDaemon) return;



    this.isAutoLaunchingDaemon = true;

    Spicetify.showNotification('[Listra] Starting companion daemon in background...');

    this.ui.setDaemonLaunching(true);



    try {

      // 1. Try hidden iframe (standard for triggering custom protocol handlers without page navigation)

      const iframe = document.createElement('iframe');

      iframe.style.display = 'none';

      iframe.src = 'listra://start';

      document.body.appendChild(iframe);

      setTimeout(() => {

        try {

          iframe.remove();

        } catch (e) {}

      }, 2000);



      // 2. Also try invisible anchor click as fallback

      const a = document.createElement('a');

      a.href = 'listra://start';

      a.style.display = 'none';

      document.body.appendChild(a);

      a.click();

      setTimeout(() => {

        try {

          a.remove();

        } catch (e) {}

      }, 1000);

    } catch (err) {

      console.warn('[Listra] Protocol launch failed:', err);

    }



    if (this.autoLaunchTimer !== null) clearTimeout(this.autoLaunchTimer);

    this.autoLaunchTimer = window.setTimeout(() => {

      this.autoLaunchTimer = null;

      if (this.isAutoLaunchingDaemon && !this.daemon.hasConnection()) {

        this.isAutoLaunchingDaemon = false;

        this.ui.setDaemonLaunching(false);

        Spicetify.showNotification('[Listra] Companion daemon did not respond. Run "listra" in terminal to start it manually.', true);

      }

    }, 7000);

  }



  public startHost(): void {

    try {

      this.leave();



      const roomId = this.generateRoomId();

      console.log(`[Listra] Starting host session: ${roomId}`);



      this.transport = new PeerTransport(true, {

        onClockMessage: () => {},

        onControlMessage: () => {},

        onConnected: () => {

          console.log('[Listra] Peer connected to host!');

          Spicetify.showNotification('Friend joined your Listra session!');

          this.hostEngine?.sendHeartbeat();

        },

        onDisconnected: () => {

          console.log('[Listra] Peer disconnected from host.');

        },

      });



      this.transport.initialize(roomId, [

        { urls: 'stun:stun.cloudflare.com:3478' },

        { urls: 'stun:stun.l.google.com:19302' },

      ]);



      this.hostEngine = new HostEngine(roomId, this.clock, this.transport, this.daemon);

      this.hostEngine.start();

      this.ui.setSessionActive(roomId, true);



      // Attempt background launch of daemon if offline so Discord RPC can connect without blocking host session

      if (!this.daemon.hasConnection()) {

        this.autoLaunchDaemonAndHost();

      }

    } catch (err) {

      console.error('[Listra] Error starting host:', err);

      Spicetify.showNotification('[Listra] Error starting host session: ' + String(err), true);

    }

  }



  public joinRoom(roomId: string): void {

    try {

      this.leave();



      console.log(`[Listra] Joining room: ${roomId}`);



      this.transport = new PeerTransport(false, {

        onClockMessage: (msg) => {

          this.listenerEngine?.handleClockMessage(msg);

        },

        onControlMessage: (msg) => {

          this.listenerEngine?.handleControlMessage(msg);

        },

        onConnected: () => {

          console.log('[Listra] Successfully connected to host!');

          Spicetify.showNotification('Connected! Synchronizing playback...');

        },

        onDisconnected: () => {

          console.log('[Listra] Disconnected from host.');

          this.leave();

        },

      });



      this.transport.initialize(roomId, [

        { urls: 'stun:stun.cloudflare.com:3478' },

        { urls: 'stun:stun.l.google.com:19302' },

      ]);



      this.listenerEngine = new ListenerEngine(this.clock, this.transport);

      this.ui.setSessionActive(roomId, false);

    } catch (err) {

      console.error('[Listra] Error joining room:', err);

    }

  }



  public leave(): void {

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

      console.error('[Listra] Error leaving session:', err);

    }

  }

}



// Wait for Spicetify APIs before initializing

(function initWhenReady() {

  if (!window.Spicetify || !Spicetify.Player || (!Spicetify.Topbar && !Spicetify.Playbar)) {

    setTimeout(initWhenReady, 300);

    return;

  }



  try {

    const app = new ListraApp();

    app.init();

  } catch (err) {

    console.error('[Listra] Uncaught init error:', err);

  }

})();


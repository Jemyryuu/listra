import {
  PROTOCOL_VERSION,
  ExtensionToDaemonMessage,
  DaemonToExtensionMessage,
} from '../../../shared/protocol';

export class DaemonBridge {
  private ws: WebSocket | null = null;
  private url = 'ws://127.0.0.1:8989';
  private token = 'listen-together-local-token';
  private isConnected = false;
  private reconnectTimer: number | null = null;
  private onJoinRequestHandler?: (roomId: string) => void;

  constructor(onJoinRequest?: (roomId: string) => void) {
    this.onJoinRequestHandler = onJoinRequest;
  }

  public connect(): void {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('[ListenTogether] Connected to companion daemon.');
        this.send({
          v: PROTOCOL_VERSION,
          type: 'hello',
          token: this.token,
          clientVersion: '1.0.0',
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as DaemonToExtensionMessage;
          if (msg.v === PROTOCOL_VERSION && msg.type === 'join.request') {
            if (this.onJoinRequestHandler) {
              this.onJoinRequestHandler(msg.roomId);
            }
          }
        } catch (err) {
          console.warn('[ListenTogether] Malformed daemon message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Ignored, onclose will trigger reconnect
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  public send(msg: ExtensionToDaemonMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public setPresence(
    roomId: string,
    trackName: string,
    artist: string,
    albumArtUrl: string,
    trackUri: string,
    durationMs: number,
    progressMs: number,
    isPlaying: boolean
  ): void {
    this.send({
      v: PROTOCOL_VERSION,
      type: 'presence.set',
      roomId,
      trackName,
      artist,
      albumArtUrl,
      trackUri,
      durationMs,
      progressMs,
      isPlaying,
    });
  }

  public clearPresence(): void {
    this.send({
      v: PROTOCOL_VERSION,
      type: 'presence.clear',
    });
  }

  public hasConnection(): boolean {
    return this.isConnected;
  }
}

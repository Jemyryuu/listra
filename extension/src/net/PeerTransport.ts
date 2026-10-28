import {
  ClockChannelMessage,
  ControlChannelMessage,
} from '../../../shared/protocol';

export interface PeerTransportCallbacks {
  onClockMessage: (msg: ClockChannelMessage) => void;
  onControlMessage: (msg: ControlChannelMessage) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

export class PeerTransport {
  private pc: RTCPeerConnection | null = null;
  private clockChannel: RTCDataChannel | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private callbacks: PeerTransportCallbacks;
  private isHost: boolean;

  constructor(isHost: boolean, callbacks: PeerTransportCallbacks) {
    this.isHost = isHost;
    this.callbacks = callbacks;
  }

  public initialize(iceServers: RTCIceServer[]): void {
    this.pc = new RTCPeerConnection({
      iceServers,
    });

    this.pc.oniceconnectionstatechange = () => {
      if (
        this.pc?.iceConnectionState === 'disconnected' ||
        this.pc?.iceConnectionState === 'failed' ||
        this.pc?.iceConnectionState === 'closed'
      ) {
        this.callbacks.onDisconnected();
      }
    };

    if (this.isHost) {
      this.clockChannel = this.pc.createDataChannel('clock', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupClockChannel(this.clockChannel);

      this.controlChannel = this.pc.createDataChannel('control', {
        ordered: true,
      });
      this.setupControlChannel(this.controlChannel);
    } else {
      this.pc.ondatachannel = (event) => {
        if (event.channel.label === 'clock') {
          this.clockChannel = event.channel;
          this.setupClockChannel(this.clockChannel);
        } else if (event.channel.label === 'control') {
          this.controlChannel = event.channel;
          this.setupControlChannel(this.controlChannel);
        }
      };
    }
  }

  private setupClockChannel(ch: RTCDataChannel): void {
    ch.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ClockChannelMessage;
        this.callbacks.onClockMessage(msg);
      } catch (err) {}
    };
  }

  private setupControlChannel(ch: RTCDataChannel): void {
    ch.onopen = () => {
      this.callbacks.onConnected();
    };

    ch.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ControlChannelMessage;
        this.callbacks.onControlMessage(msg);
      } catch (err) {}
    };

    ch.onclose = () => {
      this.callbacks.onDisconnected();
    };
  }

  public sendClock(msg: ClockChannelMessage): void {
    if (this.clockChannel && this.clockChannel.readyState === 'open') {
      this.clockChannel.send(JSON.stringify(msg));
    }
  }

  public sendControl(msg: ControlChannelMessage): void {
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      this.controlChannel.send(JSON.stringify(msg));
    }
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  public close(): void {
    this.clockChannel?.close();
    this.controlChannel?.close();
    this.pc?.close();
    this.clockChannel = null;
    this.controlChannel = null;
    this.pc = null;
  }
}

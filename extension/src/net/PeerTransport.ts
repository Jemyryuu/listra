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

type SignalingMessage =
  | { type: 'join' }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

export class PeerTransport {
  private pc: RTCPeerConnection | null = null;
  private clockChannel: RTCDataChannel | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private callbacks: PeerTransportCallbacks;
  private isHost: boolean;
  private signalingWs: WebSocket | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private roomId: string | null = null;
  private signalingUrl: string;

  constructor(
    isHost: boolean,
    callbacks: PeerTransportCallbacks,
    signalingUrl?: string
  ) {
    this.isHost = isHost;
    this.callbacks = callbacks;
    this.signalingUrl =
      signalingUrl ||
      (window as any).LISTRA_SIGNALING_URL ||
      'wss://listra-signaling.pages.dev';
  }

  public initialize(roomId: string, iceServers: RTCIceServer[]): void {
    this.roomId = roomId;
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.callbacks.onDisconnected();
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
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

    this.connectSignaling(roomId);
  }

  private connectSignaling(roomId: string): void {
    const wsUrl = `${this.signalingUrl.replace(/\/+$/, '')}/room/${roomId}`;
    try {
      this.signalingWs = new WebSocket(wsUrl);

      this.signalingWs.onopen = () => {
        console.log(`[Listra] Connected to signaling for room ${roomId}`);
        if (!this.isHost) {
          this.sendSignaling({ type: 'join' });
        }
      };

      this.signalingWs.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data) as SignalingMessage;
          await this.handleSignalingMessage(msg);
        } catch (err) {
          console.warn('[Listra] Error handling signaling message:', err);
        }
      };

      this.signalingWs.onerror = (err) => {
        console.warn('[Listra] Signaling WebSocket error:', err);
      };

      this.signalingWs.onclose = () => {
        console.log('[Listra] Signaling WebSocket closed.');
      };
    } catch (err) {
      console.warn('[Listra] Failed to connect signaling:', err);
    }
  }

  private sendSignaling(msg: SignalingMessage): void {
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(msg));
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    if (!this.pc) return;

    if (msg.type === 'join' && this.isHost) {
      console.log('[Listra] Peer joined signaling room, creating WebRTC offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const sdpData = this.pc.localDescription?.toJSON
        ? this.pc.localDescription.toJSON()
        : { type: this.pc.localDescription?.type, sdp: this.pc.localDescription?.sdp };
      this.sendSignaling({
        type: 'offer',
        sdp: sdpData as RTCSessionDescriptionInit,
      });
    } else if (msg.type === 'offer' && !this.isHost) {
      console.log('[Listra] Received WebRTC offer, creating answer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      await this.drainPendingCandidates();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      const sdpData = this.pc.localDescription?.toJSON
        ? this.pc.localDescription.toJSON()
        : { type: this.pc.localDescription?.type, sdp: this.pc.localDescription?.sdp };
      this.sendSignaling({
        type: 'answer',
        sdp: sdpData as RTCSessionDescriptionInit,
      });
    } else if (msg.type === 'answer' && this.isHost) {
      console.log('[Listra] Received WebRTC answer from peer.');
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      await this.drainPendingCandidates();
    } else if (msg.type === 'candidate') {
      if (this.pc.remoteDescription) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {}
      } else {
        this.pendingCandidates.push(msg.candidate);
      }
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {}
      }
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
    if (this.signalingWs) {
      try {
        this.signalingWs.close();
      } catch (e) {}
      this.signalingWs = null;
    }
    this.pendingCandidates = [];
    this.clockChannel?.close();
    this.controlChannel?.close();
    this.pc?.close();
    this.clockChannel = null;
    this.controlChannel = null;
    this.pc = null;
    this.roomId = null;
  }
}

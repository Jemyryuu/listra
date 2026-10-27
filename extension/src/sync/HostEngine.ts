import { ClockSync } from './ClockSync';
import { Scheduler } from './Scheduler';
import { PlayerAdapter, CurrentTrackInfo } from '../player/PlayerAdapter';
import { PeerTransport } from '../net/PeerTransport';
import { DaemonBridge } from '../net/DaemonBridge';
import { PROTOCOL_VERSION } from '../../../shared/protocol';

export class HostEngine {
  private clock: ClockSync;
  private scheduler: Scheduler;
  private transport: PeerTransport;
  private daemon: DaemonBridge;
  private roomId: string;
  private seq = 0;
  private heartbeatTimer: number | null = null;
  private clockPingTimer: number | null = null;
  private lastTrack: CurrentTrackInfo | null = null;

  constructor(
    roomId: string,
    clock: ClockSync,
    transport: PeerTransport,
    daemon: DaemonBridge
  ) {
    this.roomId = roomId;
    this.clock = clock;
    this.transport = transport;
    this.daemon = daemon;
    this.scheduler = new Scheduler(clock);
  }

  public start(): void {
    this.broadcastCurrentTrack();

    // Setup Spotify player change listeners
    PlayerAdapter.onSongChange(() => this.handleTrackChange());
    PlayerAdapter.onPlayPause(() => this.handlePlayPauseChange());

    // Send state heartbeats every 2.5s
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 2500);

    // Send clock sync pings every 2s
    this.clockPingTimer = window.setInterval(() => {
      this.transport.sendClock({
        v: PROTOCOL_VERSION,
        type: 'ping',
        t1: performance.now(),
      });
    }, 2000);
  }

  private handleTrackChange(): void {
    const track = PlayerAdapter.getCurrentTrack();
    if (!track) return;
    this.lastTrack = track;

    // Schedule play at future host time (300ms lead time)
    const leadMs = 300;
    const executeAt = this.clock.now() + leadMs;

    this.transport.sendControl({
      v: PROTOCOL_VERSION,
      type: 'schedule',
      seq: ++this.seq,
      action: 'load',
      uri: track.uri,
      positionMs: 0,
      executeAtHostTime: executeAt,
    });

    this.updateDiscordPresence(track);
  }

  private handlePlayPauseChange(): void {
    const isPlaying = PlayerAdapter.isPlaying();
    const pos = PlayerAdapter.getProgressMs();
    const leadMs = 200;
    const executeAt = this.clock.now() + leadMs;

    this.transport.sendControl({
      v: PROTOCOL_VERSION,
      type: 'schedule',
      seq: ++this.seq,
      action: isPlaying ? 'play' : 'pause',
      positionMs: pos,
      executeAtHostTime: executeAt,
    });

    const track = PlayerAdapter.getCurrentTrack();
    if (track) {
      this.updateDiscordPresence(track);
    }
  }

  public sendHeartbeat(): void {
    const track = PlayerAdapter.getCurrentTrack();
    if (!track) return;

    this.transport.sendControl({
      v: PROTOCOL_VERSION,
      type: 'state',
      seq: ++this.seq,
      uri: track.uri,
      positionMs: track.progressMs,
      atHostTime: this.clock.now(),
      isPlaying: track.isPlaying,
    });
  }

  private updateDiscordPresence(track: CurrentTrackInfo): void {
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

  public broadcastCurrentTrack(): void {
    const track = PlayerAdapter.getCurrentTrack();
    if (track) {
      this.lastTrack = track;
      this.updateDiscordPresence(track);
      this.sendHeartbeat();
    }
  }

  public stop(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    if (this.clockPingTimer !== null) clearInterval(this.clockPingTimer);
    this.daemon.clearPresence();
  }
}

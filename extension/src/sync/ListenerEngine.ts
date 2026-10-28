import { ClockSync } from './ClockSync';
import { Scheduler } from './Scheduler';
import { DriftController } from './DriftController';
import { PlayerAdapter } from '../player/PlayerAdapter';
import { PeerTransport } from '../net/PeerTransport';
import {
  PROTOCOL_VERSION,
  ControlChannelMessage,
  ClockChannelMessage,
} from '../../../shared/protocol';

export class ListenerEngine {
  private clock: ClockSync;
  private scheduler: Scheduler;
  private driftController: DriftController;
  private transport: PeerTransport;
  private currentUri: string | null = null;

  constructor(clock: ClockSync, transport: PeerTransport) {
    this.clock = clock;
    this.transport = transport;
    this.scheduler = new Scheduler(clock);
    this.driftController = new DriftController(clock);
  }

  public handleClockMessage(msg: ClockChannelMessage): void {
    if (msg.type === 'ping') {
      const now = performance.now();
      this.transport.sendClock({
        v: PROTOCOL_VERSION,
        type: 'pong',
        t1: msg.t1,
        t2: now,
        t3: performance.now(),
      });
    } else if (msg.type === 'pong') {
      const t4 = performance.now();
      this.clock.recordSample(msg.t1, msg.t2, msg.t3, t4);
    }
  }

  public async handleControlMessage(msg: ControlChannelMessage): Promise<void> {
    switch (msg.type) {
      case 'schedule':
        await this.handleSchedule(msg);
        break;
      case 'state':
        this.handleStateHeartbeat(msg);
        break;
      case 'prefetch':
        PlayerAdapter.prefetchNext(msg.uri);
        break;
    }
  }

  private async handleSchedule(msg: {
    action: 'play' | 'pause' | 'seek' | 'load';
    uri?: string;
    positionMs?: number;
    executeAtHostTime: number;
    seq: number;
  }): Promise<void> {
    if (msg.action === 'load' && msg.uri) {
      this.currentUri = msg.uri;
      // Pre-seek while paused to prime Spotify audio pipeline
      await PlayerAdapter.pause();
      await PlayerAdapter.playUri(msg.uri);
      if (msg.positionMs !== undefined) {
        PlayerAdapter.seek(msg.positionMs);
      }
      await PlayerAdapter.pause();

      this.scheduler.executeAt(msg.executeAtHostTime, () => {
        PlayerAdapter.play();
      });
    } else if (msg.action === 'play') {
      this.scheduler.executeAt(msg.executeAtHostTime, () => {
        if (msg.positionMs !== undefined) {
          PlayerAdapter.seek(msg.positionMs);
        }
        PlayerAdapter.play();
      });
    } else if (msg.action === 'pause') {
      this.scheduler.executeAt(msg.executeAtHostTime, () => {
        PlayerAdapter.pause();
        if (msg.positionMs !== undefined) {
          PlayerAdapter.seek(msg.positionMs);
        }
      });
    } else if (msg.action === 'seek' && msg.positionMs !== undefined) {
      this.scheduler.executeAt(msg.executeAtHostTime, () => {
        PlayerAdapter.seek(msg.positionMs!);
      });
    }
  }

  private handleStateHeartbeat(msg: {
    uri: string;
    positionMs: number;
    atHostTime: number;
    isPlaying: boolean;
  }): void {
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
}

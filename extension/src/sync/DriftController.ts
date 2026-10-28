import { ClockSync } from './ClockSync';
import { PlayerAdapter } from '../player/PlayerAdapter';

export class DriftController {
  private clock: ClockSync;
  private moderateDriftCount = 0;
  private readonly maxModerateDriftStrikes = 3;

  constructor(clock: ClockSync) {
    this.clock = clock;
  }

  public evaluateHeartbeat(
    hostPositionMs: number,
    hostSentAtMasterTime: number,
    isPlaying: boolean,
    onResyncNeeded: (targetPositionMs: number) => void
  ): { deltaMs: number; status: 'in-sync' | 'nudge' | 'hard-resync' } {
    if (!isPlaying || !PlayerAdapter.isPlaying()) {
      return { deltaMs: 0, status: 'in-sync' };
    }

    const elapsedMasterMs = this.clock.now() - hostSentAtMasterTime;
    const expectedPositionMs = hostPositionMs + elapsedMasterMs;
    const localPositionMs = PlayerAdapter.getProgressMs();

    const deltaMs = Math.abs(localPositionMs - expectedPositionMs);

    if (deltaMs < 30) {
      this.moderateDriftCount = 0;
      return { deltaMs, status: 'in-sync' };
    }

    if (deltaMs <= 150) {
      this.moderateDriftCount++;
      if (this.moderateDriftCount >= this.maxModerateDriftStrikes) {
        this.moderateDriftCount = 0;
        onResyncNeeded(expectedPositionMs);
        return { deltaMs, status: 'nudge' };
      }
      return { deltaMs, status: 'in-sync' };
    }
    this.moderateDriftCount = 0;
    onResyncNeeded(expectedPositionMs);
    return { deltaMs, status: 'hard-resync' };
  }
}

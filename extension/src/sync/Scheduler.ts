import { ClockSync } from './ClockSync';

export class Scheduler {
  private clock: ClockSync;
  private pendingTimer: number | null = null;
  private audioPipelineLeadMs = 25; // Compensates for internal audio buffer delay

  constructor(clock: ClockSync) {
    this.clock = clock;
  }

  public setAudioPipelineLead(ms: number): void {
    this.audioPipelineLeadMs = Math.max(0, ms);
  }

  public executeAt(targetHostTime: number, callback: () => void): void {
    this.cancel();

    const adjustedTarget = targetHostTime - this.audioPipelineLeadMs;

    const checkTime = () => {
      const remaining = adjustedTarget - this.clock.now();

      if (remaining <= 0) {
        this.pendingTimer = null;
        callback();
      } else if (remaining <= 15) {
        // High-precision spin loop for the final 15ms window
        while (adjustedTarget - this.clock.now() > 0.5) {}
        this.pendingTimer = null;
        callback();
      } else {
        this.pendingTimer = window.setTimeout(checkTime, remaining - 10);
      }
    };

    checkTime();
  }

  public cancel(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }
}

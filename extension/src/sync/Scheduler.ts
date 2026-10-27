import { ClockSync } from './ClockSync';

export class Scheduler {
  private clock: ClockSync;
  private pendingTimer: number | null = null;
  private audioPipelineLeadMs = 25; // Compensate for internal audio buffer delay

  constructor(clock: ClockSync) {
    this.clock = clock;
  }

  public setAudioPipelineLead(ms: number): void {
    this.audioPipelineLeadMs = Math.max(0, ms);
  }

  /**
   * Executes a callback when the virtual master clock reaches targetHostTime.
   */
  public executeAt(targetHostTime: number, callback: () => void): void {
    this.cancel();

    // Adjust target by audio pipeline lead time so sound emits on the beat
    const adjustedTarget = targetHostTime - this.audioPipelineLeadMs;

    const checkTime = () => {
      const remaining = adjustedTarget - this.clock.now();

      if (remaining <= 0) {
        this.pendingTimer = null;
        callback();
      } else if (remaining <= 15) {
        // High-precision spin loop for the final 15ms
        // Busy wait with setImmediate or microtask yield
        while (adjustedTarget - this.clock.now() > 0.5) {
          // busy wait loop
        }
        this.pendingTimer = null;
        callback();
      } else {
        // Coarse wait
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

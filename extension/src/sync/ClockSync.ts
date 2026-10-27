interface ClockSample {
  rtt: number;
  offset: number;
  timestamp: number;
}

export class ClockSync {
  private samples: ClockSample[] = [];
  private readonly maxSamples = 16;
  private currentOffset = 0;
  private bestRtt = Infinity;

  /**
   * Records a round-trip ping/pong sample.
   * t1: Time ping was sent from local peer
   * t2: Time ping was received on remote peer
   * t3: Time pong was sent from remote peer
   * t4: Time pong was received back on local peer
   */
  public recordSample(t1: number, t2: number, t3: number, t4: number): void {
    const rtt = (t4 - t1) - (t3 - t2);
    if (rtt < 0) return; // Negative RTT indicates corrupted sample

    const offset = ((t2 - t1) + (t3 - t4)) / 2;

    this.samples.push({ rtt, offset, timestamp: t4 });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.recomputeOffset();
  }

  private recomputeOffset(): void {
    if (this.samples.length === 0) return;

    // Sort by RTT ascending to prioritize samples with lowest network delay
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    this.bestRtt = sorted[0].rtt;

    // Average the offsets of the top 3 lowest-RTT samples
    const topCount = Math.min(3, sorted.length);
    let offsetSum = 0;
    for (let i = 0; i < topCount; i++) {
      offsetSum += sorted[i].offset;
    }

    this.currentOffset = offsetSum / topCount;
  }

  /**
   * Returns current monotonic master time aligned with the host.
   */
  public now(): number {
    return performance.now() + this.currentOffset;
  }

  public getOffset(): number {
    return this.currentOffset;
  }

  public getBestRtt(): number {
    return this.bestRtt;
  }

  public getConfidenceMs(): number {
    return this.bestRtt === Infinity ? 50 : this.bestRtt / 2;
  }
}

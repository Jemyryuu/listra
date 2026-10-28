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

  public recordSample(t1: number, t2: number, t3: number, t4: number): void {
    const rtt = (t4 - t1) - (t3 - t2);
    if (rtt < 0) return;

    const offset = ((t2 - t1) + (t3 - t4)) / 2;

    this.samples.push({ rtt, offset, timestamp: t4 });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.recomputeOffset();
  }

  private recomputeOffset(): void {
    if (this.samples.length === 0) return;

    // Prioritize samples with the lowest network delay
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    this.bestRtt = sorted[0].rtt;

    const topCount = Math.min(3, sorted.length);
    let offsetSum = 0;
    for (let i = 0; i < topCount; i++) {
      offsetSum += sorted[i].offset;
    }

    this.currentOffset = offsetSum / topCount;
  }

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

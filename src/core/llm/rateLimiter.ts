export interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

export class RateLimiter {
  private readonly requestTimestamps: number[] = [];
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly config: RateLimiterConfig) {
    this.clock = config.clock ?? Date.now;
    this.sleep = config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  acquire(): Promise<void> {
    const next = this.queue.then(() => this.acquireInternal());
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async acquireInternal(): Promise<void> {
    while (true) {
      const now = this.clock();
      this.prune(now);

      const minuteCount = this.countWithinWindow(now, MINUTE_WINDOW_MS);
      const dayCount = this.requestTimestamps.length;
      const dayLimit = this.config.requestsPerDay;

      if (
        minuteCount < this.config.requestsPerMinute &&
        (typeof dayLimit !== 'number' || dayCount < dayLimit)
      ) {
        this.requestTimestamps.push(now);
        return;
      }

      const waits: number[] = [];

      if (minuteCount >= this.config.requestsPerMinute) {
        const minuteIndex = this.requestTimestamps.length - this.config.requestsPerMinute;
        waits.push(this.requestTimestamps[minuteIndex] + MINUTE_WINDOW_MS - now);
      }

      if (typeof dayLimit === 'number' && dayCount >= dayLimit) {
        const dayIndex = this.requestTimestamps.length - dayLimit;
        waits.push(this.requestTimestamps[dayIndex] + DAY_WINDOW_MS - now);
      }

      const waitMs = Math.max(0, ...waits);
      await this.sleep(waitMs);
    }
  }

  private prune(now: number): void {
    const cutoff = now - DAY_WINDOW_MS;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] <= cutoff) {
      this.requestTimestamps.shift();
    }
  }

  private countWithinWindow(now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    let count = 0;
    for (const timestamp of this.requestTimestamps) {
      if (timestamp > cutoff) {
        count += 1;
      }
    }
    return count;
  }
}

const { setTimeout: sleep } = require('node:timers/promises');

// Riot counts windows on their side, so wait a little longer than strictly necessary.
const SAFETY_MARGIN_MS = 75;

/**
 * Parses Riot's rate limit format, e.g. "20:1,100:120" = 20 requests per second and 100 requests
 * per two minutes.
 */
const parseLimits = (spec) =>
  String(spec)
    .split(',')
    .map((pair) => pair.trim().split(':').map(Number))
    .filter(([count, seconds]) => count > 0 && seconds > 0)
    .map(([count, seconds]) => ({ count, windowMs: seconds * 1000 }));

// Index of the first timestamp greater than `value` (timestamps are sorted ascending).
const upperBound = (timestamps, value) => {
  let low = 0;
  let high = timestamps.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (timestamps[mid] <= value) low = mid + 1;
    else high = mid;
  }
  return low;
};

/**
 * Sliding-window rate limiter. Callers `await acquire()` before each request and are served in
 * FIFO order. Limits start at development-key values and are replaced by whatever Riot reports in
 * the X-App-Rate-Limit header, so the same code works for dev, personal and production keys.
 */
class RateLimiter {
  constructor(spec = '20:1,100:120') {
    this.spec = '';
    this.limits = [];
    this.timestamps = [];
    this.blockedUntil = 0;
    this.queue = Promise.resolve();
    this.setLimits(spec);
  }

  setLimits(spec) {
    if (!spec || spec === this.spec) return;
    const limits = parseLimits(spec);
    if (limits.length === 0) return;
    this.spec = spec;
    this.limits = limits;
  }

  pause(ms) {
    this.blockedUntil = Math.max(this.blockedUntil, Date.now() + ms);
  }

  acquire() {
    const turn = this.queue.then(() => this.waitForSlot());
    this.queue = turn.catch(() => {});
    return turn;
  }

  msUntilSlot(now) {
    let waitMs = this.blockedUntil - now;
    for (const { count, windowMs } of this.limits) {
      const firstInWindow = upperBound(this.timestamps, now - windowMs);
      const used = this.timestamps.length - firstInWindow;
      if (used >= count) {
        // The request that has to leave the window before another one fits.
        const oldestBlocking = this.timestamps[this.timestamps.length - count];
        waitMs = Math.max(waitMs, oldestBlocking + windowMs - now + SAFETY_MARGIN_MS);
      }
    }
    return waitMs;
  }

  async waitForSlot() {
    for (;;) {
      const now = Date.now();
      const waitMs = this.msUntilSlot(now);
      if (waitMs <= 0) {
        this.record(now);
        return;
      }
      await sleep(waitMs);
    }
  }

  record(now) {
    this.timestamps.push(now);
    const longestWindow = Math.max(...this.limits.map((limit) => limit.windowMs));
    const expired = upperBound(this.timestamps, now - longestWindow);
    if (expired > 0) this.timestamps.splice(0, expired);
  }
}

module.exports = { RateLimiter, parseLimits };

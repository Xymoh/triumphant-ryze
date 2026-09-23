/**
 * Small in-memory TTL cache. `wrap` also de-duplicates concurrent loads of the same key, so ten
 * people pressing "Refresh" at once still results in a single Riot API request per player.
 */
class TtlCache {
  constructor({ maxEntries = 10_000 } = {}) {
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (this.entries.size > this.maxEntries) this.prune();
  }

  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  wrap(key, ttlMs, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const promise = Promise.resolve().then(loader);
    this.set(key, promise, ttlMs);
    // Never cache failures: the next caller should retry.
    promise.catch(() => {
      if (this.entries.get(key)?.value === promise) this.entries.delete(key);
    });
    return promise;
  }

  prune() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    // Still too big: drop the oldest entries (Map keeps insertion order).
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}

module.exports = { TtlCache };

export const CACHE_TTL_MS = 60000;
export class RevisionCache {
  #entries = new Map();
  constructor({ now = Date.now, delay = setTimeout, cancel = clearTimeout, ttl = CACHE_TTL_MS, maxEntries = 32, maxPerScope = 4 } = {}) {
    if (![ttl, maxEntries, maxPerScope].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("Limite de memória inválido.");
    Object.assign(this, { now, delay, cancel, ttl, maxEntries, maxPerScope });
  }
  #remove(key) { const entry = this.#entries.get(key); if (entry) this.cancel(entry.timer); this.#entries.delete(key); }
  get(scope, fingerprint) {
    const key = JSON.stringify([scope, fingerprint]), entry = this.#entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) { this.#remove(key); return null; }
    this.#entries.delete(key); this.#entries.set(key, entry);
    return entry.suggestion;
  }
  set(scope, fingerprint, suggestion, metadata) {
    if (typeof suggestion !== "string" || !suggestion.trim() || suggestion.length > 32000) return;
    const key = JSON.stringify([scope, fingerprint]); this.#remove(key);
    for (const [oldKey, entry] of this.#entries) if (entry.expiresAt <= this.now()) this.#remove(oldKey);
    while ([...this.#entries.values()].filter(entry => entry.scope === scope).length >= this.maxPerScope) {
      const oldest = [...this.#entries].find(([, entry]) => entry.scope === scope); this.#remove(oldest[0]);
    }
    while (this.#entries.size >= this.maxEntries) this.#remove(this.#entries.keys().next().value);
    const entry = { scope, suggestion, tabId: metadata.tabId, origin: metadata.origin, expiresAt: this.now() + this.ttl };
    entry.timer = this.delay(() => this.#remove(key), this.ttl); entry.timer?.unref?.();
    this.#entries.set(key, entry);
  }
  clearOrigin(origin) { for (const [key, entry] of this.#entries) if (entry.origin === origin) this.#remove(key); }
  clearTab(tabId) { for (const [key, entry] of this.#entries) if (entry.tabId === tabId) this.#remove(key); }
  clear() { for (const key of this.#entries.keys()) this.#remove(key); }
}
export async function revisionFingerprint(values) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(values)));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

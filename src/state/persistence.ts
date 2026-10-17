import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage wrapped in try/catch: storage can be missing, full, or blocked
 * (private windows, disabled site data). Failures fall back to memory.
 */
export function createSafeStorage(getStorage: () => Storage | undefined = () => globalThis.localStorage): StateStorage {
  const memory = new Map<string, string>();
  return {
    getItem(name) {
      try {
        const v = getStorage()?.getItem(name);
        if (v != null) return v;
      } catch {
        /* fall through to memory */
      }
      return memory.get(name) ?? null;
    },
    setItem(name, value) {
      memory.set(name, value);
      try {
        getStorage()?.setItem(name, value);
      } catch {
        /* keep the in-memory copy */
      }
    },
    removeItem(name) {
      memory.delete(name);
      try {
        getStorage()?.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

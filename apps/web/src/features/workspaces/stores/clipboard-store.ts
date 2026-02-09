import { useSyncExternalStore } from "react";

/**
 * Lightweight module-level flag that tracks whether the last in-app clipboard
 * operation was a "cut" (move).  The actual file paths live entirely in the
 * **system clipboard** (CF_HDROP) so copy/paste interoperates with Windows
 * Explorer seamlessly.
 *
 * When the user copies files externally (e.g. in Explorer) and pastes in the
 * app, `isCutMode` will be `false` and we simply copy the files.
 */

// ─── Module-level singleton ─────────────────────────────────────────────────

let _isCutMode = false;
const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((fn) => fn());
}

// ─── Public API (usable outside React too) ──────────────────────────────────

/** Mark the current clipboard operation as a "cut" (move on paste). */
export function markCutMode(): void {
  _isCutMode = true;
  _emit();
}

/** Clear cut-mode (e.g. after paste completes, or after a new copy). */
export function clearCutMode(): void {
  _isCutMode = false;
  _emit();
}

/** Read the current cut-mode flag (non-reactive). */
export function isCutMode(): boolean {
  return _isCutMode;
}

// ─── React hook ─────────────────────────────────────────────────────────────

function subscribe(listener: () => void) {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function getSnapshot() {
  return _isCutMode;
}

/** Reactive hook — re-renders only when the cut-mode flag changes. */
export function useIsCutMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

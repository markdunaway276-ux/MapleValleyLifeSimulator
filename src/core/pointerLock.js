/**
 * Safe wrappers for the browser Pointer Lock API.
 *
 * Modern Chromium returns a Promise from requestPointerLock() that rejects if
 * the user just pressed Esc or switched tabs; older browsers may throw
 * synchronously. Both paths are caught so callers never trigger unhandled
 * rejections.
 */
export function requestPointerLock(canvas) {
  if (!canvas || typeof canvas.requestPointerLock !== 'function') return false;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export function exitPointerLock(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || typeof doc.exitPointerLock !== 'function') return false;
  if ('pointerLockElement' in doc && !doc.pointerLockElement) return false;
  try {
    const result = doc.exitPointerLock();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

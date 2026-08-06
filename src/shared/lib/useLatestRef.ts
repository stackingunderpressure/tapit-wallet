import { useRef } from 'react';

/**
 * A ref kept in sync with `value` on every render (not just once).
 * For a closure built earlier (e.g. inside an effect that only reruns
 * on a narrower dependency list) that must still call whatever the
 * latest version of a prop/hook-derived function is when it actually
 * fires, rather than the stale version captured when the closure was
 * created.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

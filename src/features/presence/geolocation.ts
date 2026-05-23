// Tiny Promise wrapper around navigator.geolocation. Resolves with
// the fields the Tier V envelope cares about, rejects with a friendly
// error string. requestFreshLocation always asks for a current
// reading (enableHighAccuracy + maximumAge:0) so a Tier V event is
// not derived from a stale cached position.

export interface FreshLocation {
  latitude: number;
  longitude: number;
  /** Accuracy in metres reported by the browser. */
  accuracyMeters: number;
  /** ISO timestamp of the GPS fix, taken from the platform's reading. */
  fixedAt: string;
}

export function geolocationSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.geolocation?.getCurrentPosition === 'function'
  );
}

export async function requestFreshLocation(): Promise<FreshLocation> {
  if (!geolocationSupported()) {
    throw new Error('Geolocation is not supported on this browser');
  }
  return new Promise<FreshLocation>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          fixedAt: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => {
        // GeolocationPositionError codes:
        //   1 = PERMISSION_DENIED
        //   2 = POSITION_UNAVAILABLE
        //   3 = TIMEOUT
        const message =
          err.code === 1
            ? 'Location permission denied — Tier V needs a real reading.'
            : err.code === 2
              ? 'Location unavailable right now — try again outdoors.'
              : err.code === 3
                ? 'Location request timed out — try again.'
                : err.message || 'Could not get a location reading.';
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      },
    );
  });
}

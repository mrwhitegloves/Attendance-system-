'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/**
 * The phone's position and a readable address (OpenStreetMap, as in the first version).
 * status: 'finding' | 'ok' | 'denied' | 'unavailable' | 'unsupported'. `retry()` asks again
 * (the browser shows its permission prompt again when the person has not blocked it for good).
 */
export function useLocation() {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => 'geolocation' in navigator,
    () => true,
  );
  const [state, setState] = useState({
    status: 'finding',
    coords: null,
    address: 'Finding your location…',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const point = { lat: coords.latitude, lon: coords.longitude };
        if (cancelled) return;
        setState({
          status: 'ok',
          coords: point,
          address: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`,
        });
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lon}`,
          );
          const data = await response.json();
          if (!cancelled && data.display_name)
            setState({ status: 'ok', coords: point, address: data.display_name });
        } catch {
          // The coordinates stay as the address.
        }
      },
      (failure) => {
        if (cancelled) return;
        setState(
          failure.code === 1
            ? { status: 'denied', coords: null, address: 'Location permission is off' }
            : { status: 'unavailable', coords: null, address: 'Your location could not be found' },
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    return () => {
      cancelled = true;
    };
  }, [supported, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'finding', coords: null, address: 'Finding your location…' });
    setAttempt((value) => value + 1);
  }, []);

  if (!supported) {
    return {
      status: 'unsupported',
      coords: null,
      address: 'Location is not available on this device',
      retry,
    };
  }
  return { ...state, retry };
}

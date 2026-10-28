'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/** The phone's position and a readable address (OpenStreetMap, as in the first version). */
export function useLocation() {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => 'geolocation' in navigator,
    () => true,
  );
  const [state, setState] = useState({ coords: null, address: 'Finding your location…' });
  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const point = { lat: coords.latitude, lon: coords.longitude };
        if (cancelled) return;
        setState({ coords: point, address: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` });
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lon}`,
          );
          const data = await response.json();
          if (!cancelled && data.display_name)
            setState({ coords: point, address: data.display_name });
        } catch {
          // The coordinates stay as the address.
        }
      },
      () => !cancelled && setState({ coords: null, address: 'Location permission denied' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    return () => {
      cancelled = true;
    };
  }, [supported]);
  return supported ? state : { coords: null, address: 'Location not available on this device' };
}

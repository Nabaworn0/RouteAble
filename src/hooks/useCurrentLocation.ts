import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '../data/access-points';

export type LocationState = 'requesting' | 'ready' | 'denied' | 'unavailable';

export function useCurrentLocation() {
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const [state, setState] = useState<LocationState>('requesting');
  const [position, setPosition] = useState<Coordinates | null>(null);

  const start = useCallback(async () => {
    await Promise.resolve();
    setState('requesting');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setState('denied');
        return;
      }

      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPosition({ latitude: first.coords.latitude, longitude: first.coords.longitude });
      setState('ready');

      watchRef.current?.remove();
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 4000 },
        ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }),
      );
    } catch {
      setState('unavailable');
    }
  }, []);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      void start();
    }, 0);
    return () => {
      clearTimeout(startTimer);
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [start]);

  return { position, state, retry: start };
}

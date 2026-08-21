import { useCallback, useState } from 'react';
import type { Coordinates } from '../lib/geo';

/**
 * Géolocalisation UNIQUEMENT à la demande : le navigateur n'est interrogé
 * qu'après une action explicite (bouton « Autour de moi »). La position n'est
 * jamais persistée ni envoyée à un serveur — elle sert au tri/filtrage local.
 */
interface GeolocationState {
  coordinates: Coordinates | null;
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable';
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    status: 'idle',
  });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ coordinates: null, status: 'unavailable' });
      return;
    }
    setState(s => ({ ...s, status: 'loading' }));
    navigator.geolocation.getCurrentPosition(
      pos => {
        setState({
          coordinates: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
          status: 'granted',
        });
      },
      () => setState({ coordinates: null, status: 'denied' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  return { ...state, request };
}

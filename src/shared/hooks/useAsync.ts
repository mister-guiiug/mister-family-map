import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Chargement asynchrone minimal avec états vide/chargement/erreur explicites
 * et protection contre les mises à jour après démontage.
 *
 * `key` identifie la requête : quand elle change (ex. l'id de la fiche), la
 * donnée est rechargée. La fonction est lue via une ref — pas besoin de la
 * mémoïser côté appelant.
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, key: string): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      result => {
        if (generation.current !== current) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (generation.current !== current) return;
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
        setLoading(false);
      }
    );
    return () => {
      generation.current++;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);

  return { data, loading, error, reload };
}

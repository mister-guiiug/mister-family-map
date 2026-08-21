import { createContext, useContext, type ReactNode } from 'react';
import type { Backend } from '../../shared/api/ports';

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({
  backend,
  children,
}: {
  backend: Backend;
  children: ReactNode;
}) {
  return (
    <BackendContext.Provider value={backend}>
      {children}
    </BackendContext.Provider>
  );
}

/** Accès aux ports depuis les features — jamais d'import direct d'un adaptateur. */
export function useBackend(): Backend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error('useBackend hors de <BackendProvider>');
  return backend;
}

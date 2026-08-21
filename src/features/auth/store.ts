import { create } from 'zustand';
import type { AuthSession, Role } from '../../entities/user/model';
import type { AuthService } from '../../shared/api/ports';

/**
 * État de session côté client — pour l'UX uniquement (affichage/masquage).
 * L'autorité reste le serveur : chaque action sensible est re-vérifiée par
 * les adaptateurs (RLS côté Supabase, contrôles dans le backend local).
 */
interface AuthState {
  session: AuthSession | null;
  initialized: boolean;
  init: (auth: AuthService) => Promise<void>;
  setSession: (session: AuthSession | null) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  initialized: false,
  async init(auth) {
    const session = await auth.getSession();
    set({ session, initialized: true });
    auth.onSessionChange(s => set({ session: s }));
  },
  setSession(session) {
    set({ session });
  },
}));

export function useCurrentRole(): Role {
  const session = useAuthStore(s => s.session);
  return session?.profile.role ?? 'visitor';
}

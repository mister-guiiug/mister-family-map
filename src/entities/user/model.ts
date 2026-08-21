import { z } from 'zod';

/** Rôles applicatifs, du moins au plus privilégié. */
export const ROLES = ['visitor', 'member', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  visitor: 'Visiteur',
  member: 'Membre',
  moderator: 'Modérateur',
  admin: 'Administrateur',
};

/**
 * Profil public d'un compte. Volontairement minimal : AUCUNE donnée nominative
 * sur les enfants, pas de position ; le pseudonyme suffit à l'attribution.
 */
export const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(2).max(40),
  role: z.enum(ROLES),
  createdAt: z.iso.datetime({ offset: true }),
});

export type Profile = z.infer<typeof profileSchema>;

/** Session côté client. `null` = visiteur non connecté. */
export interface AuthSession {
  userId: string;
  profile: Profile;
}

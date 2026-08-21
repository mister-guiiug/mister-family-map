import type { Role } from './model';

/**
 * Permissions MÉTIER, indépendantes du backend. Le serveur (RLS + fonctions)
 * reste la seule autorité ; cette table sert l'UX (masquer ce qui est interdit)
 * et les règles de domaine testables.
 *
 * Principe du moindre privilège : un membre ne modifie QUE ses propres
 * contributions ; toute modification d'un contenu d'autrui passe par une
 * proposition (place_revisions) ou par la modération.
 */
export type Action =
  | 'place.view.published'
  | 'place.create'
  | 'place.suggestEdit'
  | 'place.editOwn'
  | 'review.create'
  | 'review.editOwn'
  | 'event.create'
  | 'event.editOwn'
  | 'photo.upload'
  | 'favorite.manage'
  | 'report.create'
  | 'moderation.review'
  | 'moderation.history'
  | 'category.manage'
  | 'role.manage'
  | 'settings.manage'
  | 'auditLog.read';

const MEMBER_ACTIONS: readonly Action[] = [
  'place.view.published',
  'place.create',
  'place.suggestEdit',
  'place.editOwn',
  'review.create',
  'review.editOwn',
  'event.create',
  'event.editOwn',
  'photo.upload',
  'favorite.manage',
  'report.create',
];

const MODERATOR_ACTIONS: readonly Action[] = [
  ...MEMBER_ACTIONS,
  'moderation.review',
  'moderation.history',
];

const ADMIN_ACTIONS: readonly Action[] = [
  ...MODERATOR_ACTIONS,
  'category.manage',
  'role.manage',
  'settings.manage',
  'auditLog.read',
];

const GRANTS: Record<Role, readonly Action[]> = {
  visitor: ['place.view.published'],
  member: MEMBER_ACTIONS,
  moderator: MODERATOR_ACTIONS,
  admin: ADMIN_ACTIONS,
};

export function can(role: Role, action: Action): boolean {
  return GRANTS[role].includes(action);
}

/**
 * Un contenu appartenant à `ownerId` est-il modifiable par `userId` (rôle
 * `role`) ? Un modérateur/admin agit via la modération, PAS par édition
 * directe silencieuse — d'où le refus ici même pour ces rôles.
 */
export function canEditOwnContent(
  role: Role,
  userId: string | null,
  ownerId: string
): boolean {
  if (userId === null) return false;
  if (userId !== ownerId) return false;
  return can(role, 'place.editOwn');
}

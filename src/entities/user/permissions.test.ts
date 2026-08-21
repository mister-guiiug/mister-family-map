import { describe, expect, it } from 'vitest';
import { can, canEditOwnContent } from './permissions';

describe('can (permissions par rôle)', () => {
  it('le visiteur consulte mais ne contribue pas', () => {
    expect(can('visitor', 'place.view.published')).toBe(true);
    expect(can('visitor', 'place.create')).toBe(false);
    expect(can('visitor', 'favorite.manage')).toBe(false);
  });

  it('le membre contribue mais ne modère pas', () => {
    expect(can('member', 'place.create')).toBe(true);
    expect(can('member', 'report.create')).toBe(true);
    expect(can('member', 'moderation.review')).toBe(false);
    expect(can('member', 'category.manage')).toBe(false);
  });

  it('le modérateur modère mais n’administre pas', () => {
    expect(can('moderator', 'moderation.review')).toBe(true);
    expect(can('moderator', 'moderation.history')).toBe(true);
    expect(can('moderator', 'role.manage')).toBe(false);
  });

  it('l’administrateur gère catégories, rôles et journaux', () => {
    expect(can('admin', 'category.manage')).toBe(true);
    expect(can('admin', 'role.manage')).toBe(true);
    expect(can('admin', 'auditLog.read')).toBe(true);
  });
});

describe('canEditOwnContent (moindre privilège)', () => {
  it('un membre modifie SES contributions', () => {
    expect(canEditOwnContent('member', 'u1', 'u1')).toBe(true);
  });

  it('un membre ne modifie jamais celles d’autrui', () => {
    expect(canEditOwnContent('member', 'u1', 'u2')).toBe(false);
  });

  it('même un modérateur ne modifie pas directement le contenu d’autrui', () => {
    expect(canEditOwnContent('moderator', 'mod1', 'u2')).toBe(false);
  });

  it('non connecté → refus', () => {
    expect(canEditOwnContent('member', null, 'u1')).toBe(false);
  });
});

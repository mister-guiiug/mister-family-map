import { z } from 'zod';

/** Types de contenus signalables. */
export const REPORT_TARGETS = ['place', 'event', 'review', 'photo'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  'incorrect',
  'duplicate',
  'inappropriate',
  'closed',
  'privacy',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  incorrect: 'Information incorrecte',
  duplicate: 'Doublon',
  inappropriate: 'Contenu inapproprié',
  closed: 'Lieu fermé / événement annulé',
  privacy: 'Donnée personnelle à retirer',
  other: 'Autre',
};

export const reportSchema = z.object({
  id: z.string().min(1),
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).default(''),
  reporterId: z.string().min(1),
  status: z.enum(['open', 'resolved', 'dismissed']),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Report = z.infer<typeof reportSchema>;

/** Décisions possibles d'un modérateur (journalisées — moderation_actions). */
export const MODERATION_DECISIONS = [
  'approve',
  'hide',
  'reject',
  'mark-duplicate',
  'fix-category',
  'dismiss-report',
] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

export const moderationActionSchema = z.object({
  id: z.string().min(1),
  moderatorId: z.string().min(1),
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().min(1),
  decision: z.enum(MODERATION_DECISIONS),
  reason: z.string().max(1000).default(''),
  relatedReportId: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type ModerationAction = z.infer<typeof moderationActionSchema>;

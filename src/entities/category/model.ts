import { z } from 'zod';

/**
 * Catégorie d'activité — donnée de CONFIGURATION (table `categories`),
 * jamais codée en dur dans les composants. Les catégories initiales vivent
 * dans shared/constants/default-categories.ts (seed) et sont administrables.
 */
export const categorySchema = z.object({
  id: z.string().min(1),
  /** Identifiant stable lisible (`parc`, `aire-de-jeux`…), unique. */
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  label: z.string().min(1).max(80),
  /** Nom d'icône lucide-react (résolu dynamiquement, repli générique). */
  icon: z.string().min(1).max(64),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});

export type Category = z.infer<typeof categorySchema>;

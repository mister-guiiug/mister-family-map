/**
 * Limitation de débit CÔTÉ CLIENT — confort et anti-maladresse uniquement
 * (double envoi, spam involontaire). La limitation d'autorité vit côté
 * serveur (Supabase : contraintes + fonctions — cf. docs/THREAT-MODEL.md).
 */

export interface RateLimiter {
  /** Tente de consommer un jeton ; renvoie false si la fenêtre est saturée. */
  tryAcquire(): boolean;
  /** Millisecondes avant qu'un jeton se libère (0 si disponible). */
  retryInMs(now?: number): number;
}

export function createRateLimiter(
  maxActions: number,
  windowMs: number,
  clock: () => number = () => Date.now()
): RateLimiter {
  let timestamps: number[] = [];

  const prune = (now: number) => {
    timestamps = timestamps.filter(t => now - t < windowMs);
  };

  return {
    tryAcquire() {
      const now = clock();
      prune(now);
      if (timestamps.length >= maxActions) return false;
      timestamps.push(now);
      return true;
    },
    retryInMs(now = clock()) {
      prune(now);
      if (timestamps.length < maxActions) return 0;
      const oldest = timestamps[0];
      return oldest === undefined ? 0 : Math.max(0, oldest + windowMs - now);
    },
  };
}

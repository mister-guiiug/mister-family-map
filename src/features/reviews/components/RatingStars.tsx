import { Star } from 'lucide-react';

/** Note en étoiles, avec libellé textuel (jamais l'icône seule). */
export function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`Note : ${rating} sur 5`}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={16}
          aria-hidden="true"
          fill={i <= Math.round(rating) ? 'currentColor' : 'none'}
          className="text-accent"
        />
      ))}
      <span className="text-fluid-xs text-ink-soft">{rating}/5</span>
    </span>
  );
}

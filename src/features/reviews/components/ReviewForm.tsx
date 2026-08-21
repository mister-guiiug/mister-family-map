import { useState } from 'react';
import {
  Button,
  ErrorBanner,
  SelectField,
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react';
import { useBackend } from '../../../app/providers/BackendProvider';
import {
  AGE_BRACKETS,
  isVisitDateValid,
  reviewDraftSchema,
  type AgeBracket,
} from '../../../entities/review/model';
import { sanitizeUserText } from '../../../shared/lib/sanitize';
import { createRateLimiter } from '../../../shared/lib/rate-limit';

/** Anti-maladresse : 3 retours max par 10 minutes côté client. */
const limiter = createRateLimiter(3, 10 * 60 * 1000);

export function ReviewForm({
  placeId,
  onPublished,
}: {
  placeId: string;
  onPublished: () => void;
}) {
  const backend = useBackend();
  const [visitedOn, setVisitedOn] = useState('');
  const [rating, setRating] = useState(4);
  const [brackets, setBrackets] = useState<AgeBracket[]>([]);
  const [positives, setPositives] = useState('');
  const [watchouts, setWatchouts] = useState('');
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [crowdLevel, setCrowdLevel] = useState('unknown');
  const [valueForMoney, setValueForMoney] = useState('unknown');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p role="status" className="mt-3 text-fluid-sm">
        Merci ! Votre retour est publié.
      </p>
    );
  }

  const submit = async () => {
    setError(null);
    if (!isVisitDateValid(visitedOn, new Date())) {
      setError('La date de visite ne peut pas être dans le futur.');
      return;
    }
    if (!limiter.tryAcquire()) {
      setError('Trop de retours d’affilée — réessayez dans quelques minutes.');
      return;
    }
    const parsed = reviewDraftSchema.safeParse({
      placeId,
      visitedOn,
      ageBrackets: brackets,
      rating,
      positives: sanitizeUserText(positives, 1000),
      watchouts: sanitizeUserText(watchouts, 1000),
      accessibilityNotes: sanitizeUserText(accessibilityNotes, 500),
      crowdLevel,
      valueForMoney,
      practicalTips: '',
      photoIds: [],
    });
    if (!parsed.success) {
      setError('Certains champs sont invalides — vérifiez la date et la note.');
      return;
    }
    setSaving(true);
    try {
      await backend.reviews.create(parsed.data);
      setDone(true);
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="mt-4 flex flex-col gap-fluid-sm rounded-(--radius-card) border border-line p-fluid-md"
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-fluid-base font-semibold">Partager votre visite</h3>
      {error ? <ErrorBanner message={error} severity="warning" /> : null}

      <TextField
        label="Date de visite"
        type="date"
        required
        value={visitedOn}
        onChange={e => setVisitedOn(e.target.value)}
      />

      <SelectField
        label="Appréciation globale"
        value={String(rating)}
        onChange={e => setRating(Number(e.target.value))}
      >
        {[5, 4, 3, 2, 1].map(n => (
          <option key={n} value={n}>
            {n}/5
          </option>
        ))}
      </SelectField>

      <fieldset>
        <legend className="text-fluid-sm font-medium">
          Âges des enfants (facultatif, jamais nominatif)
        </legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {AGE_BRACKETS.map(bracket => (
            <label
              key={bracket}
              className="inline-flex touch-target items-center gap-1 text-fluid-sm"
            >
              <input
                type="checkbox"
                checked={brackets.includes(bracket)}
                onChange={e =>
                  setBrackets(prev =>
                    e.target.checked
                      ? [...prev, bracket]
                      : prev.filter(b => b !== bracket)
                  )
                }
              />
              {bracket} ans
            </label>
          ))}
        </div>
      </fieldset>

      <TextAreaField
        label="Points positifs"
        rows={2}
        value={positives}
        onChange={e => setPositives(e.target.value)}
      />
      <TextAreaField
        label="Points de vigilance"
        hint="Restez factuel : l'objectif est d'aider les autres familles."
        rows={2}
        value={watchouts}
        onChange={e => setWatchouts(e.target.value)}
      />
      <TextAreaField
        label="Accessibilité réellement constatée"
        rows={2}
        value={accessibilityNotes}
        onChange={e => setAccessibilityNotes(e.target.value)}
      />
      <SelectField
        label="Affluence observée"
        value={crowdLevel}
        onChange={e => setCrowdLevel(e.target.value)}
      >
        <option value="unknown">Je ne sais plus</option>
        <option value="quiet">Calme</option>
        <option value="moderate">Modérée</option>
        <option value="busy">Forte</option>
      </SelectField>
      <SelectField
        label="Rapport qualité-prix"
        value={valueForMoney}
        onChange={e => setValueForMoney(e.target.value)}
      >
        <option value="unknown">Sans avis</option>
        <option value="good">Bon</option>
        <option value="fair">Correct</option>
        <option value="poor">Décevant</option>
      </SelectField>

      <Button type="submit" variant="primary" loading={saving}>
        Publier le retour
      </Button>
    </form>
  );
}

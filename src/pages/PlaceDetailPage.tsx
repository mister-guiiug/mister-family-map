import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Sheet,
  SkeletonGroup,
  TextAreaField,
  SelectField,
} from '@mister-guiiug/dev-pwa-config/react';
import { Flag, Heart, Share2 } from 'lucide-react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { averageRating } from '../entities/review/model';
import { PUBLICATION_STATUS_LABELS } from '../entities/place/model';
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
} from '../entities/moderation/model';
import { useAuthStore } from '../features/auth/store';
import { useFavoritesStore } from '../features/favorites/store';
import { TriStateChip } from '../features/places/components/TriStateChip';
import { RatingStars } from '../features/reviews/components/RatingStars';
import { ReviewForm } from '../features/reviews/components/ReviewForm';
import { getDefaultLocale } from '@mister-guiiug/dev-pwa-config/format';

function priceLabel(place: {
  price: { kind: string; minEuros?: number; maxEuros?: number };
}): string {
  if (place.price.kind === 'free') return 'Gratuit';
  if (place.price.kind === 'unknown') return 'Tarif : information inconnue';
  const { minEuros, maxEuros } = place.price;
  if (minEuros !== undefined && maxEuros !== undefined)
    return `De ${minEuros} € à ${maxEuros} €`;
  return 'Payant';
}

export default function PlaceDetailPage() {
  const { id = '' } = useParams();
  const backend = useBackend();
  const session = useAuthStore(s => s.session);
  const favorites = useFavoritesStore();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('incorrect');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const placeState = useAsync(() => backend.places.getById(id), id);
  const reviewsState = useAsync(() => backend.reviews.listForPlace(id), id);
  const eventsState = useAsync(() => backend.events.list({ placeId: id }), id);

  if (placeState.loading)
    return (
      <div className="p-fluid-md">
        <SkeletonGroup label="Chargement de la fiche" lines={6} />
      </div>
    );
  if (placeState.error)
    return (
      <div className="p-fluid-md">
        <ErrorBanner message={placeState.error} onRetry={placeState.reload} />
      </div>
    );
  const place = placeState.data;
  if (!place)
    return (
      <div className="p-fluid-md">
        <EmptyState
          title="Lieu introuvable"
          description="Cette fiche a peut-être été retirée."
          action={
            <Link to="/" className="underline">
              Retour à l’exploration
            </Link>
          }
        />
      </div>
    );

  const reviews = reviewsState.data ?? [];
  const rating = averageRating(reviews);
  const isFavorite = favorites.ids.includes(place.id);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Lien copié !');
      }
    } catch {
      setShareMessage('Partage indisponible.');
    }
  };

  return (
    <article className="px-fluid-md pt-safe-top">
      <header className="pt-fluid-md">
        <h1 className="text-fluid-2xl font-bold">{place.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-fluid-sm text-ink-soft">
          {place.city ? <span>{place.city}</span> : null}
          {rating !== null ? <RatingStars rating={rating} /> : null}
          {place.status !== 'published' ? (
            <Badge tone="warning">
              {PUBLICATION_STATUS_LABELS[place.status]}
            </Badge>
          ) : null}
          {place.lastVerifiedAt === null ? (
            <Badge tone="warning" variant="outline">
              Donnée non vérifiée
            </Badge>
          ) : (
            <span>
              Vérifié le{' '}
              {new Date(place.lastVerifiedAt).toLocaleDateString(
                getDefaultLocale()
              )}
            </span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={isFavorite ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={isFavorite}
            onClick={() => void favorites.toggle(backend.favorites, place.id)}
          >
            <Heart
              size={18}
              aria-hidden="true"
              fill={isFavorite ? 'currentColor' : 'none'}
            />
            {isFavorite ? 'Dans les favoris' : 'Ajouter aux favoris'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            <Share2 size={18} aria-hidden="true" />
            Partager
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
            <Flag size={18} aria-hidden="true" />
            Signaler
          </Button>
        </div>
        {shareMessage ? (
          <p role="status" className="mt-1 text-fluid-xs text-ink-soft">
            {shareMessage}
          </p>
        ) : null}
      </header>

      {place.shortDescription ? (
        <p className="mt-4 text-fluid-base">{place.shortDescription}</p>
      ) : null}
      {place.description ? (
        <p className="mt-2 whitespace-pre-line text-fluid-sm">
          {place.description}
        </p>
      ) : null}

      <section aria-label="Informations pratiques" className="mt-5">
        <h2 className="text-fluid-lg font-semibold">Pour les familles</h2>
        <p className="mt-1 text-fluid-sm text-ink-soft">
          {place.ageRange
            ? `Recommandé de ${place.ageRange.min} à ${place.ageRange.max} ans. `
            : 'Tranche d’âge : information inconnue. '}
          {place.durationMinutes
            ? `Durée indicative : ${Math.round(place.durationMinutes / 60) || 1} h. `
            : ''}
          {priceLabel(place)}.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <TriStateChip
            label="Accessible"
            value={place.features.accessibility}
          />
          <TriStateChip label="Poussette" value={place.features.stroller} />
          <TriStateChip label="Animaux" value={place.features.petsAllowed} />
          <TriStateChip label="Toilettes" value={place.features.toilets} />
          <TriStateChip label="Point d’eau" value={place.features.waterPoint} />
          <TriStateChip label="Pique-nique" value={place.features.picnicArea} />
        </div>
        {place.practicalTips ? (
          <p className="mt-3 rounded-(--radius-card) bg-primary-soft p-fluid-sm text-fluid-sm">
            <strong>Conseils pratiques :</strong> {place.practicalTips}
          </p>
        ) : null}
        {place.openingHours ? (
          <p className="mt-2 text-fluid-sm">Horaires : {place.openingHours}</p>
        ) : null}
        {place.websiteUrl ? (
          <p className="mt-1 text-fluid-sm">
            <a
              href={place.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Site officiel
            </a>
          </p>
        ) : null}
      </section>

      {(eventsState.data?.length ?? 0) > 0 ? (
        <section aria-label="Événements associés" className="mt-5">
          <h2 className="text-fluid-lg font-semibold">
            Événements à venir ici
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-fluid-sm">
            {eventsState.data?.map(e => (
              <li key={e.id}>
                <Link to={`/agenda/${e.id}`} className="underline">
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Retours d'expérience" className="mt-5 pb-8">
        <h2 className="text-fluid-lg font-semibold">
          Retours d’expérience ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-1 text-fluid-sm text-ink-soft">
            Aucun retour pour l’instant — le vôtre aidera d’autres familles.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {reviews.map(r => (
              <li
                key={r.id}
                className="rounded-(--radius-card) border border-line p-fluid-sm text-fluid-sm"
              >
                <p className="flex flex-wrap items-center gap-2">
                  <RatingStars rating={r.rating} />
                  <span className="text-ink-soft">
                    Visite le{' '}
                    {new Date(r.visitedOn).toLocaleDateString(
                      getDefaultLocale()
                    )}
                    {r.ageBrackets.length > 0
                      ? ` · enfants ${r.ageBrackets.join(', ')} ans`
                      : ''}
                  </span>
                </p>
                {r.positives ? <p className="mt-1">👍 {r.positives}</p> : null}
                {r.watchouts ? <p className="mt-1">⚠️ {r.watchouts}</p> : null}
                {r.accessibilityNotes ? (
                  <p className="mt-1">♿ {r.accessibilityNotes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {session ? (
          <ReviewForm placeId={place.id} onPublished={reviewsState.reload} />
        ) : (
          <p className="mt-3 text-fluid-sm">
            <Link to="/connexion" className="underline">
              Connectez-vous
            </Link>{' '}
            pour publier un retour d’expérience.
          </p>
        )}
      </section>

      <Sheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Signaler cette fiche"
      >
        {reportSent ? (
          <p role="status" className="text-fluid-sm">
            Merci, votre signalement a été transmis à la modération.
          </p>
        ) : session ? (
          <form
            className="flex flex-col gap-fluid-sm"
            onSubmit={e => {
              e.preventDefault();
              void backend.moderation
                .report('place', place.id, reportReason, reportDetails)
                .then(() => setReportSent(true));
            }}
          >
            <SelectField
              label="Motif"
              value={reportReason}
              onChange={e => setReportReason(e.target.value as ReportReason)}
            >
              {REPORT_REASONS.map(r => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </SelectField>
            <TextAreaField
              label="Précisions"
              rows={3}
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
            />
            <Button type="submit" variant="primary">
              Envoyer le signalement
            </Button>
          </form>
        ) : (
          <p className="text-fluid-sm">
            <Link to="/connexion" className="underline">
              Connectez-vous
            </Link>{' '}
            pour signaler une donnée incorrecte.
          </p>
        )}
      </Sheet>
    </article>
  );
}

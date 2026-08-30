import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  ErrorBanner,
  SelectField,
  TextAreaField,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { placeDraftSchema } from '../entities/place/model';
import { findPotentialDuplicates } from '../shared/lib/dedupe';
import { formatDistance } from '@mister-guiiug/dev-wpa-config/geo';
import { sanitizeSingleLine, sanitizeUserText } from '../shared/lib/sanitize';
import { validateImageFile } from '@mister-guiiug/dev-wpa-config/image';
import { useAuthStore } from '../features/auth/store';
import {
  usePlaceWizardStore,
  WIZARD_STEP_LABELS,
  WIZARD_STEPS,
} from '../features/contributions/place-wizard-store';
import { MapView } from '../features/map/components/MapView';
import { PageHeader } from '../shared/components/PageHeader';

/**
 * Parcours guidé d'ajout d'un lieu (7 écrans) : position → doublons →
 * essentiel → famille → photos → aperçu → règles/envoi. Brouillon local,
 * reprise après interruption, validation Zod avant envoi.
 */
export default function PlaceCreatePage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const session = useAuthStore(s => s.session);
  const wizard = usePlaceWizardStore();
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    wizard.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restauration au montage uniquement
  }, []);

  const placesState = useAsync(() => backend.places.list(), 'static');
  const categoriesState = useAsync(
    () => backend.categories.listActive(),
    'static'
  );

  const duplicates = useMemo(() => {
    if (!placesState.data || wizard.draft.name.length < 2) return [];
    return findPotentialDuplicates(
      { name: wizard.draft.name, coordinates: wizard.draft.coordinates },
      placesState.data
    );
  }, [placesState.data, wizard.draft.name, wizard.draft.coordinates]);

  if (!session) {
    return (
      <div className="p-fluid-md">
        <PageHeader title="Ajouter un lieu" />
        <p className="px-fluid-md text-fluid-sm">
          <Link to="/connexion" className="underline">
            Connectez-vous
          </Link>{' '}
          pour proposer un lieu à la communauté.
        </p>
      </div>
    );
  }

  const stepIndex = WIZARD_STEPS.indexOf(wizard.step);
  const goNext = () => {
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) wizard.setStep(next);
  };
  const goBack = () => {
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) wizard.setStep(prev);
  };

  const submit = async () => {
    setError(null);
    const parsed = placeDraftSchema.safeParse({
      ...wizard.draft,
      name: sanitizeSingleLine(wizard.draft.name, 120),
      city: sanitizeSingleLine(wizard.draft.city, 100),
      shortDescription: sanitizeUserText(wizard.draft.shortDescription, 280),
      description: sanitizeUserText(wizard.draft.description, 4000),
      practicalTips: sanitizeUserText(wizard.draft.practicalTips, 2000),
    });
    if (!parsed.success) {
      setError(
        'Le formulaire est incomplet : nom (2 caractères minimum), catégorie et description courte sont requis.'
      );
      return;
    }
    setSending(true);
    try {
      const place = await backend.places.create(parsed.data);
      wizard.clear();
      navigate(`/lieux/${place.id}`, {
        state: { justCreated: true },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Ajouter un lieu"
        subtitle={`Étape ${stepIndex + 1}/${WIZARD_STEPS.length} — ${WIZARD_STEP_LABELS[wizard.step]}`}
      />

      <div className="px-fluid-md pb-8">
        <ol aria-label="Progression" className="mb-4 flex gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={s === wizard.step ? 'step' : undefined}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-primary' : 'bg-line'}`}
            >
              <span className="sr-only">{WIZARD_STEP_LABELS[s]}</span>
            </li>
          ))}
        </ol>

        {error ? <ErrorBanner message={error} severity="warning" /> : null}

        {wizard.step === 'position' ? (
          <section>
            <p className="mb-2 text-fluid-sm text-ink-soft">
              Déplacez la carte puis utilisez « Autour de moi » ou saisissez les
              coordonnées. La position précise aide les autres familles à
              trouver l’entrée.
            </p>
            <MapView
              places={[]}
              onOpenPlace={() => {}}
              onViewportChange={viewport =>
                wizard.updateDraft({ coordinates: viewport.center })
              }
              ariaLabel="Positionnez le lieu au centre de la carte"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <TextField
                label="Latitude"
                type="number"
                step="0.0001"
                value={wizard.draft.coordinates.lat}
                onChange={e =>
                  wizard.updateDraft({
                    coordinates: {
                      ...wizard.draft.coordinates,
                      lat: Number(e.target.value),
                    },
                  })
                }
              />
              <TextField
                label="Longitude"
                type="number"
                step="0.0001"
                value={wizard.draft.coordinates.lng}
                onChange={e =>
                  wizard.updateDraft({
                    coordinates: {
                      ...wizard.draft.coordinates,
                      lng: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </section>
        ) : null}

        {wizard.step === 'doublons' ? (
          <section>
            <TextField
              label="Nom du lieu"
              required
              value={wizard.draft.name}
              onChange={e => wizard.updateDraft({ name: e.target.value })}
            />
            {duplicates.length > 0 ? (
              <div className="mt-3 rounded-(--radius-card) border border-line p-fluid-sm">
                <h2 className="text-fluid-base font-semibold">
                  Ce lieu existe peut-être déjà
                </h2>
                <ul className="mt-1 flex flex-col gap-1 text-fluid-sm">
                  {duplicates.map(d => (
                    <li key={d.place.id} data-testid="duplicate-suggestion">
                      <Link to={`/lieux/${d.place.id}`} className="underline">
                        {d.place.name}
                      </Link>{' '}
                      <span className="text-ink-soft">
                        à {formatDistance(d.distanceKm)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-fluid-xs text-ink-soft">
                  Si c’est le même lieu, complétez plutôt sa fiche.
                </p>
              </div>
            ) : (
              <p role="status" className="mt-2 text-fluid-sm text-ink-soft">
                Aucun doublon détecté à proximité.
              </p>
            )}
          </section>
        ) : null}

        {wizard.step === 'essentiel' ? (
          <section className="flex flex-col gap-fluid-sm">
            <SelectField
              label="Catégorie"
              required
              value={wizard.draft.categoryId}
              onChange={e => wizard.updateDraft({ categoryId: e.target.value })}
            >
              <option value="">Choisir…</option>
              {(categoriesState.data ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Commune"
              value={wizard.draft.city}
              onChange={e => wizard.updateDraft({ city: e.target.value })}
            />
            <TextAreaField
              label="Description courte"
              required
              hint="Une ou deux phrases concrètes (280 caractères max)."
              rows={2}
              value={wizard.draft.shortDescription}
              onChange={e =>
                wizard.updateDraft({ shortDescription: e.target.value })
              }
            />
          </section>
        ) : null}

        {wizard.step === 'famille' ? (
          <section className="flex flex-col gap-fluid-sm">
            <p className="text-fluid-sm text-ink-soft">
              Laissez « Je ne sais pas » quand vous n’êtes pas sûr : une
              information inconnue vaut mieux qu’une information fausse.
            </p>
            {(
              [
                ['stroller', 'Adapté poussette'],
                ['toilets', 'Toilettes'],
                ['picnicArea', 'Aire de pique-nique'],
                ['waterPoint', 'Point d’eau'],
                ['petsAllowed', 'Animaux autorisés'],
                ['accessibility', 'Accessible (PMR)'],
              ] as const
            ).map(([key, label]) => (
              <SelectField
                key={key}
                label={label}
                value={wizard.draft.features[key]}
                onChange={e =>
                  wizard.updateDraft({
                    features: {
                      ...wizard.draft.features,
                      [key]: e.target.value as 'yes' | 'no' | 'unknown',
                    },
                  })
                }
              >
                <option value="unknown">Je ne sais pas</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </SelectField>
            ))}
            <SelectField
              label="Gratuité"
              value={wizard.draft.price.kind}
              onChange={e =>
                wizard.updateDraft({
                  price:
                    e.target.value === 'paid'
                      ? { kind: 'paid' }
                      : { kind: e.target.value as 'free' | 'unknown' },
                })
              }
            >
              <option value="unknown">Je ne sais pas</option>
              <option value="free">Gratuit</option>
              <option value="paid">Payant</option>
            </SelectField>
          </section>
        ) : null}

        {wizard.step === 'photos' ? (
          <section>
            <p className="mb-2 text-fluid-sm text-ink-soft">
              Facultatif. Les métadonnées (position GPS, appareil) sont retirées
              automatiquement avant l’envoi. Pas de visages d’enfants
              reconnaissables, s’il vous plaît.
            </p>
            <label className="block text-fluid-sm font-medium">
              Ajouter des photos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="mt-1 block w-full text-fluid-sm"
                onChange={e => {
                  setPhotoError(null);
                  for (const file of e.target.files ?? []) {
                    const problem = validateImageFile(file);
                    if (problem === 'type')
                      setPhotoError('Formats acceptés : JPEG, PNG, WebP.');
                    if (problem === 'size')
                      setPhotoError('Chaque photo doit faire moins de 5 Mo.');
                  }
                }}
              />
            </label>
            {photoError ? (
              <p
                role="alert"
                className="mt-1 text-fluid-sm text-(--dwc-danger)"
              >
                {photoError}
              </p>
            ) : null}
          </section>
        ) : null}

        {wizard.step === 'apercu' ? (
          <section className="rounded-(--radius-card) border border-line p-fluid-md">
            <h2 className="text-fluid-lg font-semibold">
              {wizard.draft.name || 'Sans nom'}
            </h2>
            <p className="text-fluid-sm text-ink-soft">
              {wizard.draft.city || 'Commune non renseignée'} ·{' '}
              {wizard.draft.coordinates.lat.toFixed(4)},{' '}
              {wizard.draft.coordinates.lng.toFixed(4)}
            </p>
            <p className="mt-2 text-fluid-sm">
              {wizard.draft.shortDescription || 'Aucune description.'}
            </p>
            <p className="mt-2 text-fluid-xs text-ink-soft">
              Votre contribution sera visible après validation par la
              modération.
            </p>
          </section>
        ) : null}

        {wizard.step === 'regles' ? (
          <section className="flex flex-col gap-fluid-sm">
            <div className="rounded-(--radius-card) border border-line p-fluid-md text-fluid-sm">
              <h2 className="font-semibold">Règles de contribution</h2>
              <ul className="mt-1 list-disc pl-5">
                <li>Des informations exactes et vérifiées par vous-même.</li>
                <li>
                  Aucune donnée personnelle (ni la vôtre, ni celle d’autrui).
                </li>
                <li>Pas de contenu promotionnel déguisé.</li>
                <li>
                  Vos contributions sont publiées sous votre pseudonyme et
                  modérées a priori.
                </li>
              </ul>
            </div>
            <label className="flex touch-target items-center gap-2 text-fluid-sm">
              <input
                type="checkbox"
                checked={wizard.rulesAccepted}
                onChange={e => wizard.setRulesAccepted(e.target.checked)}
              />
              J’accepte les règles de contribution.
            </label>
          </section>
        ) : null}

        <div className="mt-5 flex gap-2">
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={goBack}>
              Retour
            </Button>
          ) : null}
          {wizard.step === 'regles' ? (
            <Button
              variant="primary"
              block
              disabled={!wizard.rulesAccepted}
              loading={sending}
              onClick={() => void submit()}
            >
              Envoyer la contribution
            </Button>
          ) : (
            <Button variant="primary" block onClick={goNext}>
              Continuer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

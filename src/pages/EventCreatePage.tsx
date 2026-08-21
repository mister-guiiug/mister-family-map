import { useState } from 'react';
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
import { eventDraftSchema } from '../entities/event/model';
import { sanitizeSingleLine, sanitizeUserText } from '../shared/lib/sanitize';
import { useAuthStore } from '../features/auth/store';
import { PageHeader } from '../shared/components/PageHeader';

/** Proposition d'événement (statut `proposed`, validé par la modération). */
export default function EventCreatePage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const session = useAuthStore(s => s.session);
  const categoriesState = useAsync(
    () => backend.categories.listActive(),
    'static'
  );

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [free, setFree] = useState<'free' | 'paid' | 'unknown'>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ endsAt?: string }>({});
  const [saving, setSaving] = useState(false);

  if (!session) {
    return (
      <div>
        <PageHeader title="Proposer un événement" />
        <p className="px-fluid-md text-fluid-sm">
          <Link to="/connexion" className="underline">
            Connectez-vous
          </Link>{' '}
          pour proposer un événement.
        </p>
      </div>
    );
  }

  const toOffsetIso = (local: string): string => {
    // datetime-local → ISO avec l'offset local du contributeur.
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  };

  const submit = async () => {
    setError(null);
    setFieldErrors({});
    const start = toOffsetIso(startsAt);
    const end = toOffsetIso(endsAt || startsAt);
    if (start && end && new Date(end) < new Date(start)) {
      setFieldErrors({ endsAt: 'La fin doit être après le début.' });
      return;
    }
    const parsed = eventDraftSchema.safeParse({
      title: sanitizeSingleLine(title, 140),
      description: sanitizeUserText(description, 4000),
      categoryId,
      organizer: '',
      placeId: null,
      address: sanitizeSingleLine(address, 200),
      coordinates: null,
      startsAt: start,
      endsAt: end,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      allDay,
      recurrence: null,
      registrationDeadline: null,
      price: free === 'paid' ? { kind: 'paid' } : { kind: free },
      ageRange: null,
      capacity: null,
      websiteUrl: null,
      bookingInfo: '',
      contact: '',
      accessibility: '',
      indoor: 'unknown',
    });
    if (!parsed.success) {
      setError('Titre, catégorie et date de début sont requis.');
      return;
    }
    setSaving(true);
    try {
      const event = await backend.events.create(parsed.data);
      navigate(`/agenda/${event.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Proposer un événement"
        subtitle="Il sera visible après validation"
      />
      <form
        className="flex flex-col gap-fluid-sm px-fluid-md pb-8"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {error ? <ErrorBanner message={error} severity="warning" /> : null}

        <TextField
          label="Titre"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <SelectField
          label="Catégorie"
          required
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
        >
          <option value="">Choisir…</option>
          {(categoriesState.data ?? []).map(c => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Description"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <TextField
          label="Adresse"
          value={address}
          onChange={e => setAddress(e.target.value)}
        />
        <label className="flex touch-target items-center gap-2 text-fluid-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={e => setAllDay(e.target.checked)}
          />
          Journée entière (sans heure précise)
        </label>
        <TextField
          label="Début"
          type={allDay ? 'date' : 'datetime-local'}
          required
          value={startsAt}
          onChange={e => setStartsAt(e.target.value)}
        />
        <TextField
          label="Fin"
          type={allDay ? 'date' : 'datetime-local'}
          hint="Laissez vide si identique au début."
          value={endsAt}
          onChange={e => setEndsAt(e.target.value)}
          {...(fieldErrors.endsAt ? { error: fieldErrors.endsAt } : {})}
        />
        <SelectField
          label="Tarif"
          value={free}
          onChange={e => setFree(e.target.value as typeof free)}
        >
          <option value="unknown">Je ne sais pas</option>
          <option value="free">Gratuit</option>
          <option value="paid">Payant</option>
        </SelectField>

        <Button type="submit" variant="primary" loading={saving}>
          Envoyer la proposition
        </Button>
      </form>
    </div>
  );
}

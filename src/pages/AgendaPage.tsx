import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  EmptyState,
  ErrorBanner,
  SkeletonGroup,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react';
import { Plus } from 'lucide-react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import {
  eventsOnDay,
  upcomingEvents,
  weekendEvents,
} from '../entities/event/agenda';
import { distanceKm } from '@mister-guiiug/dev-wpa-config/geo';
import { useSearchStore } from '../features/search/store';
import { EventCard } from '../features/events/components/EventCard';
import { PageHeader } from '../shared/components/PageHeader';

/** Agenda : « Ce week-end », « À une date précise », « À proximité », liste chronologique. */
export default function AgendaPage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const [pickedDate, setPickedDate] = useState('');
  const { origin } = useSearchStore();
  const now = useMemo(() => new Date(), []);

  const eventsState = useAsync(() => backend.events.list(), 'static');
  const events = eventsState.data ?? [];

  const weekend = useMemo(() => weekendEvents(events, now), [events, now]);
  const onDate = useMemo(
    () => (pickedDate ? eventsOnDay(events, new Date(pickedDate)) : []),
    [events, pickedDate]
  );
  const upcoming = useMemo(() => upcomingEvents(events, now), [events, now]);
  const nearby = useMemo(() => {
    if (!origin) return [];
    return upcoming.filter(
      e => e.coordinates && distanceKm(origin, e.coordinates) <= 30
    );
  }, [upcoming, origin]);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Les sorties à venir près de chez vous"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/agenda/nouveau')}
          >
            <Plus size={18} aria-hidden="true" />
            Proposer
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-fluid-md pb-8">
        {eventsState.loading ? (
          <SkeletonGroup label="Chargement de l'agenda" lines={4} />
        ) : eventsState.error ? (
          <ErrorBanner
            message={eventsState.error}
            onRetry={eventsState.reload}
          />
        ) : (
          <>
            <section aria-label="Ce week-end">
              <h2 className="mb-2 text-fluid-xl font-semibold">Ce week-end</h2>
              {weekend.length === 0 ? (
                <p className="text-fluid-sm text-ink-soft">
                  Rien de programmé ce week-end pour l’instant.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {weekend.map(e => (
                    <li key={e.id}>
                      <EventCard event={e} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="À une date précise">
              <h2 className="mb-2 text-fluid-xl font-semibold">
                À une date précise
              </h2>
              <TextField
                label="Choisir une date"
                type="date"
                value={pickedDate}
                onChange={e => setPickedDate(e.target.value)}
              />
              {pickedDate ? (
                onDate.length === 0 ? (
                  <p role="status" className="mt-2 text-fluid-sm text-ink-soft">
                    Aucun événement ce jour-là.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {onDate.map(e => (
                      <li key={e.id}>
                        <EventCard event={e} now={now} />
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </section>

            {origin ? (
              <section aria-label="À proximité">
                <h2 className="mb-2 text-fluid-xl font-semibold">
                  À proximité
                </h2>
                {nearby.length === 0 ? (
                  <p className="text-fluid-sm text-ink-soft">
                    Aucun événement à moins de 30 km.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {nearby.map(e => (
                      <li key={e.id}>
                        <EventCard event={e} now={now} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <section aria-label="Tous les événements à venir">
              <h2 className="mb-2 text-fluid-xl font-semibold">À venir</h2>
              {upcoming.length === 0 ? (
                <EmptyState
                  title="Aucun événement programmé"
                  description="Proposez le prochain rendez-vous des familles du coin !"
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => navigate('/agenda/nouveau')}
                    >
                      Proposer un événement
                    </Button>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {upcoming.map(e => (
                    <li key={e.id}>
                      <EventCard event={e} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

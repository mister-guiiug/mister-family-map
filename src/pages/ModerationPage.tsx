import { Link } from 'react-router';
import {
  Badge,
  Button,
  EmptyState,
  SkeletonGroup,
} from '@mister-guiiug/dev-pwa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAsync } from '../shared/hooks/useAsync';
import { useCurrentRole } from '../features/auth/store';
import { can } from '../entities/user/permissions';
import { REPORT_REASON_LABELS } from '../entities/moderation/model';
import { PageHeader } from '../shared/components/PageHeader';
import { getDefaultLocale } from '@mister-guiiug/dev-pwa-config/format';

/** File de modération : signalements ouverts + historique des décisions. */
export default function ModerationPage() {
  const backend = useBackend();
  const role = useCurrentRole();

  const reportsState = useAsync(
    () => backend.moderation.listOpenReports(),
    'static'
  );
  const historyState = useAsync(() => backend.moderation.history(), 'static');

  if (!can(role, 'moderation.review')) {
    return (
      <div>
        <PageHeader title="Modération" />
        <p className="px-fluid-md text-fluid-sm">
          Espace réservé à l’équipe de modération.{' '}
          <Link to="/" className="underline">
            Retour à l’accueil
          </Link>
        </p>
      </div>
    );
  }

  const decide = (
    reportId: string,
    targetType: Parameters<typeof backend.moderation.decide>[1],
    targetId: string,
    decision: Parameters<typeof backend.moderation.decide>[3]
  ) => {
    void backend.moderation
      .decide(reportId, targetType, targetId, decision, '')
      .then(() => {
        reportsState.reload();
        historyState.reload();
      });
  };

  return (
    <div>
      <PageHeader
        title="Modération"
        subtitle="Signalements ouverts et historique des décisions"
      />
      <div className="flex flex-col gap-5 px-fluid-md pb-8">
        <section aria-label="Signalements ouverts">
          <h2 className="mb-2 text-fluid-lg font-semibold">
            Signalements ouverts
          </h2>
          {reportsState.loading ? (
            <SkeletonGroup label="Chargement des signalements" lines={2} />
          ) : (reportsState.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Rien à traiter"
              description="Aucun signalement en attente — beau travail."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {reportsState.data?.map(report => (
                <li
                  key={report.id}
                  className="rounded-(--radius-card) border border-line p-fluid-sm text-fluid-sm"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">
                      {REPORT_REASON_LABELS[report.reason]}
                    </Badge>
                    <span className="text-ink-soft">
                      {report.targetType} ·{' '}
                      {new Date(report.createdAt).toLocaleDateString(
                        getDefaultLocale()
                      )}
                    </span>
                  </p>
                  {report.details ? (
                    <p className="mt-1">{report.details}</p>
                  ) : null}
                  {report.targetType === 'place' ? (
                    <p className="mt-1">
                      <Link
                        to={`/lieux/${report.targetId}`}
                        className="underline"
                      >
                        Voir le contenu signalé
                      </Link>
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        decide(
                          report.id,
                          report.targetType,
                          report.targetId,
                          'approve'
                        )
                      }
                    >
                      Valider le contenu
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        decide(
                          report.id,
                          report.targetType,
                          report.targetId,
                          'hide'
                        )
                      }
                    >
                      Masquer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        decide(
                          report.id,
                          report.targetType,
                          report.targetId,
                          'dismiss-report'
                        )
                      }
                    >
                      Classer sans suite
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Historique">
          <h2 className="mb-2 text-fluid-lg font-semibold">
            Historique des décisions
          </h2>
          {(historyState.data?.length ?? 0) === 0 ? (
            <p className="text-fluid-sm text-ink-soft">
              Aucune décision enregistrée.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-fluid-sm">
              {historyState.data?.map(action => (
                <li key={action.id}>
                  {new Date(action.createdAt).toLocaleString(
                    getDefaultLocale()
                  )}{' '}
                  — <strong>{action.decision}</strong> sur {action.targetType}{' '}
                  {action.reason ? `(${action.reason})` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

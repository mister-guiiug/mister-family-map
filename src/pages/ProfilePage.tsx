import { Link, useNavigate } from 'react-router';
import { Badge, Button } from '@mister-guiiug/dev-wpa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { useAuthStore, useCurrentRole } from '../features/auth/store';
import { ROLE_LABELS } from '../entities/user/model';
import { can } from '../entities/user/permissions';
import { PageHeader } from '../shared/components/PageHeader';

export default function ProfilePage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const session = useAuthStore(s => s.session);
  const role = useCurrentRole();

  return (
    <div>
      <PageHeader title="Profil" />
      <div className="flex flex-col gap-4 px-fluid-md pb-8">
        {session ? (
          <>
            <p className="text-fluid-base">
              Connecté en tant que{' '}
              <strong>{session.profile.displayName}</strong>{' '}
              <Badge tone="brand" variant="outline">
                {ROLE_LABELS[role]}
              </Badge>
            </p>

            <nav aria-label="Mon espace" className="flex flex-col gap-2">
              <Link
                to="/profil/contributions"
                className="touch-target underline"
              >
                Mes contributions
              </Link>
              {can(role, 'moderation.review') ? (
                <Link to="/moderation" className="touch-target underline">
                  Espace modération
                </Link>
              ) : null}
            </nav>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void backend.auth.signOut()}
              >
                Se déconnecter
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      'Supprimer votre compte ? Vos contributions publiées seront anonymisées.'
                    )
                  ) {
                    void backend.auth.requestAccountDeletion().then(() => {
                      navigate('/');
                    });
                  }
                }}
              >
                Supprimer mon compte
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-fluid-base">
              Vous consultez en tant que visiteur. La carte, l’agenda et les
              fiches sont libres d’accès.
            </p>
            <Button variant="primary" onClick={() => navigate('/connexion')}>
              Se connecter ou créer un compte
            </Button>
          </>
        )}

        <section
          aria-label="À propos"
          className="mt-4 border-t border-line pt-4"
        >
          <h2 className="text-fluid-lg font-semibold">À propos</h2>
          <ul className="mt-2 flex flex-col gap-1 text-fluid-sm">
            <li>
              <Link to="/mentions" className="underline">
                Mentions légales, confidentialité et règles de contribution
              </Link>
            </li>
            <li className="text-ink-soft">
              Cartographie © OpenStreetMap — recherche d’adresse © Nominatim.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

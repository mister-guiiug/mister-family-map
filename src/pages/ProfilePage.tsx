import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  FamilyApps,
  UpdateButton,
} from '@mister-guiiug/dev-wpa-config/react';
import { AppVersion } from '@mister-guiiug/dev-wpa-config/react/app-version';
import { ShareButton } from '@mister-guiiug/dev-wpa-config/react/share-button';
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

          {/*
            Le numéro de version, là où on le cherche quand on remplit un
            rapport de bug : dans « À propos », pas dans une console. `details`
            ajoute la date de compilation et le commit court — les deux autres
            informations qu'un rapport utile porte.
          */}
          <AppVersion
            className="mt-3"
            details
            repoUrl="https://github.com/mister-guiiug/mister-family-map"
          />

          {/*
            « Forcer la mise à jour » : le bandeau de `UpdatePromptBanner` ne
            paraît que quand le navigateur a DÉJÀ vu la nouvelle version. Ce
            bouton sert au cas inverse — l'utilisateur qui soupçonne d'être en
            retard, c'est-à-dire précisément quand aucun bandeau n'existe. Il
            vide le cache de l'app et recharge ; les données locales
            (localStorage, favoris, brouillons) ne sont jamais touchées.
          */}
          <UpdateButton
            className="mt-3 touch-target rounded-(--radius-card) border border-line px-fluid-sm py-2 text-fluid-sm"
            showHint
          />

          {/*
            Partager l'app : partage natif quand le système en a un, copie du
            lien sinon. `currentAppUrl` n'est pas passé — le composant partage
            la page courante, ce qui est ce qu'on attend d'un écran de réglages.
          */}
          <ShareButton
            className="mt-3"
            title="Mister Family Map"
            text="Des idées de sorties en famille, partagées entre parents."
          />
        </section>

        {/*
          Code source, « M'offrir un café » et les autres applications de la
          famille : le socle tient le catalogue (`apps-catalog.js`), les badges
          de maturité et les liens sortants sécurisés. `currentAppId` retire
          l'app courante de la grille.
        */}
        <FamilyApps
          className="mt-4 border-t border-line pt-4"
          currentAppId="mister-family-map"
          repoUrl="https://github.com/mister-guiiug/mister-family-map"
        />
      </div>
    </div>
  );
}

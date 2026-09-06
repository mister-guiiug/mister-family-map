import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  FamilyApps,
  UpdateButton,
} from '@mister-guiiug/dev-pwa-config/react';
import { AppVersion } from '@mister-guiiug/dev-pwa-config/react/app-version';
import { ShareButton } from '@mister-guiiug/dev-pwa-config/react/share-button';
import { ThemeToggle } from '@mister-guiiug/dev-pwa-config/react/theme-toggle';
import { useBackend } from '../app/providers/BackendProvider';
import { useAuthStore, useCurrentRole } from '../features/auth/store';
import { ROLE_LABELS } from '../entities/user/model';
import { can } from '../entities/user/permissions';
import { PageHeader } from '../shared/components/PageHeader';
import { ExportContributionsButton } from '../features/contributions/ExportContributionsButton';

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

            {/*
              LA PROMESSE DE LA PAGE « MENTIONS », TENUE. Elle dit depuis le
              premier jour : « Vous pouvez supprimer votre compte et exporter
              vos contributions depuis le profil. » La suppression était là,
              l'export nulle part. Il est ici, à côté d'elle : les deux moitiés
              d'une même phrase, au même endroit — et l'ordre compte, on
              emporte ses données AVANT de fermer son compte.
            */}
            <div className="flex flex-wrap gap-2">
              <ExportContributionsButton session={session} />
            </div>
            <p className="-mt-2 text-fluid-sm text-ink-soft">
              Un fichier JSON : vos lieux, vos événements, vos retours et vos
              favoris, y compris ce que vous avez supprimé.
            </p>

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

        {/*
          LA BASCULE DE THÈME, ENFIN ATTEIGNABLE. Les jetons sombres existaient
          dans `styles/index.css` et le script anti-FOUC d'`index.html` lisait
          déjà `dwc_theme` — mais aucun écran n'écrivait cette clé : lire la
          carte le soir supposait de basculer TOUT le système d'exploitation.
          Trois états, pas deux : « Système » reste le défaut, et c'est lui qui
          suit le coucher du soleil sans qu'on y pense.

          Hors du bloc `session` : le thème n'a rien à voir avec le fait
          d'avoir un compte, et un visiteur consulte la carte le soir comme un
          autre.
        */}
        <section
          aria-label="Apparence"
          className="mt-4 border-t border-line pt-4"
        >
          <h2 className="text-fluid-lg font-semibold">Apparence</h2>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-fluid-sm text-ink-soft">
              Clair, sombre, ou selon votre appareil.
            </p>
            <ThemeToggle
              className="touch-target rounded-(--radius-card) border border-line px-fluid-sm py-2 text-fluid-sm"
              showLabel
            />
          </div>
        </section>

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

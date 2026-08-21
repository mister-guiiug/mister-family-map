import { PageHeader } from '../shared/components/PageHeader';

/**
 * Pages légales TEMPORAIRES — clairement signalées comme telles. À remplacer
 * par des textes validés avant toute mise en production publique.
 */
export default function LegalPage() {
  return (
    <div>
      <PageHeader title="Informations légales" />
      <div className="prose-sm flex max-w-2xl flex-col gap-4 px-fluid-md pb-8 text-fluid-sm">
        <p
          role="note"
          className="rounded-(--radius-card) border border-(--dwc-warning) p-fluid-sm"
        >
          ⚠️ Contenu provisoire : ces textes sont des gabarits destinés au
          développement. Ils doivent être relus et validés avant ouverture au
          public.
        </p>

        <section aria-labelledby="mentions">
          <h2 id="mentions" className="text-fluid-lg font-semibold">
            Mentions légales (à compléter)
          </h2>
          <p>
            Éditeur, hébergeur et contact seront renseignés ici avant la mise en
            ligne.
          </p>
        </section>

        <section aria-labelledby="confidentialite">
          <h2 id="confidentialite" className="text-fluid-lg font-semibold">
            Confidentialité
          </h2>
          <ul className="list-disc pl-5">
            <li>
              La géolocalisation n’est utilisée qu’à votre demande et n’est
              jamais stockée ni transmise.
            </li>
            <li>
              Aucune donnée relative aux enfants n’est collectée : les retours
              d’expérience utilisent des tranches d’âge anonymes.
            </li>
            <li>
              Compte : adresse e-mail et pseudonyme uniquement. Vous pouvez
              supprimer votre compte et exporter vos contributions depuis le
              profil.
            </li>
            <li>
              Durées de conservation, sous-traitants et bases légales seront
              détaillés ici (cf. docs/THREAT-MODEL.md du projet).
            </li>
          </ul>
        </section>

        <section aria-labelledby="regles">
          <h2 id="regles" className="text-fluid-lg font-semibold">
            Règles de contribution
          </h2>
          <ul className="list-disc pl-5">
            <li>
              Des informations exactes, utiles et vérifiées par vous-même.
            </li>
            <li>Pas de données personnelles ni de photos identifiantes.</li>
            <li>Pas de promotion déguisée ; les avis restent factuels.</li>
            <li>
              Tout contenu peut être signalé et fait l’objet d’une modération
              tracée.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

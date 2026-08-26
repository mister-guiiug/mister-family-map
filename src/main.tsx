import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { ObservabilityBoundary } from '@mister-guiiug/dev-wpa-config/react';
import { VersionProvider } from '@mister-guiiug/dev-wpa-config/react/version';
import { installObservability } from '@mister-guiiug/dev-wpa-config/react/observability';
import { installCorrelation } from '@mister-guiiug/dev-wpa-config/correlation';
import { BackendProvider } from './app/providers/BackendProvider';
import { createBackend } from './app/config/backend';
import { router } from './app/router';
import './shared/styles/index.css';

/**
 * Observabilité AVANT tout le reste : une erreur levée pendant la construction
 * du backend doit déjà être capturée et rattachable.
 *
 * `installCorrelation` pose l'identifiant qui relie les canaux : contexte de
 * session des erreurs, en-têtes des requêtes sortantes, et référence affichée
 * par la frontière d'erreur. Pas de `dsn` ici — sans transport, tout reste
 * dans le journal local, ce qui suffit déjà à rattacher un incident.
 *
 * `analytics` reste à `false` : lier un identifiant stable à un profil
 * analytique est un choix de traçabilité, et cette app n'a pas de télémétrie.
 */
void installObservability({
  context: { app: 'mister-family-map', environment: import.meta.env.MODE },
});
const correlation = await installCorrelation();

const backend = createBackend({ fetch: correlation.fetch ?? undefined });

const container = document.getElementById('app');
if (!container) throw new Error('Élément racine #app introuvable');

createRoot(container).render(
  <StrictMode>
    {/* Enregistre le crash ET affiche la référence à citer au support. */}
    <ObservabilityBoundary>
      {/*
        La version qui tourne, celle du démarrage précédent, celle qui est en
        ligne. `checkEvery` sonde `version.json` : une PWA installée ouverte
        plusieurs jours ne redécouvre pas son service worker toute seule, et
        c'est le seul canal qui transporte le NUMÉRO.
      */}
      <VersionProvider checkEvery="1h">
        <BackendProvider backend={backend}>
          <RouterProvider router={router} />
        </BackendProvider>
      </VersionProvider>
    </ObservabilityBoundary>
  </StrictMode>
);

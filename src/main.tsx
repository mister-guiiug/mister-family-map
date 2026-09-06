import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { ObservabilityBoundary } from '@mister-guiiug/dev-pwa-config/react';
import { VersionProvider } from '@mister-guiiug/dev-pwa-config/react/version';
import { ThemeProvider } from '@mister-guiiug/dev-pwa-config/react/theme-provider';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { installObservability } from '@mister-guiiug/dev-pwa-config/react/observability';
import { installCorrelation } from '@mister-guiiug/dev-pwa-config/correlation';
import { BackendProvider } from './app/providers/BackendProvider';
import { createBackend } from './app/config/backend';
import { THEME_COLOR, THEME_STORAGE_KEY } from './app/config/theme';
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
        {/*
          LE THÈME SOMBRE ÉTAIT HABILLÉ ET INATTEIGNABLE. Les jetons
          `[data-theme='dark']` sont dans `styles/index.css` depuis le premier
          jour, et `index.html` pose déjà l'attribut au démarrage d'après
          `dwc_theme` — mais RIEN ne montait de fournisseur, donc rien n'écrivait
          jamais cette clé : le mode sombre ne s'obtenait qu'en réglant tout le
          système d'exploitation. Ce fournisseur est la pièce qui manquait, et
          `ThemeToggle` (Profil) le geste qui l'actionne.

          PAS D'`appId` : l'app peint elle-même ses `--dwc-*` depuis ses propres
          jetons. Une palette du catalogue les poserait en style EN LIGNE sur
          `<html>`, qui l'emporterait sur ce branchement — et tirerait 22 ko de
          palettes pour rien.
        */}
        <ThemeProvider
          storageKey={THEME_STORAGE_KEY}
          themeColor={THEME_COLOR}
          defaultTheme="system"
          paint={false}
        >
          {/*
            `pb-24` : la zone d'affichage du socle est `fixed bottom-0`, comme
            la navigation basse. Sans cette réserve, chaque notification se
            poserait PAR-DESSUS les cinq onglets — y compris son bouton
            « Annuler », qui est précisément ce qu'il faut pouvoir atteindre.
          */}
          <ToastProvider className="pb-24">
            <BackendProvider backend={backend}>
              <RouterProvider router={router} />
            </BackendProvider>
          </ToastProvider>
        </ThemeProvider>
      </VersionProvider>
    </ObservabilityBoundary>
  </StrictMode>
);

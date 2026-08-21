import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { ErrorBoundary } from '@mister-guiiug/dev-wpa-config/react';
import { BackendProvider } from './app/providers/BackendProvider';
import { createBackend } from './app/config/backend';
import { router } from './app/router';
import './shared/styles/index.css';

const backend = createBackend();

const container = document.getElementById('app');
if (!container) throw new Error('Élément racine #app introuvable');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <BackendProvider backend={backend}>
        <RouterProvider router={router} />
      </BackendProvider>
    </ErrorBoundary>
  </StrictMode>
);

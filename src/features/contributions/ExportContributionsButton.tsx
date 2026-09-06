import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-pwa-config/react';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { downloadJson } from '@mister-guiiug/dev-pwa-config/download';
import { useBackend } from '../../app/providers/BackendProvider';
import type { AuthSession } from '../../entities/user/model';
import {
  buildContributionsExport,
  collectContributions,
  contributionsFilename,
} from './export';

/**
 * Le bouton qui tient la promesse de la page « Mentions ».
 *
 * Le fichier lui-même est décidé par `export.ts`, qui est PUR et éprouvé ;
 * ici, il ne reste que le geste : appeler, écrire, et dire ce qui s'est passé.
 * Un export qui échoue en silence — le stockage refuse, le réseau tombe — est
 * pire que pas d'export : l'utilisateur croit détenir ses données.
 */
export function ExportContributionsButton({
  session,
}: {
  session: AuthSession;
}) {
  const backend = useBackend();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function exporter() {
    setBusy(true);
    try {
      const collected = await collectContributions(backend, session);
      const file = buildContributionsExport(collected);
      const written = downloadJson(file, contributionsFilename());
      if (!written) throw new Error('Téléchargement refusé par le navigateur.');
      const total =
        file.places.length +
        file.events.length +
        file.reviews.length +
        file.favorites.length;
      toast.success(
        total === 0
          ? 'Fichier créé — vous n’avez encore rien publié.'
          : `Fichier créé : ${total} élément${total > 1 ? 's' : ''}.`
      );
    } catch (error) {
      toast.error(
        `Export impossible : ${
          error instanceof Error ? error.message : 'erreur inattendue'
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" loading={busy} onClick={() => void exporter()}>
      <Download size={18} aria-hidden="true" />
      Exporter mes contributions
    </Button>
  );
}

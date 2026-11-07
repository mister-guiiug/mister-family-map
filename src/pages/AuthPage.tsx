import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  ErrorBanner,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { PageHeader } from '../shared/components/PageHeader';
import { BandeauDemo } from '../shared/components/BandeauDemo';
import {
  CLE_BANDEAU_DEMO,
  MESSAGE_DEMO,
  useModeDemo,
} from '../shared/hooks/useModeDemo';

/**
 * Connexion / inscription par e-mail (magic link côté Supabase ; session de
 * démonstration immédiate avec le backend local).
 *
 * EN DÉMONSTRATION, L'ÉCRAN NE PROMET PAS D'E-MAIL. Le bouton disait
 * « Recevoir le lien de connexion » et ouvrait aussitôt une session locale :
 * aucun lien ne partait, et rien ne le disait. Il dit désormais ce qu'il fait.
 */
export default function AuthPage() {
  const backend = useBackend();
  const demo = useModeDemo();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse e-mail invalide.');
      return;
    }
    setSending(true);
    try {
      await backend.auth.signInWithEmail(email);
      navigate('/profil');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Connexion"
        subtitle="Un compte pour contribuer — la consultation reste libre"
      />
      {demo ? (
        <BandeauDemo
          etiquette="Démonstration"
          message={MESSAGE_DEMO}
          cleStockage={CLE_BANDEAU_DEMO}
          className="mx-fluid-md mb-fluid-sm"
        />
      ) : null}
      <form
        className="flex max-w-md flex-col gap-fluid-sm px-fluid-md"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {error ? <ErrorBanner message={error} severity="warning" /> : null}
        <TextField
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
          hint="Aucune donnée d’enfant n’est demandée, ni jamais collectée."
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={sending}>
          {demo
            ? 'Ouvrir une session de démonstration'
            : 'Recevoir le lien de connexion'}
        </Button>
        <p className="text-fluid-xs text-ink-soft">
          {demo
            ? 'Aucun e-mail n’est envoyé : la session s’ouvre tout de suite, dans ce navigateur seulement. '
            : 'Première connexion = création du compte. '}
          En continuant, vous acceptez les règles de contribution et la
          politique de confidentialité.
        </p>
      </form>
    </div>
  );
}

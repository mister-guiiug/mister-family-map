import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  ErrorBanner,
  TextField,
} from '@mister-guiiug/dev-wpa-config/react';
import { useBackend } from '../app/providers/BackendProvider';
import { PageHeader } from '../shared/components/PageHeader';

/**
 * Connexion / inscription par e-mail (magic link côté Supabase ; session de
 * démonstration immédiate avec le backend local).
 */
export default function AuthPage() {
  const backend = useBackend();
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
          Recevoir le lien de connexion
        </Button>
        <p className="text-fluid-xs text-ink-soft">
          Première connexion = création du compte. En continuant, vous acceptez
          les règles de contribution et la politique de confidentialité.
        </p>
      </form>
    </div>
  );
}

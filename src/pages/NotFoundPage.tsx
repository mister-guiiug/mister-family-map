import { useNavigate } from 'react-router';
import { Button, EmptyState } from '@mister-guiiug/dev-pwa-config/react';
import { PageHeader } from '../shared/components/PageHeader';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Page introuvable" />
      <div className="px-fluid-md">
        <EmptyState
          title="Cette page n'existe pas (404)"
          description="Le lien est peut-être périmé — la carte, elle, est toujours là."
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              Retour à l’exploration
            </Button>
          }
        />
      </div>
    </div>
  );
}

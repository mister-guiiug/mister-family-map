import {
  Button,
  SelectField,
  Sheet,
  TextField,
} from '@mister-guiiug/dev-pwa-config/react';
import type { Category } from '../../../entities/category/model';
import type { SearchFilters } from '../../../shared/schemas/filters';
import { useSearchStore } from '../store';

/**
 * Feuille de filtres. Les attributs ternaires proposent « Peu importe » /
 * « Oui » / « Non » — jamais un booléen qui transformerait l'inconnu en refus.
 */
export function FilterSheet({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: readonly Category[];
}) {
  const { filters, setFilters, reset } = useSearchStore();

  const triStateSelect = (
    label: string,
    key:
      | 'accessibility'
      | 'stroller'
      | 'petsAllowed'
      | 'toilets'
      | 'picnicArea'
      | 'waterPoint'
      | 'foodNearby'
      | 'weatherProof'
  ) => (
    <SelectField
      label={label}
      value={filters[key] ?? ''}
      onChange={e => {
        const v = e.target.value;
        setFilters({
          [key]: v === '' ? undefined : (v as SearchFilters[typeof key]),
        });
      }}
    >
      <option value="">Peu importe</option>
      <option value="yes">Oui</option>
      <option value="no">Non</option>
    </SelectField>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Filtrer les activités">
      <form
        className="flex flex-col gap-fluid-sm pb-safe-bottom"
        onSubmit={e => {
          e.preventDefault();
          onClose();
        }}
      >
        <SelectField
          label="Catégorie"
          value={filters.categoryIds[0] ?? ''}
          onChange={e =>
            setFilters({
              categoryIds: e.target.value === '' ? [] : [e.target.value],
            })
          }
        >
          <option value="">Toutes</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Distance maximale (km)"
          type="number"
          min={1}
          max={200}
          hint="Nécessite d’activer « Autour de moi » sur la carte."
          value={filters.maxDistanceKm ?? ''}
          onChange={e =>
            setFilters({
              maxDistanceKm:
                e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />

        <TextField
          label="Âge de l’enfant (années)"
          type="number"
          min={0}
          max={18}
          value={filters.childAge ?? ''}
          onChange={e =>
            setFilters({
              childAge:
                e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />

        <SelectField
          label="Gratuit ou payant"
          value={filters.free === undefined ? '' : String(filters.free)}
          onChange={e =>
            setFilters({
              free:
                e.target.value === '' ? undefined : e.target.value === 'true',
            })
          }
        >
          <option value="">Peu importe</option>
          <option value="true">Gratuit</option>
          <option value="false">Payant</option>
        </SelectField>

        <SelectField
          label="Intérieur ou extérieur"
          value={filters.setting ?? ''}
          onChange={e =>
            setFilters({
              setting:
                e.target.value === ''
                  ? undefined
                  : (e.target.value as SearchFilters['setting']),
            })
          }
        >
          <option value="">Peu importe</option>
          <option value="indoor">Intérieur</option>
          <option value="outdoor">Extérieur</option>
          <option value="mixed">Mixte</option>
        </SelectField>

        {triStateSelect('Compatible mauvais temps', 'weatherProof')}
        {triStateSelect('Accessible (PMR)', 'accessibility')}
        {triStateSelect('Adapté poussette', 'stroller')}
        {triStateSelect('Animaux autorisés', 'petsAllowed')}
        {triStateSelect('Toilettes', 'toilets')}
        {triStateSelect('Point d’eau', 'waterPoint')}
        {triStateSelect('Aire de pique-nique', 'picnicArea')}
        {triStateSelect('Restauration à proximité', 'foodNearby')}

        <SelectField
          label="Note minimale des familles"
          value={filters.minRating ?? ''}
          hint="Les lieux sans retour d’expérience restent affichés."
          onChange={e =>
            setFilters({
              minRating:
                e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        >
          <option value="">Peu importe</option>
          <option value="3">3/5 et plus</option>
          <option value="4">4/5 et plus</option>
        </SelectField>

        <div className="mt-2 flex gap-2">
          <Button type="submit" variant="primary" block>
            Voir les résultats
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Réinitialiser
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

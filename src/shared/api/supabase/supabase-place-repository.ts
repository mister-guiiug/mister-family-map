import type { SupabaseClient } from '@supabase/supabase-js';
import {
  placeSchema,
  type Place,
  type PlaceDraft,
} from '../../../entities/place/model';
import type { PlaceQuery, PlaceRepository } from '../ports';

/**
 * Adaptateur Supabase de RÉFÉRENCE (le patron pour les autres dépôts).
 *
 * Points structurants :
 * - les lignes SQL sont mappées puis VALIDÉES par le schéma du domaine
 *   (aucune donnée non conforme n'entre dans l'app) ;
 * - aucune décision d'autorisation ici : `create`/`updateOwn` s'appuient sur
 *   les politiques RLS (auteur = auth.uid(), statut forcé par trigger) ;
 * - la stratégie géospatiale MVP est un index B-tree sur (lat, lng) + filtre
 *   par rectangle — cf. docs/DATA-MODEL.md (PostGIS notée en évolution).
 */

interface PlaceRow {
  id: string;
  name: string;
  category_id: string;
  short_description: string;
  description: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  age_min: number | null;
  age_max: number | null;
  duration_minutes: number | null;
  price_kind: 'free' | 'paid' | 'unknown';
  price_min_euros: number | null;
  price_max_euros: number | null;
  opening_hours: string | null;
  website_url: string | null;
  phone: string | null;
  features: Place['features'];
  practical_tips: string;
  status: Place['status'];
  author_id: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToPlace(row: PlaceRow): Place {
  return placeSchema.parse({
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    shortDescription: row.short_description,
    description: row.description,
    coordinates: { lat: row.lat, lng: row.lng },
    address: row.address,
    city: row.city,
    ageRange:
      row.age_min !== null && row.age_max !== null
        ? { min: row.age_min, max: row.age_max }
        : null,
    durationMinutes: row.duration_minutes,
    price:
      row.price_kind === 'paid'
        ? {
            kind: 'paid',
            minEuros: row.price_min_euros ?? undefined,
            maxEuros: row.price_max_euros ?? undefined,
          }
        : { kind: row.price_kind },
    openingHours: row.opening_hours,
    websiteUrl: row.website_url,
    phone: row.phone,
    features: row.features,
    practicalTips: row.practical_tips,
    status: row.status,
    authorId: row.author_id,
    lastVerifiedAt: row.last_verified_at,
    photos: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  } satisfies Place);
}

function draftToRow(draft: PlaceDraft): Partial<PlaceRow> {
  return {
    name: draft.name,
    category_id: draft.categoryId,
    short_description: draft.shortDescription,
    description: draft.description,
    lat: draft.coordinates.lat,
    lng: draft.coordinates.lng,
    address: draft.address,
    city: draft.city,
    age_min: draft.ageRange?.min ?? null,
    age_max: draft.ageRange?.max ?? null,
    duration_minutes: draft.durationMinutes,
    price_kind: draft.price.kind,
    price_min_euros:
      draft.price.kind === 'paid' ? (draft.price.minEuros ?? null) : null,
    price_max_euros:
      draft.price.kind === 'paid' ? (draft.price.maxEuros ?? null) : null,
    opening_hours: draft.openingHours,
    website_url: draft.websiteUrl,
    phone: draft.phone,
    features: draft.features,
    practical_tips: draft.practicalTips,
  };
}

export function createSupabasePlaceRepository(
  client: SupabaseClient
): PlaceRepository {
  return {
    async list(query: PlaceQuery = {}) {
      let req = client.from('places').select('*').is('deleted_at', null);
      const statuses = query.statuses ?? ['published'];
      req = req.in('status', [...statuses]);
      if (query.authorId) req = req.eq('author_id', query.authorId);
      if (query.boundingBox) {
        const b = query.boundingBox;
        req = req.gte('lat', b.south).lte('lat', b.north);
        // L'antiméridien n'est pas géré côté SQL (hors périmètre France).
        req = req.gte('lng', b.west).lte('lng', b.east);
      }
      const { data, error } = await req;
      if (error) throw new Error(error.message);
      return (data as PlaceRow[]).map(rowToPlace);
    },

    async getById(id) {
      const { data, error } = await client
        .from('places')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToPlace(data as PlaceRow) : null;
    },

    async create(draft) {
      // author_id/status/horodatages imposés côté serveur (défauts + trigger).
      const { data, error } = await client
        .from('places')
        .insert(draftToRow(draft))
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToPlace(data as PlaceRow);
    },

    async updateOwn(id, draft) {
      // La RLS restreint l'UPDATE à l'auteur ; un trigger repasse le statut
      // en `pending` après modification.
      const { data, error } = await client
        .from('places')
        .update(draftToRow(draft))
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToPlace(data as PlaceRow);
    },

    async suggestRevision(placeId, draft, note) {
      const { error } = await client.from('place_revisions').insert({
        place_id: placeId,
        payload: draft,
        note,
      });
      if (error) throw new Error(error.message);
    },
  };
}

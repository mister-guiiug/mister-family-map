import { describe, expect, it } from 'vitest';
import { clusterByGrid } from './cluster';

const point = (id: string, lat: number, lng: number) => ({
  id,
  coordinates: { lat, lng },
  item: id,
});

describe('clusterByGrid', () => {
  it('regroupe les points proches à faible zoom', () => {
    const clusters = clusterByGrid(
      [
        point('a', 45.76, 4.83),
        point('b', 45.77, 4.84),
        point('c', 48.85, 2.35),
      ],
      8
    );
    expect(clusters).toHaveLength(2);
    const sizes = clusters.map(c => c.items.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it('ne regroupe plus au zoom 15 et au-delà', () => {
    const clusters = clusterByGrid(
      [point('a', 45.76, 4.83), point('b', 45.7601, 4.8301)],
      15
    );
    expect(clusters).toHaveLength(2);
  });

  it('le centre du groupe est la moyenne de ses points', () => {
    const clusters = clusterByGrid(
      [point('a', 45.0, 4.0), point('b', 45.2, 4.2)],
      6
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.coordinates.lat).toBeCloseTo(45.1);
    expect(clusters[0]?.coordinates.lng).toBeCloseTo(4.1);
  });

  it('liste vide → aucune erreur, aucun groupe', () => {
    expect(clusterByGrid([], 10)).toEqual([]);
  });
});

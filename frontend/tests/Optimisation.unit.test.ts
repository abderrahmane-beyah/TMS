import { describe, expect, it } from 'vitest';
import {
  formatDistanceKm,
  getSafeCount,
  getTourneesDepuisResultat,
  getCommandesNonServiesDepuisResultat,
} from '../src/pages/Optimisation';

describe('Optimisation - utilitaires de résultats', () => {
  it('retourne N/A si la distance est nulle', () => {
    expect(formatDistanceKm(null)).toBe('N/A');
    expect(formatDistanceKm(undefined)).toBe('N/A');
  });

  it('formate correctement la distance quand elle existe', () => {
    expect(formatDistanceKm(12.345)).toBe('12.3 km');
  });

  it('retourne 0 pour les compteurs absents', () => {
    expect(getSafeCount(null)).toBe(0);
    expect(getSafeCount(undefined)).toBe(0);
  });

  it('retourne la valeur du compteur quand elle existe', () => {
    expect(getSafeCount(7)).toBe(7);
  });

  it('lit les tournées depuis resultat_json', () => {
    const result = { resultat_json: { tournees: [{ vehicule_id: 1 }] } };
    expect(getTourneesDepuisResultat(result)).toHaveLength(1);
  });

  it('retourne un tableau vide si tournees est absent', () => {
    const result = { resultat_json: {} };
    expect(getTourneesDepuisResultat(result)).toEqual([]);
  });

  it('lit les commandes non servies depuis resultat_json', () => {
    const result = {
      resultat_json: {
        commandes_non_servies: [{ commande_id: 10, raison: 'Fenêtre temporelle' }],
      },
    };
    expect(getCommandesNonServiesDepuisResultat(result)).toHaveLength(1);
  });

  it('retourne un tableau vide si commandes_non_servies est absent', () => {
    const result = { resultat_json: {} };
    expect(getCommandesNonServiesDepuisResultat(result)).toEqual([]);
  });
});

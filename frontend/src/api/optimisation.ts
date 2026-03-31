import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface OptimisationLaunchPayload {
  date: string;
  vehicule_ids: number[];
  commande_ids: number[];
  algorithme: 'clarke-wright' | 'or-tools';
}

export interface OptimisationLaunchResponse {
  tache_id: string;
}

export interface OptimisationStatut {
  statut: string;
  progression: number;
}

export interface OptimisationResult {
  id: string;
  algorithme: string;
  distance_totale: number;
  vehicules_utilises: number;
  commandes_non_servies: { commande_id: number; raison: string }[];
  tournees: {
    vehicule_id: number;
    vehicule_immatriculation: string;
    stops: { commande_id: number; adresse: string; ordre: number }[];
    distance: number;
  }[];
}

export interface TacheOptimisation {
  id: string;
  algorithme: string;
  date: string;
  statut: 'EN_COURS' | 'TERMINÉE' | 'ERREUR';
  created_at: string;
  distance_totale?: number;
  vehicules_utilises?: number;
  commandes_non_servies_count?: number;
}

export async function lancerOptimisation(
  payload: OptimisationLaunchPayload
): Promise<OptimisationLaunchResponse> {
  if (USE_MOCK) return mockApi.lancerOptimisation();
  const { data } = await client.post('/optimisation/lancer', payload);
  return data;
}

export async function getOptimisationStatut(
  id: string
): Promise<OptimisationStatut> {
  if (USE_MOCK) return mockApi.getOptimisationStatut(id);
  const { data } = await client.get(`/optimisation/${id}/statut`);
  return data;
}

export async function getOptimisationResult(
  id: string
): Promise<OptimisationResult> {
  if (USE_MOCK) return mockApi.getOptimisationResult();
  const { data } = await client.get(`/optimisation/${id}/result`);
  return data;
}

export async function getOptimisationHistory(): Promise<TacheOptimisation[]> {
  if (USE_MOCK) return mockApi.getOptimisationHistory();
  const { data } = await client.get('/optimisation/history');
  return data;
}

import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface Stop {
  id: number;
  commande_id: number;
  adresse: string;
  lat: number;
  lon: number;
  ordre: number;
  heure_prevue: string;
  heure_reelle?: string;
  statut: string;
}

export interface Tournee {
  id: number;
  chauffeur_nom: string;
  vehicule_immatriculation: string;
  date: string;
  statut: string;
  nombre_stops: number;
  distance_totale: number;
  progression: number;
  stops?: Stop[];
  anomalies?: { id: number; type: string; description: string }[];
}

export async function getTournees(params?: {
  date?: string;
}): Promise<Tournee[]> {
  if (USE_MOCK) return mockApi.getTournees();
  const { data } = await client.get('/tournees', { params });
  return data;
}

export async function getTournee(id: number): Promise<Tournee> {
  if (USE_MOCK) return mockApi.getTournee(id);
  const { data } = await client.get(`/tournees/${id}`);
  return data;
}

export async function getMaTournee(): Promise<Tournee | null> {
  if (USE_MOCK) return mockApi.getMaTournee();
  const { data } = await client.get('/tournees/ma-tournee');
  return data;
}

export async function confirmerLivraison(tourneeId: number, stopId: number): Promise<Stop> {
  if (USE_MOCK) return mockApi.confirmerLivraison(tourneeId, stopId);
  const { data } = await client.patch(`/tournees/${tourneeId}/stops/${stopId}/confirmer`);
  return data;
}

export async function signalerProbleme(
  tourneeId: number,
  stopId: number,
  description: string
): Promise<unknown> {
  if (USE_MOCK) return mockApi.signalerProbleme(tourneeId, stopId, description);
  const { data } = await client.post(`/tournees/${tourneeId}/stops/${stopId}/probleme`, { description });
  return data;
}

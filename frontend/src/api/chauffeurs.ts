import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface Chauffeur {
  id: number;
  nom: string;
  permis: string;
  statut: string;
}

export interface ChauffeurPayload {
  nom: string;
  permis: string;
  statut: string;
}

export async function getChauffeurs(): Promise<Chauffeur[]> {
  if (USE_MOCK) return mockApi.getChauffeurs();
  const { data } = await client.get('/chauffeurs');
  return data;
}

export async function createChauffeur(payload: ChauffeurPayload): Promise<Chauffeur> {
  if (USE_MOCK) return mockApi.createChauffeur(payload);
  const { data } = await client.post('/chauffeurs', payload);
  return data;
}

export async function updateChauffeur(
  id: number,
  payload: Partial<ChauffeurPayload>
): Promise<Chauffeur> {
  if (USE_MOCK) return mockApi.updateChauffeur(id, payload);
  const { data } = await client.patch(`/chauffeurs/${id}`, payload);
  return data;
}

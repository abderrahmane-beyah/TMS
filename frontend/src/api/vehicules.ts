import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface Vehicule {
  id: number;
  immatriculation: string;
  capacite_poids: number;
  capacite_volume: number;
  statut: string;
}

export interface VehiculePayload {
  immatriculation: string;
  capacite_poids: number;
  capacite_volume: number;
  statut: string;
}

export async function getVehicules(): Promise<Vehicule[]> {
  if (USE_MOCK) return mockApi.getVehicules();
  const { data } = await client.get('/vehicules');
  return data;
}

export async function createVehicule(payload: VehiculePayload): Promise<Vehicule> {
  if (USE_MOCK) return mockApi.createVehicule(payload);
  const { data } = await client.post('/vehicules', payload);
  return data;
}

export async function updateVehicule(
  id: number,
  payload: Partial<VehiculePayload>
): Promise<Vehicule> {
  if (USE_MOCK) return mockApi.updateVehicule(id, payload);
  const { data } = await client.patch(`/vehicules/${id}`, payload);
  return data;
}

export async function deleteVehicule(id: number): Promise<void> {
  if (USE_MOCK) return mockApi.deleteVehicule(id);
  await client.delete(`/vehicules/${id}`);
}

import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface Commande {
  id: number;
  expediteur: string;
  adresse_enlevement: string;
  adresse_livraison: string;
  lat_enlevement?: number;
  lon_enlevement?: number;
  lat_livraison?: number;
  lon_livraison?: number;
  poids: number;
  volume: number;
  date_livraison: string;
  heure_ouverture: string;
  heure_fermeture: string;
  statut: string;
  created_at: string;
  updated_at: string;
  transitions?: { statut: string; date: string }[];
}

export interface CommandeCreate {
  adresse_enlevement: string;
  adresse_livraison: string;
  lat_enlevement: number;
  lon_enlevement: number;
  lat_livraison: number;
  lon_livraison: number;
  poids: number;
  volume: number;
  date_livraison: string;
  heure_ouverture: string;
  heure_fermeture: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export async function getCommandes(params?: {
  page?: number;
  statut?: string;
  search?: string;
}): Promise<PaginatedResponse<Commande>> {
  if (USE_MOCK) return mockApi.getCommandes(params);
  const { data } = await client.get('/commandes', { params });
  return data;
}

export async function getCommande(id: number): Promise<Commande> {
  if (USE_MOCK) return mockApi.getCommande(id);
  const { data } = await client.get(`/commandes/${id}`);
  return data;
}

export async function createCommande(payload: CommandeCreate): Promise<Commande> {
  if (USE_MOCK) return mockApi.createCommande(payload);
  const { data } = await client.post('/commandes', payload);
  return data;
}

export async function updateCommandeStatut(
  id: number,
  statut: string
): Promise<Commande> {
  if (USE_MOCK) return mockApi.updateCommandeStatut(id, statut);
  const { data } = await client.patch(`/commandes/${id}/statut`, { statut });
  return data;
}

export async function deleteCommande(id: number): Promise<void> {
  if (USE_MOCK) return mockApi.deleteCommande(id);
  await client.delete(`/commandes/${id}`);
}
